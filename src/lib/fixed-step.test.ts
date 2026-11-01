import { describe, expect, it } from "vite-plus/test"

import { FixedStepper, interpolate } from "./fixed-step"

// Powers of two keep the float math exact.
const DT = 1 / 64

describe("FixedStepper", () => {
  it("takes two steps per frame when rendering at half the physics rate", () => {
    const s = new FixedStepper(DT)
    for (let i = 0; i < 10; i++) expect(s.advance(1 / 32, () => {})).toBe(2)
    expect(s.alpha).toBe(0)
  })

  it("alternates 0/1 steps when rendering at twice the physics rate", () => {
    const s = new FixedStepper(DT)
    const counts = Array.from({ length: 6 }, () => s.advance(1 / 128, () => {}))
    expect(counts).toEqual([0, 1, 0, 1, 0, 1])
  })

  it("total steps depend only on elapsed time, not on frame pattern", () => {
    const a = new FixedStepper(DT)
    const b = new FixedStepper(DT)
    let na = 0
    let nb = 0
    for (let i = 0; i < 64; i++) na += a.advance(1 / 64, () => {})
    const jittery = [1 / 128, 3 / 128, 1 / 32, 1 / 128, 3 / 128, 1 / 64]
    let t = 0
    for (let i = 0; t < 1; i++) {
      const f = Math.min(jittery[i % jittery.length], 1 - t)
      nb += b.advance(f, () => {})
      t += f
    }
    expect(na).toBe(64)
    expect(nb).toBe(64)
  })

  it("clamps long frames to avoid the spiral of death", () => {
    const s = new FixedStepper(DT, 0.25)
    expect(s.advance(5, () => {})).toBe(16) // 0.25 s / (1/64)
  })

  it("exposes the leftover as an interpolation alpha", () => {
    const s = new FixedStepper(DT)
    s.advance(DT * 2.5, () => {})
    expect(s.alpha).toBeCloseTo(0.5)
    expect(interpolate(10, 20, s.alpha)).toBeCloseTo(15)
  })
})
