/// <reference lib="dom" />
/**
 * Builds the icons and default social card in public/ from the logos in
 * src/assets/brand. Run after changing a logo: node scripts/brand-assets.ts
 * Needs Google Chrome.
 */
import { readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import { chromium } from "playwright-core"

const root = path.resolve(import.meta.dirname, "..")
const pub = (file: string) => path.join(root, "public", file)
const dataUri = async (file: string, mime: string) =>
  `data:${mime};base64,${(await readFile(path.join(root, file))).toString("base64")}`

const symbol = await dataUri(
  "src/assets/brand/logo-symbol-no-bg.png",
  "image/png"
)
const logo = await dataUri("src/assets/brand/logo-no-bg.png", "image/png")
const calSans = await dataUri(
  "src/assets/fonts/CalSans-SemiBold.woff2",
  "font/woff2"
)

const BG = "#0a0a0a"
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ??
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
})

/** Bounding box of the solid part of an image, ignoring the faint glitch trails. */
async function solidBox(src: string) {
  const page = await browser.newPage()
  const box = await page.evaluate(async (url) => {
    const img = new Image()
    img.src = url
    await img.decode()
    const c = document.createElement("canvas")
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    const ctx = c.getContext("2d", { willReadFrequently: true })!
    ctx.drawImage(img, 0, 0)
    const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height)
    const cols = new Array<number>(width).fill(0)
    const rows = new Array<number>(height).fill(0)
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (data[(y * width + x) * 4 + 3] > 200) {
          cols[x]++
          rows[y]++
        }
    // A column or row only counts when enough of it is solid, which drops stray flecks.
    const first = (a: number[], min: number) => a.findIndex((n) => n >= min)
    const last = (a: number[], min: number) =>
      a.length - 1 - [...a].reverse().findIndex((n) => n >= min)
    const minX = Math.max(3, height * 0.01)
    const minY = Math.max(3, width * 0.01)
    return {
      x0: first(cols, minX),
      x1: last(cols, minX),
      y0: first(rows, minY),
      y1: last(rows, minY),
      w: width,
      h: height,
    }
  }, src)
  await page.close()
  return box
}

const box = await solidBox(symbol)
console.log("symbol solid box", box)

/** The symbol centred on its solid part, which fills `share` of the icon's width. */
async function icon(size: number, share: number, radius: number, file: string) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
  })
  const scale = (size * share) / (box.x1 - box.x0)
  const left = size / 2 - scale * (box.x0 + box.x1) * 0.5
  const top = size / 2 - scale * (box.y0 + box.y1) * 0.5
  await page.setContent(`<!doctype html><html style="background:transparent"><body style="margin:0">
    <div style="position:relative;width:${size}px;height:${size}px;overflow:hidden;background:${BG};border-radius:${radius}%">
      <img src="${symbol}" style="position:absolute;left:${left}px;top:${top}px;width:${box.w * scale}px;height:${box.h * scale}px">
    </div></body></html>`)
  await page.locator("img").evaluate((i: HTMLImageElement) => i.decode())
  await page.screenshot({ path: pub(file), omitBackground: true })
  await page.close()
  console.log(file)
}

// Tab icons get more of the symbol and soft corners. Home screens round them
// themselves, so those are square, and the maskable one stays in the safe zone.
await icon(16, 0.92, 18, "favicon-16x16.png")
await icon(32, 0.88, 18, "favicon-32x32.png")
await icon(48, 0.86, 18, "favicon-48x48.tmp.png")
await icon(180, 0.72, 0, "apple-touch-icon.png")
await icon(192, 0.72, 0, "android-chrome-192x192.png")
await icon(512, 0.72, 0, "android-chrome-512x512.png")
await icon(512, 0.58, 0, "android-chrome-maskable-512x512.png")

// favicon.ico: PNG images in an ICO container.
const sizes = [
  [16, "favicon-16x16.png"],
  [32, "favicon-32x32.png"],
  [48, "favicon-48x48.tmp.png"],
] as const
const pngs = await Promise.all(sizes.map(([, f]) => readFile(pub(f))))
const header = Buffer.alloc(6 + 16 * sizes.length)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(sizes.length, 4)
let offset = header.length
sizes.forEach(([size], i) => {
  const entry = 6 + 16 * i
  header.writeUInt8(size, entry)
  header.writeUInt8(size, entry + 1)
  header.writeUInt16LE(1, entry + 4)
  header.writeUInt16LE(32, entry + 6)
  header.writeUInt32LE(pngs[i].length, entry + 8)
  header.writeUInt32LE(offset, entry + 12)
  offset += pngs[i].length
})
await writeFile(pub("favicon.ico"), Buffer.concat([header, ...pngs]))
await rm(pub("favicon-48x48.tmp.png"))
console.log("favicon.ico")

// Default social card.
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(`<!doctype html><html><head><style>
  @font-face { font-family: "Cal Sans"; src: url("${calSans}") format("woff2"); }
  body { margin: 0; width: 1200px; height: 630px; background: ${BG}; color: #fafafa;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-family: "Cal Sans", sans-serif; text-align: center; }
  img { width: 720px; margin-bottom: 8px; }
  h1 { margin: 0; font-size: 68px; font-weight: 600; letter-spacing: -0.02em; }
  p { margin: 18px 0 0; font: 400 28px/1.3 -apple-system, "Helvetica Neue", Arial, sans-serif; color: #a3a3a3; }
</style></head><body>
  <img src="${logo}" alt="">
  <h1>Game Development Cheat Sheet</h1>
  <p>Visual, AI-ready cheat sheets with a simulation you can play with</p>
</body></html>`)
await page.evaluate(() => document.fonts.ready)
await page.locator("img").evaluate((i: HTMLImageElement) => i.decode())
await page.screenshot({ path: pub("og.png") })
console.log("og.png")
await browser.close()
