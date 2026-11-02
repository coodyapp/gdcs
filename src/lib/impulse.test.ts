import { describe, expect, it } from "vite-plus/test"

import { headOnCollision, inverseMass, resolveCollision } from "./impulse"

const MASSES = [0.1, 0.5, 1, 3, 7.5, 40, 1000]
const RESTITUTIONS = [0, 0.25, 0.6, 1]

const pairs = () =>
  MASSES.flatMap((m1) =>
    MASSES.flatMap((m2) => RESTITUTIONS.map((e) => [m1, m2, e] as const))
  )

const collide = (m1: number, m2: number, e: number, v1: number, v2: number) => {
  const a = { v: v1, invMass: 1 / m1 }
  const b = { v: v2, invMass: 1 / m2 }
  const j = resolveCollision(a, b, e)
  return { a, b, j }
}

describe("resolveCollision", () => {
  it("conserves momentum for any masses and restitution", () => {
    for (const [m1, m2, e] of pairs()) {
      const { a, b } = collide(m1, m2, e, 4, -1.5)
      const before = m1 * 4 + m2 * -1.5
      const tolerance = 1e-9 * Math.max(1, Math.abs(m1 * 4), Math.abs(m2 * 1.5))
      expect(
        Math.abs(m1 * a.v + m2 * b.v - before),
        `${m1} ${m2} ${e}`
      ).toBeLessThan(tolerance)
    }
  })

  it("conserves kinetic energy at e = 1", () => {
    for (const m1 of MASSES)
      for (const m2 of MASSES) {
        const { a, b } = collide(m1, m2, 1, 4, -1.5)
        const before = 0.5 * (m1 * 16 + m2 * 2.25)
        const after = 0.5 * (m1 * a.v * a.v + m2 * b.v * b.v)
        expect(Math.abs(after - before) / before).toBeLessThan(1e-9)
      }
  })

  it("gives equal final velocities at e = 0", () => {
    for (const m1 of MASSES)
      for (const m2 of MASSES) {
        const { a, b } = collide(m1, m2, 0, 4, -1.5)
        expect(a.v).toBeCloseTo(b.v, 9)
      }
  })

  it("reverses relative velocity scaled by e", () => {
    for (const [m1, m2, e] of pairs()) {
      const { a, b } = collide(m1, m2, e, 4, -1.5)
      expect(b.v - a.v).toBeCloseTo(e * 5.5, 9)
    }
  })

  it("never moves an infinite mass", () => {
    const wall = { v: 0, invMass: inverseMass(Infinity) }
    const ball = { v: 5, invMass: 1 / 2 }
    const j = resolveCollision(ball, wall, 0.5)
    expect(wall.v).toBe(0)
    expect(ball.v).toBeCloseTo(-2.5)
    expect(j).toBeCloseTo(15) // m·Δv = 2 × 7.5
  })

  it("ignores separating bodies and static pairs", () => {
    expect(collide(1, 1, 0.5, -1, 1).j).toBe(0)
    const a = { v: 3, invMass: 0 }
    const b = { v: -3, invMass: 0 }
    expect(resolveCollision(a, b, 1)).toBe(0)
    expect([a.v, b.v]).toEqual([3, -3])
  })

  it("is safe to call twice for one contact when e = 0", () => {
    const a = { v: 2, invMass: 1 }
    const b = { v: -2, invMass: 1 }
    resolveCollision(a, b, 0)
    expect(resolveCollision(a, b, 0)).toBe(0)
  })
})

describe("headOnCollision", () => {
  it("matches the hand-worked default case", () => {
    const r = headOnCollision(3, 1, 0.6, 3)
    expect(r.vA).toBeCloseTo(0.6)
    expect(r.vB).toBeCloseTo(4.2)
    expect(r.j).toBeCloseTo(7.2)
    expect(r.pBefore).toBeCloseTo(6)
    expect(r.pAfter).toBeCloseTo(6)
    expect(r.keLost).toBeCloseTo(8.64)
  })

  it("loses ½μ(1 − e²)v² of kinetic energy", () => {
    for (const [m1, m2, e] of pairs()) {
      const reduced = (m1 * m2) / (m1 + m2)
      const r = headOnCollision(m1, m2, e, 2)
      expect(r.keLost).toBeCloseTo(0.5 * reduced * (1 - e * e) * 16, 6)
    }
  })
})
