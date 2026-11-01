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

const COOLDOWN_MS = 15 * 60 * 1000
const MAX_SENDS = 5

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

    const now = new Date()
    const cooldown = new Date(now.getTime() - COOLDOWN_MS).toISOString()
    // New address: insert as pending. Known, non-active address: send again
    // only after a cooldown and at most MAX_SENDS times; keep its token.
    const row = await env.DB.prepare(
      `INSERT INTO subscribers (id, email, status, confirm_token, unsub_token, source, created_at, last_confirm_sent_at, confirm_sends)
       VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, 1)
       ON CONFLICT(email) DO UPDATE SET
         status = 'pending',
         last_confirm_sent_at = excluded.last_confirm_sent_at,
         confirm_sends = subscribers.confirm_sends + 1
       WHERE subscribers.status != 'active'
         AND (subscribers.last_confirm_sent_at IS NULL OR subscribers.last_confirm_sent_at < ?)
         AND subscribers.confirm_sends < ?
       RETURNING confirm_token`
    )
      .bind(
        crypto.randomUUID(),
        email,
        token(),
        token(),
        cleanSource(body.source),
        now.toISOString(),
        now.toISOString(),
        cooldown,
        MAX_SENDS
      )
      .first<{ confirm_token: string }>()

    // `row` is null when active, throttled or capped: nothing to send.
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
