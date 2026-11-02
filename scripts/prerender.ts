/**
 * Build step 3 of 3 (after the client and SSR builds). For every indexable
 * route it renders the full page HTML with React on the server and writes
 * `dist/<path>.html` (Cloudflare Pages serves it at `/<path>`), with the
 * route's own title, description, canonical, Open Graph and JSON-LD. It also
 * writes the AI/SEO companions: `.md` twins, llms.txt, llms-full.txt,
 * sitemap.xml, robots.txt and feed.json.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

const root = path.resolve(import.meta.dirname, "..")
const dist = path.join(root, "dist")
const server = path.join(root, "dist-server", "entry-server.js")

interface Head {
  title: string
  description: string
  path: string
  type: string
  jsonLd: object[]
  noindex?: boolean
  markdown?: string
  updated: string
  image?: string
}
interface SheetLike {
  slug: string
  title: string
  summary: string
  updated: string
  tags: string[]
  category: string
  subcategory: string
}
interface ServerEntry {
  render(url: string): string
  headFor(path: string): Head
  allPaths(): string[]
  sheetMarkdown(sheet: SheetLike): string
  llmsTxt(): string
  llmsFullTxt(): string
  sheets: SheetLike[]
  fullSheets: SheetLike[]
  sheetPath(sheet: SheetLike): string
  sheetMarkdownPath(sheet: SheetLike): string
}

const SITE = "https://gdcs.coody.app"
const abs = (p: string) => (p === "/" ? SITE : SITE + p)

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

function setTag(
  html: string,
  pattern: RegExp,
  replacement: string,
  name: string
) {
  if (!pattern.test(html)) throw new Error(`index.html is missing ${name}`)
  return html.replace(pattern, replacement)
}

const meta = (html: string, attr: string, key: string, value: string) =>
  setTag(
    html,
    new RegExp(`<meta\\s+${attr}="${key}"\\s+content="[^"]*"\\s*/>`),
    `<meta ${attr}="${key}" content="${escapeHtml(value)}" />`,
    `${attr}=${key}`
  )

export function applyHead(shell: string, head: Head) {
  const url = abs(head.path)
  let html = setTag(
    shell,
    /<title>[^<]*<\/title>/,
    `<title>${escapeHtml(head.title)}</title>`,
    "title"
  )
  html = setTag(
    html,
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/>/,
    `<link rel="canonical" href="${url}" />`,
    "canonical"
  )
  html = meta(html, "name", "description", head.description)
  html = meta(
    html,
    "name",
    "robots",
    head.noindex ? "noindex,follow" : "index,follow"
  )
  html = meta(html, "property", "og:type", head.type)
  html = meta(html, "property", "og:url", url)
  html = meta(html, "property", "og:title", head.title)
  html = meta(html, "property", "og:description", head.description)
  html = meta(html, "name", "twitter:title", head.title)
  html = meta(html, "name", "twitter:description", head.description)
  if (head.image) {
    html = meta(html, "property", "og:image", abs(head.image))
    html = meta(html, "name", "twitter:image", abs(head.image))
  }
  const extra: string[] = []
  if (head.path === "/") {
    // The hero's first frame arrives with the page instead of after the CSS.
    extra.push(
      `<link rel="preload" as="image" type="image/webp" href="/posters/fibers-hero-phone.webp" media="(max-width: 639px)" fetchpriority="high" />`,
      `<link rel="preload" as="image" type="image/webp" href="/posters/fibers-hero.webp" media="(min-width: 640px)" fetchpriority="high" />`
    )
  }
  if (head.markdown) {
    extra.push(
      `<link rel="alternate" type="text/markdown" title="Markdown" href="${head.markdown}" />`
    )
  }
  if (head.type === "article") {
    extra.push(
      `<meta property="article:modified_time" content="${head.updated}" />`
    )
  }
  if (head.jsonLd.length) {
    const graph = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": head.jsonLd,
    }).replace(/</g, "\\u003c")
    extra.push(`<script type="application/ld+json">${graph}</script>`)
  }
  return html.replace(
    "</head>",
    `${extra.map((l) => `    ${l}\n`).join("")}  </head>`
  )
}

export function sitemap(entries: { path: string; updated: string }[]) {
  const urls = entries
    .map(
      (e) =>
        `  <url><loc>${abs(e.path)}</loc><lastmod>${e.updated}</lastmod></url>`
    )
    .join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

/** Search engines and AI crawlers are explicitly welcome. */
export const robots = () =>
  [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "",
    ...[
      "GPTBot",
      "OAI-SearchBot",
      "ChatGPT-User",
      "ClaudeBot",
      "Claude-User",
      "Claude-SearchBot",
      "PerplexityBot",
      "Google-Extended",
      "Applebot-Extended",
      "CCBot",
    ].flatMap((bot) => [
      `User-agent: ${bot}`,
      "Allow: /",
      "Disallow: /api/",
      "",
    ]),
    `Sitemap: ${SITE}/sitemap.xml`,
    "",
  ].join("\n")

export async function inlineCss(html: string) {
  const links = [
    ...html.matchAll(
      /<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>/g
    ),
  ]
  if (!links.length) throw new Error("No stylesheet found in index.html")
  for (const [tag, href] of links) {
    const css = await readFile(path.join(dist, href), "utf8")
    html = html.replace(
      tag,
      `<style>${css.replace(/<\/style/gi, "<\\/style")}</style>`
    )
  }
  return html
}

async function write(file: string, content: string) {
  const target = path.join(dist, file)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, content)
}

async function main() {
  const entry = (await import(pathToFileURL(server).href)) as ServerEntry
  // Inline the (small) stylesheet so first paint needs no extra round trip.
  // Its url()s are root-absolute (/assets/...), so they resolve the same.
  const rawShell = await readFile(path.join(dist, "index.html"), "utf8")
  const shell = await inlineCss(rawShell)
  const paths = entry.allPaths()
  const seen = new Set<string>()

  for (const p of paths) {
    if (seen.has(p)) throw new Error(`Duplicate route ${p}`)
    seen.add(p)
    const head = entry.headFor(p)
    if (head.noindex) throw new Error(`Route ${p} resolved to a 404`)
    const body = entry.render(p)
    const html = applyHead(shell, head).replace(
      '<div id="root"></div>',
      `<div id="root">${body}</div>`
    )
    await write(p === "/" ? "index.html" : `${p.slice(1)}.html`, html)
  }

  // Unknown URLs: the bare shell, client-rendered, never indexed.
  await write("404.html", applyHead(shell, entry.headFor("/404")))

  for (const s of entry.fullSheets)
    await write(entry.sheetMarkdownPath(s).slice(1), entry.sheetMarkdown(s))
  await write("llms.txt", entry.llmsTxt())
  await write("llms-full.txt", entry.llmsFullTxt())
  await write("robots.txt", robots())
  await write(
    "sitemap.xml",
    sitemap(paths.map((p) => ({ path: p, updated: entry.headFor(p).updated })))
  )

  // JSON Feed 1.1: newest first. Also the source for the update emails.
  const items = [...entry.sheets]
    .sort(
      (a, b) =>
        b.updated.localeCompare(a.updated) || a.title.localeCompare(b.title)
    )
    .map((s) => ({
      id: s.slug,
      url: abs(entry.sheetPath(s)),
      title: s.title,
      summary: s.summary,
      content_text: s.summary,
      date_modified: `${s.updated}T00:00:00Z`,
      tags: [s.category, s.subcategory, ...s.tags],
      _markdown: abs(entry.sheetMarkdownPath(s)),
    }))
  await write(
    "feed.json",
    JSON.stringify(
      {
        version: "https://jsonfeed.org/version/1.1",
        title: "GDCS — Game Development Cheat Sheet",
        home_page_url: SITE,
        feed_url: `${SITE}/feed.json`,
        items,
      },
      null,
      2
    )
  )

  await rm(path.join(root, "dist-server"), { recursive: true, force: true })
  console.log(
    `prerendered ${paths.length} routes, ${entry.sheets.length} markdown sheets`
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main()
}
