import { describe, expect, it } from "vite-plus/test"

import { createNoise2D, fbm2D, hashSeed, mulberry32 } from "./noise"

describe("mulberry32", () => {
  it("is deterministic per seed", () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 100; i++) expect(a()).toBe(b())
  })

  it("differs between seeds and stays in [0, 1)", () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    let same = 0
    let sum = 0
    for (let i = 0; i < 1000; i++) {
      const x = a()
      if (x === b()) same++
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
      sum += x
    }
    expect(same).toBe(0)
    expect(sum / 1000).toBeGreaterThan(0.45)
    expect(sum / 1000).toBeLessThan(0.55)
  })
})

describe("hashSeed", () => {
  it("is stable and spreads nearby strings", () => {
    expect(hashSeed("level-1")).toBe(hashSeed("level-1"))
    expect(hashSeed("level-1")).not.toBe(hashSeed("level-2"))
  })
})

describe("gradient noise", () => {
  it("is deterministic per seed and differs across seeds", () => {
    const a = createNoise2D(7)
    const b = createNoise2D(7)
    const c = createNoise2D(8)
    let diff = 0
    for (let i = 0; i < 50; i++) {
      const x = i * 0.37
      const y = i * 0.61
      expect(a(x, y)).toBe(b(x, y))
      diff += Math.abs(a(x, y) - c(x, y))
    }
    expect(diff).toBeGreaterThan(0.5)
  })

  it("stays in [-1, 1] and is zero on lattice points", () => {
    const n = createNoise2D(123)
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < 20000; i++) {
      const v = n(Math.sin(i) * 300, Math.cos(i * 1.3) * 300)
      min = Math.min(min, v)
      max = Math.max(max, v)
    }
    expect(min).toBeGreaterThanOrEqual(-1)
    expect(max).toBeLessThanOrEqual(1)
    expect(max - min).toBeGreaterThan(1)
    expect(n(3, -4)).toBeCloseTo(0)
  })

  it("is continuous", () => {
    const n = createNoise2D(5)
    expect(Math.abs(n(1.5, 2.5) - n(1.5001, 2.5))).toBeLessThan(0.01)
  })

  it("fbm stays in [-1, 1] for any octave count", () => {
    const n = createNoise2D(9)
    for (const octaves of [1, 3, 8]) {
      for (let i = 0; i < 2000; i++) {
        const v = fbm2D(n, i * 0.173, i * 0.091, { octaves })
        expect(Math.abs(v)).toBeLessThanOrEqual(1)
      }
    }
  })
})
