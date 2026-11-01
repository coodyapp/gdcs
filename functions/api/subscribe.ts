import type { PagesFunction } from "@cloudflare/workers-types"

import {
  json,
  limitWrites,
  readJson,
  safely,
  token,
  type Env,
} from "../_lib/http"
import { cleanSource, isBot, parseEmail } from "../_lib/subscribers"

/**
 * POST /api/subscribe {email, website (honeypot), source}
 * Creates or refreshes a pending subscriber and emails a confirmation link.
 * The response is identical whether or not the address already exists, so
 * the endpoint can't be used to check who is subscribed.
 */
export const onRequestPost: PagesFunction<Env> = ({
  request,
  env,
  waitUntil,
}) =>
  safely(async () => {
    const body = await readJson(request)
    if (isBot(body)) return json({ ok: true }, 202)
    const email = parseEmail(body.email)
    await limitWrites(request, env)

    const now = new Date().toISOString()
    const confirm = token()
    const row = await env.DB.prepare(
      `INSERT INTO subscribers (id, email, status, confirm_token, unsub_token, source, created_at)
       VALUES (?, ?, 'pending', ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET confirm_token = excluded.confirm_token
         WHERE subscribers.status != 'active'
       RETURNING status, confirm_token`
    )
      .bind(
        crypto.randomUUID(),
        email,
        confirm,
        token(),
        cleanSource(body.source),
        now
      )
      .first<{ status: string; confirm_token: string }>()

    // `row` is null when the address is already active: nothing to send.
    if (row && env.MAILER) {
      const origin = new URL(request.url).origin
      waitUntil(
        env.MAILER.fetch("https://mailer/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            url: `${origin}/api/confirm?token=${row.confirm_token}`,
          }),
        }).then((r) => {
          if (!r.ok) console.error("confirmation email failed", r.status)
        })
      )
    }
    return json({ ok: true }, 202)
  })
