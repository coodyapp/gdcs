import { describe, expect, it } from "vite-plus/test"

import {
  applyImpulse,
  boxInertia,
  createBox,
  integrate,
  kineticEnergy,
  resolvePlane,
} from "./rigid-body"

const GROUND = { nx: 0, ny: 1, d: 0 }

describe("rigid body", () => {
  it("uses the box inertia formula", () => {
    expect(boxInertia(12, 1, 2)).toBeCloseTo(5, 12)
  })

  it("off-centre impulses spin with the sign of r × J", () => {
    const above = createBox(1, 1, 2)
    applyImpulse(above, 3, 0, 0, 0.5) // push right, above the centre
    expect(above.omega).toBeLessThan(0) // clockwise
    expect(above.vx).toBeCloseTo(1.5, 12)

    const below = createBox(1, 1, 2)
    applyImpulse(below, 3, 0, 0, -0.5)
    expect(below.omega).toBeGreaterThan(0) // counter-clockwise
    expect(below.omega).toBeCloseTo(-above.omega, 12)

    const centred = createBox(1, 1, 2)
    applyImpulse(centred, 3, 0, 0, 0)
    expect(centred.omega).toBe(0)
  })

  it("semi-implicit Euler updates velocity before position", () => {
    const b = createBox(1, 1, 1, 0, 10)
    integrate(b, 0.5, 0, -10)
    expect(b.vy).toBe(-5)
    expect(b.y).toBe(7.5) // uses the new velocity
  })

  it("never gains energy on contact when e ≤ 1", () => {
    for (const e of [0, 0.3, 0.7, 1]) {
      for (const mu of [0, 0.5, 1]) {
        for (const angle of [0, 0.3, 0.8]) {
          const b = createBox(1.2, 0.8, 1, 0, 0.3)
          b.angle = angle
          b.vx = 1.5
          b.vy = -4
          b.omega = 2
          const before = kineticEnergy(b)
          resolvePlane(b, GROUND, e, mu)
          expect(kineticEnergy(b)).toBeLessThanOrEqual(before + 1e-9)
        }
      }
    }
  })

  it("never gains energy over many random contacts", () => {
    let seed = 7
    const rnd = () =>
      ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
    for (let i = 0; i < 500; i++) {
      const b = createBox(1.2, 0.8, 1, 0, 0.35 + rnd() * 0.2)
      b.angle = rnd() * Math.PI
      b.vx = rnd() * 5
      b.vy = rnd() * 6
      b.omega = rnd() * 8
      const before = kineticEnergy(b)
      resolvePlane(b, GROUND, Math.abs(rnd()), Math.abs(rnd()))
      expect(kineticEnergy(b)).toBeLessThanOrEqual(before + 1e-9)
    }
  })

  it("bounces a flat box with the restitution ratio and no spin", () => {
    const b = createBox(1, 1, 1, 0, 0.49)
    b.vy = -3
    resolvePlane(b, GROUND, 0.5, 0)
    expect(b.vy).toBeCloseTo(1.5, 6)
    expect(b.omega).toBeCloseTo(0, 6)
    expect(b.y).toBeCloseTo(0.5, 12) // pushed out of the floor
  })

  it("comes to rest on the floor", () => {
    const b = createBox(1, 1, 1, 0, 2)
    b.vx = 2
    b.omega = 3
    for (let i = 0; i < 1200; i++) {
      integrate(b, 1 / 120)
      resolvePlane(b, GROUND, 0.4, 0.6)
    }
    expect(Math.hypot(b.vx, b.vy)).toBeLessThan(0.05)
    expect(Math.abs(b.omega)).toBeLessThan(0.05)
  })
})
