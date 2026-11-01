import { describe, expect, it } from "vite-plus/test"

import {
  segmentAabb,
  sphereAabbOverlap,
  sweptSphereAabb,
  sweptSphereSphere,
} from "./swept"

const v = (x: number, y = 0, z = 0) => ({ x, y, z })
// A 0.1-thick wall at x = 0.
const MIN = v(-0.05, -2, -2)
const MAX = v(0.05, 2, 2)

describe("swept collision", () => {
  it("catches a fast bullet that a discrete test misses", () => {
    const r = 0.05
    const speed = 60 // units per second
    const dt = 1 / 60 // → 1 unit per tick, far more than wall + bullet size
    let x = -2.3
    let discreteHit = false
    let sweptHit: number | null = null
    for (let i = 0; i < 5 && sweptHit === null; i++) {
      const next = x + speed * dt
      if (sphereAabbOverlap(v(next), r, MIN, MAX)) discreteHit = true
      const t = sweptSphereAabb(v(x), v(next), r, MIN, MAX)
      if (t !== null) sweptHit = x + (next - x) * t
      x = next
    }
    expect(discreteHit).toBe(false)
    expect(sweptHit).not.toBeNull()
    expect(sweptHit!).toBeCloseTo(-0.1) // surface (−0.05) minus radius
  })

  it("segment vs box reports entry time and misses", () => {
    expect(segmentAabb(v(-1), v(1), MIN, MAX)).toBeCloseTo(0.475)
    expect(segmentAabb(v(-1, 3), v(1, 3), MIN, MAX)).toBeNull()
    expect(segmentAabb(v(-1), v(-0.5), MIN, MAX)).toBeNull()
    expect(segmentAabb(v(0), v(1), MIN, MAX)).toBe(0) // starts inside
  })

  it("swept sphere vs sphere finds first contact", () => {
    const t = sweptSphereSphere(v(-5), v(5), 0.5, v(0), 1)
    expect(t).toBeCloseTo(0.35) // contact when centre at x = −1.5
    expect(sweptSphereSphere(v(-5, 3), v(5, 3), 0.5, v(0), 1)).toBeNull()
    expect(sweptSphereSphere(v(5), v(10), 0.5, v(0), 1)).toBeNull() // moving away
  })
})
