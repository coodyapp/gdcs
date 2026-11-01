import type {
  D1Database,
  ExecutionContext,
  ScheduledController,
  SendEmail,
} from "@cloudflare/workers-types"

import {
  confirmationEmail,
  digestEmail,
  newSince,
  type FeedItem,
} from "./digest"

interface Env {
  DB: D1Database
  EMAIL: SendEmail
  SITE_URL: string
  FROM_EMAIL: string
  FROM_NAME: string
}

const from = (env: Env) => ({ email: env.FROM_EMAIL, name: env.FROM_NAME })

/** Sends the digest to every active subscriber if sheets changed since the last one. */
export async function sendDigest(env: Env, now = new Date()) {
  const last = await env.DB.prepare(
    "SELECT since, sent_at FROM sends ORDER BY sent_at DESC LIMIT 1"
  ).first<{ sent_at: string }>()
  // First run: announce nothing older than 30 days.
  const since =
    last?.sent_at ?? new Date(now.getTime() - 30 * 864e5).toISOString()
  const feed = (await (
    await fetch(`${env.SITE_URL}/feed.json`, {
      cf: { cacheTtl: 0 },
    } as RequestInit)
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

export default {
  /** Internal API, reachable only through the Pages service binding. */
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === "POST" && url.pathname === "/confirm") {
      const { email, url: link } = (await request.json()) as {
        email: string
        url: string
      }
      if (!link.startsWith(`${env.SITE_URL}/api/confirm?token=`))
        return new Response("bad link", { status: 400 })
      const mail = confirmationEmail(link)
      await env.EMAIL.send({ from: from(env), to: email, ...mail })
      return new Response(null, { status: 204 })
    }
    return new Response("not found", { status: 404 })
  },

  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ) {
    ctx.waitUntil(sendDigest(env).then((r) => console.log("digest", r)))
  },
}
