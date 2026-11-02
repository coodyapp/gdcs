import { describe, expect, it } from "vite-plus/test"

import {
  clamp,
  damp,
  inverseLerp,
  lambdaFor,
  lerp,
  remap,
  smootherstep,
  smoothstep,
} from "./interp"

describe("lerp family", () => {
  it("lerp hits both endpoints and the midpoint", () => {
    expect(lerp(2, 10, 0)).toBe(2)
    expect(lerp(2, 10, 1)).toBe(10)
    expect(lerp(2, 10, 0.5)).toBe(6)
    expect(lerp(2, 10, 1.5)).toBe(14) // extrapolates
  })

  it("inverseLerp undoes lerp", () => {
    for (const t of [-0.5, 0, 0.3, 1, 2])
      expect(inverseLerp(-3, 7, lerp(-3, 7, t))).toBeCloseTo(t, 12)
    expect(inverseLerp(4, 4, 4)).toBe(0)
  })

  it("remap is invertible by swapping the ranges", () => {
    for (const v of [-10, 0, 12.5, 40]) {
      const r = remap(v, 0, 25, 100, 300)
      expect(remap(r, 100, 300, 0, 25)).toBeCloseTo(v, 10)
    }
    expect(remap(50, 0, 100, 1, 0)).toBe(0.5)
  })

  it("clamp bounds values", () => {
    expect(clamp(-1)).toBe(0)
    expect(clamp(2)).toBe(1)
    expect(clamp(5, 0, 10)).toBe(5)
  })
})

describe("smoothstep", () => {
  it.each([
    ["smoothstep", smoothstep],
    ["smootherstep", smootherstep],
  ])("%s: endpoints, midpoint, clamped and monotonic", (_, f) => {
    expect(f(0, 1, 0)).toBe(0)
    expect(f(0, 1, 1)).toBe(1)
    expect(f(0, 1, 0.5)).toBeCloseTo(0.5, 12)
    expect(f(0, 1, -3)).toBe(0)
    expect(f(0, 1, 9)).toBe(1)
    let prev = -Infinity
    for (let i = 0; i <= 200; i++) {
      const y = f(0, 1, i / 200)
      expect(y).toBeGreaterThanOrEqual(prev)
      prev = y
    }
  })

  it("has ~zero slope at the edges", () => {
    const h = 1e-4
    expect(smoothstep(0, 1, h) / h).toBeLessThan(1e-3)
    expect((1 - smoothstep(0, 1, 1 - h)) / h).toBeLessThan(1e-3)
    expect(smootherstep(0, 1, h) / h).toBeLessThan(1e-6)
  })

  it("respects custom edges", () => {
    expect(smoothstep(10, 20, 15)).toBeCloseTo(0.5, 12)
    expect(smoothstep(10, 20, 10)).toBe(0)
  })
})

describe("damp", () => {
  it("is frame-rate independent", () => {
    const lambda = 6
    let a = 0
    for (let i = 0; i < 30; i++) a = damp(a, 1, lambda, 1 / 30)
    let b = 0
    for (let i = 0; i < 144; i++) b = damp(b, 1, lambda, 1 / 144)
    expect(a).toBeCloseTo(b, 10)
    expect(a).toBeCloseTo(1 - Math.exp(-lambda), 10)
  })

  it("never overshoots and dt = 0 is a no-op", () => {
    expect(damp(0, 1, 50, 10)).toBeLessThanOrEqual(1)
    expect(damp(0.3, 1, 5, 0)).toBe(0.3)
  })

  it("lambdaFor closes the requested fraction in the given time", () => {
    const k = lambdaFor(0.99, 0.5)
    expect(damp(0, 1, k, 0.5)).toBeCloseTo(0.99, 10)
  })
})
