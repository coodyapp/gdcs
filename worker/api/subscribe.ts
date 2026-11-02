import type { ExecutionContext } from "@cloudflare/workers-types"

import { json, limitWrites, readJson, safely, token, type Env } from "../http"
import { sendConfirmation } from "../mailer"
import { cleanSource, isBot, parseEmail } from "../subscribers"
import { requireHuman } from "../turnstile"

const COOLDOWN_MS = 15 * 60 * 1000
/** At most MAX_SENDS confirmation emails per address per rolling day. */
const MAX_SENDS = 5
const WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * POST /api/subscribe {email, website (honeypot), source}
 * Creates or refreshes a pending subscriber and emails a confirmation link.
 * The response is identical whether or not the address already exists, so
 * the endpoint can't be used to check who is subscribed.
 */
export const subscribe = (request: Request, env: Env, ctx: ExecutionContext) =>
  safely(async () => {
    const body = await readJson(request)
    if (isBot(body)) return json({ ok: true }, 202)
    const email = parseEmail(body.email)
    await requireHuman(body.turnstile, request, env)
    await limitWrites(request, env)

    const now = new Date()
    const cooldown = new Date(now.getTime() - COOLDOWN_MS).toISOString()
    // New address: insert as pending. Known, non-active address: send again
    // only after a cooldown and at most MAX_SENDS times; keep its token.
    const row = await env.DB.prepare(
      `INSERT INTO subscribers (id, email, status, confirm_token, unsub_token, source, created_at, last_confirm_sent_at, confirm_sends)
       VALUES (?1, ?2, 'pending', ?3, ?4, ?5, ?6, ?6, 1)
       ON CONFLICT(email) DO UPDATE SET
         status = 'pending',
         last_confirm_sent_at = ?6,
         confirm_sends = CASE
           WHEN subscribers.last_confirm_sent_at IS NULL OR subscribers.last_confirm_sent_at < ?9 THEN 1
           ELSE subscribers.confirm_sends + 1
         END
       WHERE subscribers.status != 'active'
         AND (subscribers.last_confirm_sent_at IS NULL OR subscribers.last_confirm_sent_at < ?7)
         AND (subscribers.confirm_sends < ?8 OR subscribers.last_confirm_sent_at < ?9)
       RETURNING confirm_token`
    )
      .bind(
        crypto.randomUUID(), // ?1
        email, // ?2
        token(), // ?3 confirm token (new rows only)
        token(), // ?4 unsubscribe token (new rows only)
        cleanSource(body.source), // ?5
        now.toISOString(), // ?6
        cooldown, // ?7 resend cooldown cutoff
        MAX_SENDS, // ?8
        new Date(now.getTime() - WINDOW_MS).toISOString() // ?9 rolling-day cutoff
      )
      .first<{ confirm_token: string }>()

    // `row` is null when active, throttled or capped: nothing to send.
    if (row) {
      const url = `${new URL(request.url).origin}/api/confirm?token=${row.confirm_token}`
      ctx.waitUntil(
        sendConfirmation(env, email, url).catch((error) => {
          console.error("confirmation email failed", error)
        })
      )
    }
    return json({ ok: true }, 202)
  })
