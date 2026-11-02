import { describe, expect, it } from "vite-plus/test"

import {
  aabbsOverlap,
  bruteForcePairs,
  circleContact,
  gridPairs,
  pairCount,
  scatterCircles,
  spheresOverlap,
  SpatialGrid,
  typicalCandidates,
} from "./collision-detection"

const key = ([i, j]: [number, number]) => `${i}:${j}`
const W = 10
const H = 5.6

describe("broad phase", () => {
  it.each([
    [1, 30, 0.7],
    [2, 30, 1.2],
    [3, 60, 0.7],
    [4, 60, 2],
    [5, 200, 0.7],
    [6, 200, 4],
  ])(
    "grid finds exactly the brute-force overlaps (seed %i, n %i, cell %f)",
    (seed, n, cell) => {
      const circles = scatterCircles(n, W, H, 0.2, 0.34, seed)
      const grid = new SpatialGrid(W, H, cell, n, -W / 2, -H / 2)
      const { pairs, checks } = gridPairs(circles, grid)
      const brute = bruteForcePairs(circles).map(key).sort()
      expect(brute.length).toBeGreaterThan(0)
      expect(pairs.map(key).sort()).toEqual(brute)
      expect(checks).toBeLessThanOrEqual(pairCount(n))
    }
  )

  it("visits each candidate pair once", () => {
    const circles = scatterCircles(60, W, H, 0.2, 0.34, 9)
    const grid = new SpatialGrid(W, H, 1.2, 60, -W / 2, -H / 2)
    grid.build(circles)
    const seen = new Set<string>()
    const checks = grid.candidates((i, j) =>
      seen.add(key(i < j ? [i, j] : [j, i]))
    )
    expect(seen.size).toBe(checks)
  })

  it("discards most pairs at the visual's defaults", () => {
    const tested = typicalCandidates(30, W, H, 0.2, 0.34, 1.2)
    expect(tested).toBeLessThan(pairCount(30) / 3)
    expect(tested).toBeGreaterThan(0)
  })

  it("loses the saving when cells cover the whole box", () => {
    expect(typicalCandidates(30, W, H, 0.2, 0.34, 4)).toBeGreaterThan(
      pairCount(30) * 0.8
    )
  })
})

describe("pairCount", () => {
  it.each([
    [1, 0],
    [2, 1],
    [30, 435],
    [1000, 499500],
  ])("%i objects have %i pairs", (n, pairs) => {
    expect(pairCount(n)).toBe(pairs)
  })
})

describe("narrow phase", () => {
  it("sphere test compares centre distance to the radius sum", () => {
    const a = { x: 0, y: 0, z: 0, r: 1 }
    expect(spheresOverlap(a, { x: 1, y: 1, z: 1, r: 1 })).toBe(true) // d ≈ 1.73
    expect(spheresOverlap(a, { x: 2, y: 0, z: 0, r: 1 })).toBe(false) // touching
    expect(spheresOverlap(a, { x: 2, y: 2, z: 0, r: 1 })).toBe(false) // d ≈ 2.83
  })

  it("AABB test needs overlap on every axis", () => {
    const box = (x: number, y: number, z: number) => ({
      minX: x,
      minY: y,
      minZ: z,
      maxX: x + 1,
      maxY: y + 1,
      maxZ: z + 1,
    })
    expect(aabbsOverlap(box(0, 0, 0), box(0.5, 0.5, 0.5))).toBe(true)
    expect(aabbsOverlap(box(0, 0, 0), box(2, 0, 0))).toBe(false)
    expect(aabbsOverlap(box(0, 0, 0), box(0, 2, 0))).toBe(false)
    expect(aabbsOverlap(box(0, 0, 0), box(0, 0, 2))).toBe(false)
  })

  it("contact gives a unit normal from a to b and the penetration depth", () => {
    const out = { nx: 0, ny: 0, depth: 0 }
    const a = { x: 0, y: 0, r: 1 }
    expect(circleContact(a, { x: 3, y: 4, r: 5 }, out)).toBe(true)
    expect(out.nx).toBeCloseTo(0.6)
    expect(out.ny).toBeCloseTo(0.8)
    expect(out.depth).toBeCloseTo(1)
    expect(circleContact(a, { x: 3, y: 0, r: 1 }, out)).toBe(false)
  })

  it("coincident centres do not produce NaN", () => {
    const out = { nx: 0, ny: 0, depth: 0 }
    const c = { x: 1, y: 1, r: 1 }
    expect(circleContact(c, c, out)).toBe(true)
    expect(out).toEqual({ nx: 1, ny: 0, depth: 2 })
  })
})
