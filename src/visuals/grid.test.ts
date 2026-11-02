import { describe, expect, it } from "vite-plus/test"

import { gridPlacement } from "./grid"

describe("gridPlacement", () => {
  it("lies flat as a floor for a view from an angle", () => {
    const grid = gridPlacement([6, 4, 6], [0, 0, 0])
    expect(grid.rotation).toEqual([0, 0, 0])
    expect(grid.position[1]).toBeLessThan(0)
  })

  it("lies flat for a view from straight above", () => {
    expect(gridPlacement([0, 10, 0], [0, 0, 0]).rotation).toEqual([0, 0, 0])
  })

  it("faces a camera looking along z and sits behind the target", () => {
    const grid = gridPlacement([1, 2, 10], [1, 2, 0])
    expect(grid.rotation[0]).toBeCloseTo(Math.PI / 2)
    expect(grid.position[2]).toBeLessThan(0)
    expect(grid.position.slice(0, 2)).toEqual([1, 2])
    expect(gridPlacement([0, 0, -10], [0, 0, 0]).position[2]).toBeGreaterThan(0)
  })

  it("faces a camera looking along x and sits behind the target", () => {
    const grid = gridPlacement([10, 0, 0], [0, 0, 0])
    expect(grid.rotation[2]).toBeCloseTo(Math.PI / 2)
    expect(grid.position[0]).toBeLessThan(0)
  })
})
