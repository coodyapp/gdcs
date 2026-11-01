import { describe, expect, it } from "vite-plus/test"

import { attackPhase, boxesOverlap, HitRegistry } from "./hitbox"

const fd = { startup: 5, active: 3, recovery: 10 }

describe("hitbox helpers", () => {
  it("maps frames to phases", () => {
    expect(attackPhase(0, fd)).toBe("startup")
    expect(attackPhase(4, fd)).toBe("startup")
    expect(attackPhase(5, fd)).toBe("active")
    expect(attackPhase(7, fd)).toBe("active")
    expect(attackPhase(8, fd)).toBe("recovery")
    expect(attackPhase(18, fd)).toBe("done")
  })

  it("registers one hit per target per swing", () => {
    const reg = new HitRegistry()
    reg.begin()
    // Overlap during all three active frames still yields one hit.
    const hits = [5, 6, 7].filter(() => reg.tryHit(1)).length
    expect(hits).toBe(1)
    expect(reg.tryHit(2)).toBe(true) // a different target can still be hit
    reg.begin()
    expect(reg.tryHit(1)).toBe(true)
  })

  it("treats touching edges as not overlapping", () => {
    const a = { minX: 0, minY: 0, maxX: 1, maxY: 1 }
    expect(boxesOverlap(a, { minX: 1, minY: 0, maxX: 2, maxY: 1 })).toBe(false)
    expect(boxesOverlap(a, { minX: 0.9, minY: 0.5, maxX: 2, maxY: 1 })).toBe(
      true
    )
  })
})
