/**
 * Builds the 1200×630 social card of every sheet to public/og/<slug>.jpg from
 * its poster and title. Run after `pnpm posters`:
 *   pnpm og [slug...]
 * Needs Google Chrome (same as scripts/posters.ts).
 */
import { mkdir, readdir, readFile } from "node:fs/promises"
import path from "node:path"

import { chromium } from "playwright-core"

const root = path.resolve(import.meta.dirname, "..")
const out = path.join(root, "public", "og")
const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

const only = process.argv.slice(2)
const dataUrl = async (file: string, type: string) =>
  `data:${type};base64,${(await readFile(file)).toString("base64")}`
const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;")

/** Title and hook straight from the content file (first match is the sheet's own). */
const field = (source: string, name: string) => {
  const match = new RegExp(
    `\\b${name}:\\s*\\n?\\s*("(?:[^"\\\\]|\\\\.)*")`
  ).exec(source)
  return match ? (JSON.parse(match[1]) as string) : ""
}

const font = await dataUrl(
  path.join(root, "src/assets/fonts/CalSans-SemiBold.woff2"),
  "font/woff2"
)

const sheetsDir = path.join(root, "src", "content", "sheets")
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
})
await mkdir(out, { recursive: true })
let failed = 0
for (const category of await readdir(sheetsDir)) {
  for (const file of await readdir(path.join(sheetsDir, category))) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue
    const slug = file.replace(/\.ts$/, "")
    if (only.length && !only.includes(slug)) continue
    try {
      const source = await readFile(
        path.join(sheetsDir, category, file),
        "utf8"
      )
      const title = field(source, "title")
      const hook = field(source, "hook")
      if (!title) throw new Error("no title found")
      const poster = await dataUrl(
        path.join(root, "public", "posters", `${slug}.webp`),
        "image/webp"
      )
      await page.setContent(`<!doctype html><html><head><style>
        @font-face { font-family: "Cal Sans"; src: url(${font}) format("woff2"); }
        * { margin: 0; box-sizing: border-box; }
        body { width: 1200px; height: 630px; background: #0a0a0a; color: #fafafa;
          font-family: "Cal Sans", sans-serif; overflow: hidden; position: relative; }
        img { position: absolute; top: 0; right: 0; width: 760px; height: 630px; object-fit: cover; }
        .fade { position: absolute; inset: 0;
          background: linear-gradient(90deg, #0a0a0a 44%, rgb(10 10 10 / 0.72) 62%, transparent 86%); }
        .copy { position: absolute; inset: 64px auto 64px 64px; width: 660px;
          display: flex; flex-direction: column; }
        .brand { font-size: 30px; }
        h1 { margin-top: auto; font-size: 72px; line-height: 1.04; font-weight: 600; text-wrap: balance; }
        p { margin-top: 22px; font: 400 28px/1.35 ui-sans-serif, system-ui, sans-serif; color: #a3a3a3; text-wrap: pretty; }
        p::first-letter { text-transform: uppercase; }
      </style></head><body>
        <img src="${poster}" alt="" /><div class="fade"></div>
        <div class="copy"><div class="brand">GDCS</div>
          <h1>${escapeHtml(title)}</h1><p>${escapeHtml(hook)}</p></div>
      </body></html>`)
      await page.evaluate("document.fonts.ready")
      await page.screenshot({
        path: path.join(out, `${slug}.jpg`),
        type: "jpeg",
        quality: 82,
      })
      console.log("og", slug)
    } catch (error) {
      failed++
      console.error("FAILED", slug, (error as Error).message.split("\n")[0])
    }
  }
}
await browser.close()
if (failed) process.exit(1)
