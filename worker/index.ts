import type {
  ExecutionContext,
  ScheduledController,
} from "@cloudflare/workers-types"

import { confirm } from "./api/confirm"
import { recordEvent } from "./api/event"
import { subscribe } from "./api/subscribe"
import { unsubscribeLink, unsubscribeOneClick } from "./api/unsubscribe"
import { json, type Env } from "./http"
import { sendDigest } from "./mailer"

type Handler = (
  request: Request,
  env: Env,
  ctx: ExecutionContext
) => Promise<Response>

/** `METHOD /path` → handler. Static files never reach this Worker (assets first). */
const routes: Record<string, Handler> = {
  "POST /api/subscribe": subscribe,
  "GET /api/confirm": confirm,
  "GET /api/unsubscribe": unsubscribeLink,
  "POST /api/unsubscribe": unsubscribeOneClick,
  "POST /api/event": recordEvent,
}

export async function handle(
  request: Request,
  env: Env,
  ctx: ExecutionContext
) {
  const { pathname } = new URL(request.url)
  const handler = routes[`${request.method} ${pathname}`]
  if (handler) return handler(request, env, ctx)
  if (Object.keys(routes).some((key) => key.endsWith(` ${pathname}`))) {
    return json({ error: "Method not allowed." }, 405)
  }
  if (pathname.startsWith("/api/")) return json({ error: "Not found." }, 404)
  // Anything else falls back to static assets (and their 404 page).
  return env.ASSETS.fetch(request)
}

export default {
  fetch: handle,
  /** Weekly digest (cron in wrangler.jsonc). Sends only when sheets changed. */
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ) {
    ctx.waitUntil(
      sendDigest(env).then((result) => console.log("digest", result))
    )
  },
}
