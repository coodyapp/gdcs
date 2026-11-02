import { HttpError, type Env } from "./http"

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

/**
 * Rejects the request unless Turnstile vouches for the token. Without a
 * configured secret (local dev) verification is skipped.
 */
export async function requireHuman(
  token: unknown,
  request: Request,
  env: Env,
  fetcher: typeof fetch = fetch
) {
  if (!env.TURNSTILE_SECRET) return
  if (typeof token !== "string" || !token || token.length > 2048) {
    throw new HttpError(
      400,
      "Verification failed. Reload the page and try again."
    )
  }
  const body = new FormData()
  body.append("secret", env.TURNSTILE_SECRET)
  body.append("response", token)
  const ip = request.headers.get("CF-Connecting-IP")
  if (ip) body.append("remoteip", ip)
  const res = await fetcher(VERIFY_URL, { method: "POST", body })
  const outcome = (await res.json().catch(() => ({}))) as {
    success?: boolean
    hostname?: string
  }
  if (!outcome.success)
    throw new HttpError(
      400,
      "Verification failed. Reload the page and try again."
    )
}
