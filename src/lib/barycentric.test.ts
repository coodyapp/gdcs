import { describe, expect, it } from "vite-plus/test"

import {
  barycentric,
  insideWeights,
  interpolate,
  interpolatePerspective,
  pointInTriangle,
  type Weights,
} from "./barycentric"

const A = [0, 0]
const B = [4, 0]
const C = [1, 3]

const sum = (w: Weights) => w[0] + w[1] + w[2]
const close = (w: Weights, x: number, y: number, z: number) => {
  expect(w[0]).toBeCloseTo(x, 10)
  expect(w[1]).toBeCloseTo(y, 10)
  expect(w[2]).toBeCloseTo(z, 10)
}
/** Signed 2D area, the definition the weights must agree with. */
const area = (p: number[], q: number[], r: number[]) =>
  ((q[0] - p[0]) * (r[1] - p[1]) - (r[0] - p[0]) * (q[1] - p[1])) / 2

describe("barycentric", () => {
  it("gives a unit weight at each corner", () => {
    close(barycentric(A, A, B, C), 1, 0, 0)
    close(barycentric(B, A, B, C), 0, 1, 0)
    close(barycentric(C, A, B, C), 0, 0, 1)
  })

  it("gives thirds at the centroid", () => {
    const g = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3]
    const third = 1 / 3
    close(barycentric(g, A, B, C), third, third, third)
  })

  it("gives one half on each end of an edge midpoint", () => {
    close(barycentric([2, 0], A, B, C), 0.5, 0.5, 0)
  })

  it("sums to 1, reconstructs the point and matches sub-triangle areas", () => {
    for (let x = -2; x <= 6; x += 0.7)
      for (let y = -2; y <= 5; y += 0.9) {
        const p = [x, y]
        const w = barycentric(p, A, B, C)
        expect(sum(w)).toBeCloseTo(1, 10)
        const back = interpolate(w, A, B, C, [0, 0])
        expect(back[0]).toBeCloseTo(x, 10)
        expect(back[1]).toBeCloseTo(y, 10)
        const total = area(A, B, C)
        expect(w[0]).toBeCloseTo(area(p, B, C) / total, 10)
        expect(w[1]).toBeCloseTo(area(A, p, C) / total, 10)
        expect(w[2]).toBeCloseTo(area(A, B, p) / total, 10)
      }
  })

  it("works in 3D and projects off-plane points onto the triangle", () => {
    const a = [0, 0, 0]
    const b = [2, 0, 0]
    const c = [0, 0, 2]
    close(barycentric([0.5, 3, 0.5], a, b, c), 0.5, 0.25, 0.25)
  })

  it("gives a negative weight for outside points", () => {
    const below = barycentric([2, -1], A, B, C)
    expect(below[2]).toBeLessThan(0)
    expect(sum(below)).toBeCloseTo(1, 10)
    expect(insideWeights(below)).toBe(false)
  })

  it("writes into out without allocating a new array", () => {
    const out: Weights = [0, 0, 0]
    expect(barycentric(C, A, B, C, out)).toBe(out)
  })

  it.each([
    ["all corners equal", [1, 1], [1, 1], [1, 1]],
    ["two corners equal", [0, 0], [0, 0], [3, 2]],
    ["collinear corners", [0, 0], [1, 1], [2, 2]],
  ])("stays finite on a degenerate triangle: %s", (_, a, b, c) => {
    const w = barycentric([5, -3], a, b, c)
    expect(w.every(Number.isFinite)).toBe(true)
    expect(sum(w)).toBe(1)
  })

  it("treats a nearly flat triangle at large scale as degenerate", () => {
    const w = barycentric([5, 5], [0, 0], [1e6, 1e6], [2e6, 2e6 + 1e-7])
    expect(w).toEqual([1, 0, 0])
  })
})

describe("pointInTriangle", () => {
  it("accepts interior, edge and corner points", () => {
    expect(pointInTriangle([1.5, 1], A, B, C)).toBe(true)
    expect(pointInTriangle([2, 0], A, B, C)).toBe(true)
    expect(pointInTriangle(C, A, B, C)).toBe(true)
  })

  it("rejects points outside each edge", () => {
    expect(pointInTriangle([2, -0.01], A, B, C)).toBe(false)
    expect(pointInTriangle([-1, 1], A, B, C)).toBe(false)
    expect(pointInTriangle([4, 3], A, B, C)).toBe(false)
  })

  it("contains nothing when the triangle is degenerate", () => {
    expect(pointInTriangle([5, -3], [0, 0], [1, 1], [2, 2])).toBe(false)
    expect(pointInTriangle([1, 1], [0, 0], [1, 1], [2, 2])).toBe(false)
  })

  it("does not depend on winding", () => {
    expect(pointInTriangle([1.5, 1], A, C, B)).toBe(true)
    expect(pointInTriangle([2, -1], A, C, B)).toBe(false)
  })
})

describe("interpolate", () => {
  it("returns each vertex's value at its corner and blends between", () => {
    const uvA = [0, 0]
    const uvB = [1, 0]
    const uvC = [0, 1]
    expect(interpolate([0, 1, 0], uvA, uvB, uvC, [0, 0])).toEqual([1, 0])
    expect(interpolate([0.5, 0.25, 0.25], uvA, uvB, uvC, [0, 0])).toEqual([
      0.25, 0.25,
    ])
  })
})

describe("interpolatePerspective", () => {
  it("matches the plain blend when all depths are equal", () => {
    const w: Weights = [0.2, 0.3, 0.5]
    expect(interpolatePerspective(w, [1, 2, 3], [4, 4, 4])).toBeCloseTo(2.3, 10)
  })

  it("pulls the screen midpoint of an edge toward the near vertex", () => {
    // Near end has w = 1, far end w = 3: halfway on screen is only a quarter
    // of the way along the edge in 3D.
    const mid = interpolatePerspective([0.5, 0.5, 0], [0, 1, 0], [1, 3, 1])
    expect(mid).toBeCloseTo(0.25, 10)
  })

  it("keeps the exact vertex value at a corner", () => {
    expect(interpolatePerspective([0, 0, 1], [7, 8, 9], [1, 2, 5])).toBe(9)
  })
})
