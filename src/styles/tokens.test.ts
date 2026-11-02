import { describe, expect, it } from "vite-plus/test"

import { light, neutral, sim, surfaces, text } from "./tokens"

const lum = (hex: string) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
const SURFACES = [surfaces.bg, surfaces.card, surfaces.surface2]
const hue = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return Math.max(r, g, b) - Math.min(r, g, b)
}

describe("design tokens (WCAG 2.2 AA, Coody neutrals)", () => {
  it.each(
    Object.entries({
      ...sim,
      ...text,
      white: neutral.white,
      light: neutral.light,
      mid: neutral.mid,
    })
  )("%s (%s) is ≥ 4.5:1 on every surface", (_, hex) => {
    for (const s of SURFACES)
      expect(contrast(hex, s)).toBeGreaterThanOrEqual(4.5)
  })
  it.each([light.text, light.secondary])(
    "light mode text %s is ≥ 4.5:1 on every light surface",
    (hex) => {
      for (const s of [light.bg, light.card, light.muted])
        expect(contrast(hex, s)).toBeGreaterThanOrEqual(4.5)
    }
  )
  it("neutrals are greys (no hue)", () => {
    for (const hex of [
      ...Object.values(neutral),
      ...Object.values(text),
      ...Object.values(surfaces),
    ]) {
      expect(hue(hex)).toBeLessThanOrEqual(12)
    }
  })
  it("simulation hues are exactly green, yellow and red", () => {
    expect(Object.keys(sim).sort()).toEqual(["green", "red", "yellow"])
  })
  it("red and green stay distinguishable in lightness for colour-blind users", () => {
    expect(Math.abs(lum(sim.green) - lum(sim.red))).toBeGreaterThan(0.2)
  })
})
