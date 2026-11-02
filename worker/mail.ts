/** Pure helpers for the update emails (unit-tested). */

export interface FeedItem {
  id: string
  url: string
  title: string
  summary: string
  date_modified: string
  tags: string[]
}

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

/** Items modified strictly after `since` (ISO), newest first, capped. */
export function newSince(items: FeedItem[], since: string, max = 12) {
  return items
    .filter((i) => i.date_modified > since)
    .sort((a, b) => b.date_modified.localeCompare(a.date_modified))
    .slice(0, max)
}

const shell = (body: string, footer: string) => `<!doctype html>
<html lang="en"><body style="margin:0;background:#0a0a0a;color:#fafafa;font-family:-apple-system,Segoe UI,Inter,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px" cellpadding="0" cellspacing="0"><tr><td>
<p style="font:600 12px ui-monospace,Menlo,monospace;letter-spacing:.2em;color:#a3a3a3;text-transform:uppercase;margin:0 0 24px">GDCS · Game Development Cheat Sheet</p>
${body}
<p style="font-size:12px;color:#737373;margin-top:40px;border-top:1px solid #262626;padding-top:16px">${footer}</p>
</td></tr></table></td></tr></table></body></html>`

export function confirmationEmail(url: string) {
  return {
    subject: "Confirm your GDCS updates subscription",
    text: `Confirm your subscription to GDCS updates:\n\n${url}\n\nIf you didn't ask for this, ignore this email; nothing else will be sent.`,
    html: shell(
      `<h1 style="font-size:24px;margin:0 0 12px">Confirm your subscription</h1>
<p style="color:#d4d4d4;line-height:1.6">Click below to get an occasional email when new visual cheat sheets are published.</p>
<p style="margin:28px 0"><a href="${escapeHtml(url)}" style="background:#fafafa;color:#0a0a0a;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">Confirm subscription</a></p>`,
      "If you didn't ask for this, ignore this email; nothing else will be sent."
    ),
  }
}

export function digestEmail(
  items: FeedItem[],
  unsubscribeUrl: string,
  siteUrl: string
) {
  const subject =
    items.length === 1
      ? `New on GDCS: ${items[0].title}`
      : `${items.length} new cheat sheets on GDCS`
  const text = [
    subject,
    "",
    ...items.flatMap((i) => [`${i.title}`, i.summary, i.url, ""]),
    `All sheets: ${siteUrl}`,
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n")
  const list = items
    .map(
      (i) => `<tr><td style="padding:14px 0;border-bottom:1px solid #262626">
<a href="${escapeHtml(i.url)}" style="color:#fafafa;font-size:17px;font-weight:600;text-decoration:none">${escapeHtml(i.title)}</a>
<p style="color:#a3a3a3;margin:6px 0 0;line-height:1.5;font-size:14px">${escapeHtml(i.summary)}</p></td></tr>`
    )
    .join("")
  const html = shell(
    `<h1 style="font-size:24px;margin:0 0 8px">${escapeHtml(subject)}</h1>
<p style="color:#a3a3a3;margin:0 0 16px">Each one has an interactive visual, formulas, code and a copy-ready AI prompt.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${list}</table>
<p style="margin:28px 0"><a href="${escapeHtml(siteUrl)}" style="color:#38bdf8">Browse all cheat sheets →</a></p>`,
    `You get this because you subscribed at gdcs.coody.app. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#a3a3a3">Unsubscribe</a>.`
  )
  return { subject, text, html }
}
