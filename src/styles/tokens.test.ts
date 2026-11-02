import { describe, expect, it } from "vite-plus/test"

import { categoryAccent, sim, surfaces, text, uiBlue } from "./tokens"

const lum = (hex: string) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
export const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
const SURFACES = [surfaces.bg, surfaces.card, surfaces.surface2]

describe("design tokens (WCAG 2.2 AA)", () => {
  const readable = {
    ...sim,
    uiBlue,
    ...categoryAccent,
    meta: text.meta,
    secondary: text.secondary,
  }
  it.each(Object.entries(readable))(
    "%s (%s) is ≥ 4.5:1 on every surface",
    (_, hex) => {
      for (const s of SURFACES)
        expect(contrast(hex, s)).toBeGreaterThanOrEqual(4.5)
    }
  )
  it("focus ring (cyan) is ≥ 3:1 on every surface", () => {
    for (const s of SURFACES)
      expect(contrast(sim.cyan, s)).toBeGreaterThanOrEqual(3)
  })
  it("primary text avoids pure white glare but stays ≥ 15:1", () => {
    expect(text.primary).not.toBe("#ffffff")
    expect(contrast(text.primary, surfaces.bg)).toBeGreaterThan(15)
  })
})
