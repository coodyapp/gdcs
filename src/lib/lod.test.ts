import { describe, expect, it } from "vite-plus/test"

import { projectedSize, selectLod } from "./lod"

const SWITCH = [4, 8]

describe("selectLod", () => {
  it("picks the level whose band contains the distance", () => {
    expect(selectLod(1, SWITCH, 0)).toBe(0)
    expect(selectLod(4, SWITCH, 0)).toBe(1)
    expect(selectLod(7.9, SWITCH, 0)).toBe(1)
    expect(selectLod(20, SWITCH, 0)).toBe(2)
  })

  it("holds the coarser level inside the hysteresis band", () => {
    // Already at level 1: 3.7 is below 4 but above 4 * (1 - 0.1) = 3.6.
    expect(selectLod(3.7, SWITCH, 1, 0.1)).toBe(1)
    expect(selectLod(3.5, SWITCH, 1, 0.1)).toBe(0)
    // Coming from level 0 the plain threshold applies.
    expect(selectLod(3.7, SWITCH, 0, 0.1)).toBe(0)
  })

  it("does not flicker when distance jitters around a threshold", () => {
    let level = 0
    const seen = new Set<number>()
    for (let i = 0; i < 200; i++) {
      level = selectLod(4 + Math.sin(i) * 0.2, SWITCH, level, 0.1)
      if (i > 10) seen.add(level)
    }
    expect(seen.size).toBe(1)
  })
})

describe("projectedSize", () => {
  it("halves when distance doubles", () => {
    const a = projectedSize(1, 10, 50, 1080)
    const b = projectedSize(1, 20, 50, 1080)
    expect(a / b).toBeCloseTo(2)
  })
})
