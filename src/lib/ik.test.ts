import { describe, expect, it } from "vite-plus/test"

import { fabrik, forwardKinematics, twoBoneIK, type P2 } from "./ik"

const dist = (a: P2, b: P2) => Math.hypot(b[0] - a[0], b[1] - a[1])

describe("forward kinematics", () => {
  it("accumulates relative angles", () => {
    const j = forwardKinematics([0, 0], [1, 1], [Math.PI / 2, -Math.PI / 2])
    expect(j[1][0]).toBeCloseTo(0, 12)
    expect(j[1][1]).toBeCloseTo(1, 12)
    expect(j[2][0]).toBeCloseTo(1, 12)
    expect(j[2][1]).toBeCloseTo(1, 12)
  })
})

describe("two-bone IK", () => {
  it("reaches every reachable target within 1e-6", () => {
    const base: P2 = [0.3, -0.2]
    for (let i = 0; i < 200; i++) {
      const a = i * 0.731
      const r = 0.25 + ((i * 0.37) % 1) * 2.1 // inside [|l1-l2|, l1+l2]
      const t: P2 = [base[0] + Math.cos(a) * r, base[1] + Math.sin(a) * r]
      for (const bend of [1, -1] as const) {
        const s = twoBoneIK(base, 1.3, 1.1, t, bend)
        expect(s.reached).toBe(true)
        expect(dist(s.joints[2], t)).toBeLessThan(1e-6)
        expect(dist(s.joints[0], s.joints[1])).toBeCloseTo(1.3, 9)
        expect(dist(s.joints[1], s.joints[2])).toBeCloseTo(1.1, 9)
      }
    }
  })

  it("bend flips the elbow to the other side", () => {
    const up = twoBoneIK([0, 0], 1, 1, [1.5, 0], 1)
    const down = twoBoneIK([0, 0], 1, 1, [1.5, 0], -1)
    expect(up.joints[1][1]).toBeCloseTo(-down.joints[1][1], 9)
    expect(up.joints[1][1]).not.toBeCloseTo(0, 3)
  })

  it("clamps unreachable targets to a straight arm pointing at them", () => {
    const s = twoBoneIK([0, 0], 1.3, 1.1, [3, 4])
    expect(s.reached).toBe(false)
    expect(s.angles[1]).toBeCloseTo(0, 9)
    expect(s.joints[2][0]).toBeCloseTo(2.4 * 0.6, 9)
    expect(s.joints[2][1]).toBeCloseTo(2.4 * 0.8, 9)
    const inner = twoBoneIK([0, 0], 1.3, 1.1, [0.05, 0])
    expect(inner.reached).toBe(false)
    expect(dist(inner.joints[0], inner.joints[2])).toBeCloseTo(0.2, 9)
  })
})

describe("FABRIK", () => {
  const chain = (): P2[] => [
    [0, 0],
    [0.7, 0],
    [1.3, 0],
    [1.9, 0],
    [2.4, 0],
  ]

  it("converges on reachable targets and keeps bone lengths", () => {
    const j = chain()
    const lengths = [0.7, 0.6, 0.6, 0.5]
    for (const t of [
      [1, 1.5],
      [-1.2, 0.4],
      [0.3, -2],
      [0.2, 0.1],
    ] as P2[]) {
      const r = fabrik(j, t, 1e-5, 50)
      expect(r.reached).toBe(true)
      expect(r.error).toBeLessThan(1e-5)
      j.slice(1).forEach((p, i) =>
        expect(dist(j[i], p)).toBeCloseTo(lengths[i], 9)
      )
      expect(j[0]).toEqual([0, 0])
    }
  })

  it("error shrinks monotonically", () => {
    const j = chain()
    let last = Infinity
    for (let i = 0; i < 8; i++) {
      const r = fabrik(j, [0.8, 1.6], 0, 1)
      expect(r.error).toBeLessThanOrEqual(last + 1e-12)
      last = r.error
    }
  })

  it("stretches straight toward unreachable targets", () => {
    const j = chain()
    const r = fabrik(j, [0, 5])
    expect(r.reached).toBe(false)
    expect(j[4][0]).toBeCloseTo(0, 9)
    expect(j[4][1]).toBeCloseTo(2.4, 9)
    expect(r.error).toBeCloseTo(2.6, 9)
  })
})
