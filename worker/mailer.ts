import { confirmationEmail, digestEmail, newSince, type FeedItem } from "./mail"
import type { Env } from "./http"

const from = (env: Env) => ({ email: env.FROM_EMAIL, name: env.FROM_NAME })

/** Double opt-in email. Only links on this site's own origin are sent. */
export async function sendConfirmation(env: Env, to: string, url: string) {
  if (!url.startsWith(`${env.SITE_URL}/api/confirm?token=`)) {
    throw new Error(`refusing confirmation link outside ${env.SITE_URL}`)
  }
  await env.EMAIL.send({ from: from(env), to, ...confirmationEmail(url) })
}

export async function sendDigest(env: Env, now = new Date()) {
  const last = await env.DB.prepare(
    "SELECT since, sent_at FROM sends ORDER BY sent_at DESC LIMIT 1"
  ).first<{ sent_at: string }>()
  // First run: announce nothing older than 30 days.
  const since =
    last?.sent_at ?? new Date(now.getTime() - 30 * 864e5).toISOString()
  // Read the feed straight from our own static assets (no network hop).
  const feed = (await (
    await env.ASSETS.fetch(`${env.SITE_URL}/feed.json`)
  ).json()) as { items: FeedItem[] }
  const items = newSince(feed.items, since)
  if (!items.length) return { sent: 0, items: 0 }

  const { results } = await env.DB.prepare(
    "SELECT email, unsub_token FROM subscribers WHERE status = 'active'"
  ).all<{ email: string; unsub_token: string }>()
  let sent = 0
  for (const sub of results) {
    const unsub = `${env.SITE_URL}/api/unsubscribe?token=${sub.unsub_token}`
    const mail = digestEmail(items, unsub, env.SITE_URL)
    try {
      await env.EMAIL.send({
        from: from(env),
        to: sub.email,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        headers: {
          "List-Unsubscribe": `<${unsub}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      })
      sent++
    } catch (error) {
      console.error("digest send failed", error)
    }
  }
  await env.DB.prepare(
    "INSERT INTO sends (id, sent_at, since, sheet_ids, recipients) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(
      crypto.randomUUID(),
      now.toISOString(),
      since,
      JSON.stringify(items.map((i) => i.id)),
      sent
    )
    .run()
  return { sent, items: items.length }
}
