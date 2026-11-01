import { describe, expect, it } from "vite-plus/test"

import {
  bruteForceChecks,
  bruteForcePairs,
  gridPairs,
  SpatialGrid,
  type Circle,
} from "./spatial-grid"

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 2 ** 32
  }
}

function scatter(n: number, w: number, h: number, seed: number): Circle[] {
  const r = rng(seed)
  return Array.from({ length: n }, () => ({
    x: r() * w,
    y: r() * h,
    r: 0.1 + r() * 0.3,
  }))
}

const key = ([i, j]: [number, number]) => `${i}:${j}`

describe("SpatialGrid", () => {
  it.each([1, 2, 3, 4, 5])(
    "finds exactly the brute-force overlaps (seed %i)",
    (seed) => {
      const circles = scatter(200, 20, 12, seed)
      const grid = new SpatialGrid(20, 12, 0.8, 200)
      const { pairs } = gridPairs(circles, grid)
      const brute = new Set(bruteForcePairs(circles).map(key))
      const found = pairs.map(key)
      expect(new Set(found).size).toBe(found.length) // no duplicates
      for (const p of found) expect(brute.has(p)).toBe(true) // subset
      expect(found.length).toBe(brute.size) // and complete
    }
  )

  it("does far fewer tests than all pairs for a spread-out set", () => {
    const circles = scatter(400, 40, 40, 9)
    const { checks } = gridPairs(circles, new SpatialGrid(40, 40, 1, 400))
    expect(checks).toBeLessThan(bruteForceChecks(400) / 20)
  })

  it("visits each candidate pair once and never a circle with itself", () => {
    const circles = scatter(60, 4, 4, 3)
    const grid = new SpatialGrid(4, 4, 0.8, 60)
    grid.build(circles)
    const seen = new Set<string>()
    grid.candidates((i, j) => {
      expect(i).not.toBe(j)
      const k = i < j ? `${i}:${j}` : `${j}:${i}`
      expect(seen.has(k)).toBe(false)
      seen.add(k)
    })
  })

  it("clamps out-of-bounds circles into edge cells without missing overlaps", () => {
    const circles: Circle[] = [
      { x: -3, y: 1, r: 0.4 },
      { x: -2.6, y: 1.1, r: 0.4 },
      { x: 50, y: 50, r: 0.2 },
      { x: 50.1, y: 50, r: 0.2 },
    ]
    const { pairs } = gridPairs(circles, new SpatialGrid(10, 10, 1, 4))
    expect(pairs.map(key).sort()).toEqual(["0:1", "2:3"])
  })

  it("rejects cells smaller than a circle's diameter", () => {
    const grid = new SpatialGrid(10, 10, 0.5, 1)
    expect(() => grid.build([{ x: 1, y: 1, r: 0.3 }])).toThrow(RangeError)
  })

  it("counts occupancy per cell", () => {
    const grid = new SpatialGrid(4, 4, 1, 3)
    grid.build([
      { x: 0.5, y: 0.5, r: 0.1 },
      { x: 0.6, y: 0.4, r: 0.1 },
      { x: 3.5, y: 3.5, r: 0.1 },
    ])
    expect(grid.counts[0]).toBe(2)
    expect(grid.counts[15]).toBe(1)
    expect(grid.counts.reduce((a, b) => a + b, 0)).toBe(3)
  })
})
