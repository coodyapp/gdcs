/**
 * Captures the first frame of the hero and footer fibers to public/posters, so the
 * page can show them instantly. Run against a running site after changing their look:
 *   node scripts/fiber-posters.ts [baseUrl=http://localhost:5199]
 * Needs Google Chrome and `cwebp` (brew install webp).
 */
import { execFileSync } from "node:child_process"
import { rm } from "node:fs/promises"
import path from "node:path"

import { chromium } from "playwright-core"

const out = path.resolve(import.meta.dirname, "..", "public", "posters")
const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const [base = "http://localhost:5199"] = process.argv.slice(2)

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
})
const SIZES = [
  { suffix: "", width: 1440, height: 900 },
  { suffix: "-phone", width: 390, height: 844 },
]
for (const { suffix, width, height } of SIZES) {
  const page = await browser.newPage({ viewport: { width, height } })
  await page.goto(`${base}/?poster=1`, { waitUntil: "networkidle" })
  // Only the canvas on the page colour: no text, overlays, mask or old poster.
  await page.addStyleTag({
    content: `body * { visibility: hidden !important; mask-image: none !important; }
      [data-fibers], [data-fibers] div, [data-fibers] canvas { visibility: visible !important; opacity: 1 !important; transition: none !important; }`,
  })
  for (const name of ["hero", "footer"]) {
    const el = page.locator(`[data-fibers="${name}"]`)
    await el.scrollIntoViewIfNeeded()
    await el.locator("canvas").waitFor({ state: "attached", timeout: 15000 })
    await page.waitForTimeout(800)
    const png = path.join(out, `fibers-${name}${suffix}.png`)
    await el.screenshot({ path: png })
    const webp = png.replace(/\.png$/, ".webp")
    execFileSync("cwebp", ["-quiet", "-q", "62", png, "-o", webp])
    await rm(png)
    console.log("poster", path.basename(webp))
  }
  await page.close()
}
await browser.close()
