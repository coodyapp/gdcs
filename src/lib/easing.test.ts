import { describe, expect, it } from "vite-plus/test"

import {
  ease,
  easings,
  inQuad,
  outBack,
  outQuad,
  reverse,
  slope,
  smoothstep,
} from "./easing"

describe("easing", () => {
  it.each(Object.entries(easings))("%s maps 0→0 and 1→1", (_, f) => {
    expect(f(0)).toBeCloseTo(0, 6)
    expect(f(1)).toBeCloseTo(1, 6)
  })

  it("quad family is monotonic on [0, 1]", () => {
    for (const f of [
      easings.inQuad,
      easings.outQuad,
      easings.inOutQuad,
      easings.inOutCubic,
    ]) {
      let prev = -Infinity
      for (let i = 0; i <= 100; i++) {
        const y = f(i / 100)
        expect(y).toBeGreaterThanOrEqual(prev)
        prev = y
      }
    }
  })

  it("in-out curves pass through the midpoint", () => {
    expect(easings.inOutQuad(0.5)).toBeCloseTo(0.5)
    expect(easings.inOutCubic(0.5)).toBeCloseTo(0.5)
    expect(easings.inOutSine(0.5)).toBeCloseTo(0.5)
    expect(smoothstep(0.5)).toBeCloseTo(0.5)
  })

  it("ease-in starts slow, ease-out ends slow", () => {
    expect(slope(inQuad, 0)).toBeLessThan(0.01)
    expect(slope(outQuad, 1)).toBeLessThan(0.01)
    expect(slope(smoothstep, 0)).toBeLessThan(0.01)
    expect(slope(smoothstep, 1)).toBeLessThan(0.01)
  })

  it("outBack overshoots past 1", () => {
    let max = 0
    for (let i = 0; i <= 100; i++) max = Math.max(max, outBack(i / 100))
    expect(max).toBeGreaterThan(1.05)
  })

  it("reverse turns in into out", () => {
    const out = reverse(inQuad)
    for (const t of [0, 0.25, 0.5, 0.9, 1])
      expect(out(t)).toBeCloseTo(outQuad(t))
  })

  it("ease clamps t and maps into [a, b]", () => {
    expect(ease(easings.linear, 2, 6, -1)).toBe(2)
    expect(ease(easings.linear, 2, 6, 2)).toBe(6)
    expect(ease(easings.linear, 2, 6, 0.5)).toBe(4)
  })
})
