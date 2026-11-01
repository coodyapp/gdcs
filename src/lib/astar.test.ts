import { describe, expect, it } from "vite-plus/test"

import { astar, heuristic, MinHeap, parseGrid } from "./astar"

describe("MinHeap", () => {
  it("pops keys in ascending order", () => {
    const h = new MinHeap()
    const keys = [5, 1, 9, 3, 3, 7, 0, 8]
    keys.forEach((k, i) => h.push(i, k))
    const out: number[] = []
    while (h.size) out.push(keys[h.pop()])
    expect(out).toEqual([...keys].sort((a, b) => a - b))
  })
})

describe("heuristics", () => {
  it("octile equals exact 8-way distance on an open grid", () => {
    expect(heuristic("octile", 0, 0, 3, 5)).toBeCloseTo(2 + 3 * Math.SQRT2)
    expect(heuristic("manhattan", 0, 0, 3, 5)).toBe(8)
  })
})

describe("astar", () => {
  const map = [
    "S....#....",
    ".###.#.##.",
    ".#...#..#.",
    ".#.###..#.",
    ".#......#G",
  ]

  it("finds an optimal 4-way path (same cost as Dijkstra)", () => {
    const { grid, start, goal } = parseGrid(map)
    const a = astar(grid, start, goal)
    const d = astar(grid, start, goal, { heuristic: "zero" })
    expect(a.path).not.toBeNull()
    expect(a.cost).toBe(d.cost)
    expect(a.path!.length - 1).toBe(a.cost)
    expect(a.expanded.length).toBeLessThanOrEqual(d.expanded.length)
    // Path is contiguous and avoids walls.
    for (let i = 1; i < a.path!.length; i++) {
      const p = a.path![i - 1]
      const q = a.path![i]
      expect(
        Math.abs((p % 10) - (q % 10)) +
          Math.abs(((p / 10) | 0) - ((q / 10) | 0))
      ).toBe(1)
      expect(grid.walls[q]).toBe(0)
    }
  })

  it("8-way octile path is optimal and never cuts corners", () => {
    const { grid, start, goal } = parseGrid(["S..", ".#.", "..G"])
    const r = astar(grid, start, goal, { diagonal: true })
    // The wall in the middle blocks both diagonals through it: 4 straight steps.
    expect(r.cost).toBe(4)
    const open = parseGrid(["S...", "....", "...G"])
    const r2 = astar(open.grid, open.start, open.goal, { diagonal: true })
    expect(r2.cost).toBeCloseTo(1 + 2 * Math.SQRT2)
  })

  it("returns null on a blocked grid", () => {
    const { grid, start, goal } = parseGrid(["S.#..", "..#..", "..#.G"])
    const r = astar(grid, start, goal)
    expect(r.path).toBeNull()
    expect(r.cost).toBe(Infinity)
    expect(r.expanded.length).toBe(6) // explored the whole left pocket
  })
})
