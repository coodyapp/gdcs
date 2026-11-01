import type { D1Database, Fetcher } from "@cloudflare/workers-types"

export interface Env {
  DB: D1Database
  /** Pages static assets. */
  ASSETS: Fetcher
  /** Service binding to the gdcs-mailer Worker (send_email lives there). */
  MAILER?: Fetcher
  RATE_SALT?: string
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}

/** Turns HttpErrors into JSON responses and hides everything else. */
export async function safely(operation: () => Promise<Response>) {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status)
    console.error(error)
    return json({ error: "Something went wrong. Try again later." }, 500)
  }
}

const MAX_BODY = 4096

/** Same-origin JSON object bodies only, size-capped. */
export async function readJson(
  request: Request
): Promise<Record<string, unknown>> {
  const origin = request.headers.get("Origin")
  if (origin && origin !== new URL(request.url).origin)
    throw new HttpError(403, "Cross-origin request.")
  const type = request.headers.get("Content-Type")?.split(";")[0].trim()
  if (type !== "application/json" && type !== "text/plain")
    throw new HttpError(415, "Send application/json.")
  const text = await request.text()
  if (text.length > MAX_BODY) throw new HttpError(413, "Request is too large.")
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new HttpError(400, "Provide valid JSON.")
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new HttpError(400, "Provide a JSON object.")
  return data as Record<string, unknown>
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  )
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/** 256-bit URL-safe random token. */
export function token() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

/** At most `max` writes per IP per minute. */
export async function limitWrites(request: Request, env: Env, max = 5) {
  const now = Math.floor(Date.now() / 1000)
  const window = now - (now % 60)
  const ip = request.headers.get("CF-Connecting-IP") ?? "local"
  const ipHash = await sha256(`${env.RATE_SALT ?? "gdcs"}:${ip}`)
  const row = await env.DB.prepare(
    "INSERT INTO write_limits (ip_hash, window_start, attempts) VALUES (?, ?, 1) ON CONFLICT(ip_hash, window_start) DO UPDATE SET attempts = attempts + 1 WHERE attempts < ? RETURNING attempts"
  )
    .bind(ipHash, window, max)
    .first()
  if (!row)
    throw new HttpError(429, "Too many requests. Try again in a minute.")
  // Opportunistic cleanup of old windows.
  if (Math.random() < 0.05) {
    await env.DB.prepare("DELETE FROM write_limits WHERE window_start < ?")
      .bind(window - 3600)
      .run()
  }
}
