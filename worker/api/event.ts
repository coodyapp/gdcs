import { HttpError, limitWrites, readJson, safely, type Env } from "../http"

const NAMES = new Set(["copy_prompt", "copy_prompt_card", "copy_markdown"])

/** Cookieless daily counts of copy actions per page. */
export const recordEvent = (request: Request, env: Env, _ctx?: unknown) =>
  safely(async () => {
    const body = await readJson(request)
    const name = String(body.name ?? "")
    const path = String(body.path ?? "")
    if (
      !NAMES.has(name) ||
      !/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+){0,2})?$/.test(path)
    )
      throw new HttpError(400, "Unknown event.")
    await limitWrites(request, env, 30, "event")
    // Count only real pages, so the table can't grow with arbitrary paths.
    const page = await env.ASSETS.fetch(new URL(path, request.url).toString(), {
      method: "HEAD",
    })
    if (!page.ok || page.redirected) throw new HttpError(400, "Unknown page.")
    await env.DB.prepare(
      "INSERT INTO site_events(day, name, path, count) VALUES (?, ?, ?, 1) ON CONFLICT(day, name, path) DO UPDATE SET count = count + 1"
    )
      .bind(new Date().toISOString().slice(0, 10), name, path)
      .run()
    return new Response(null, { status: 204 })
  })
