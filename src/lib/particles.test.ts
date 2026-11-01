import { describe, expect, it } from "vite-plus/test"

import { emitCount, ParticleBuffer } from "./particles"

describe("ParticleBuffer", () => {
  it("reaches a steady state of rate × lifetime", () => {
    const buf = new ParticleBuffer(2000)
    const carry = { carry: 0 }
    const dt = 1 / 64
    for (let i = 0; i < 64 * 5; i++) {
      buf.update(dt, 9.8)
      const n = emitCount(carry, 200, dt)
      for (let k = 0; k < n; k++) buf.spawn(1.5)
    }
    expect(Math.abs(buf.count - 300)).toBeLessThanOrEqual(4)
  })

  it("never exceeds capacity", () => {
    const buf = new ParticleBuffer(10)
    for (let k = 0; k < 20; k++) buf.spawn(1)
    expect(buf.count).toBe(10)
    expect(buf.spawn(1)).toBe(-1)
  })

  it("swap-removes dead particles and keeps the survivors' data", () => {
    const buf = new ParticleBuffer(4)
    const lives = [0.1, 5, 0.1, 5]
    lives.forEach((l, k) => {
      const i = buf.spawn(l)
      buf.px[i] = k
    })
    buf.update(0.2, 0)
    expect(buf.count).toBe(2)
    expect(Array.from(buf.px.subarray(0, 2)).sort()).toEqual([1, 3])
  })

  it("emitCount carries fractions across frames", () => {
    const s = { carry: 0 }
    const total = Array.from({ length: 10 }, () =>
      emitCount(s, 25, 0.01)
    ).reduce((a, b) => a + b)
    expect(total).toBe(2) // 10 × 0.25 = 2.5 → 2 emitted, 0.5 carried
    expect(s.carry).toBeCloseTo(0.5)
  })
})
