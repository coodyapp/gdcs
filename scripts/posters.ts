/**
 * Captures a static poster of every sheet's visual (default parameters) to
 * public/posters/<slug>.webp. Run against a running site:
 *   pnpm posters [baseUrl=http://localhost:5199] [slug...]
 * Needs Google Chrome and `cwebp` (brew install webp).
 */
import { execFileSync } from "node:child_process"
import { mkdir, readdir, readFile, rm } from "node:fs/promises"
import path from "node:path"

import { chromium } from "playwright-core"

const root = path.resolve(import.meta.dirname, "..")
const out = path.join(root, "public", "posters")
const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

const [base = "http://localhost:5199", ...only] = process.argv.slice(2)
// Sheet URLs straight from the content files: /<category>/<subcategory>/<slug>.
const sheetsDir = path.join(root, "src", "content", "sheets")
let pages: string[] = []
for (const category of await readdir(sheetsDir)) {
  for (const file of await readdir(path.join(sheetsDir, category))) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue
    const source = await readFile(path.join(sheetsDir, category, file), "utf8")
    const sub = /subcategory:\s*"([^"]+)"/.exec(source)?.[1]
    if (sub) pages.push(`/${category}/${sub}/${file.replace(/\.ts$/, "")}`)
  }
}
if (only.length) pages = pages.filter((p) => only.includes(p.split("/").pop()!))

await mkdir(out, { recursive: true })
const browser = await chromium.launch({
  executablePath: CHROME,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
})
// < 640 px wide: the stage uses its 16:10 card aspect; DPR 2 for crisp posters.
const page = await browser.newPage({
  viewport: { width: 600, height: 900 },
  deviceScaleFactor: 2,
})
let failed = 0
for (const p of pages) {
  const slug = p.split("/").pop()!
  try {
    await page.goto(`${base}${p}?poster=1`, { waitUntil: "networkidle" })
    const stage = page.locator(".visual-stage").first()
    await stage.locator("canvas").waitFor({ timeout: 15000 })
    await page.waitForTimeout(2200) // let the default animation reach a representative frame
    const png = path.join(out, `${slug}.png`)
    await stage.screenshot({ path: png })
    execFileSync("cwebp", [
      "-quiet",
      "-q",
      "72",
      "-resize",
      "960",
      "0",
      png,
      "-o",
      path.join(out, `${slug}.webp`),
    ])
    await rm(png)
    console.log("poster", slug)
  } catch (error) {
    failed++
    console.error("FAILED", slug, (error as Error).message.split("\n")[0])
  }
}
await browser.close()
if (failed) process.exit(1)
