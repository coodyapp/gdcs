import { describe, expect, it } from "vite-plus/test"

import {
  boxInverseInertia,
  inverseInertiaWorld,
  parallelAxis,
  pointMassesInertia,
  rodCentre,
  rodEnd,
  rotorInertia,
  solidBox,
  solidCylinder,
  solidSphere,
  spinFromMomentum,
  spinFromTorque,
  type Mat3Tuple,
} from "./inertia"

describe("moment of inertia", () => {
  it("sums m r² for point masses", () => {
    const masses = [
      { m: 1, r: 2 },
      { m: 3, r: 1 },
    ]
    expect(pointMassesInertia(masses)).toBeCloseTo(7, 12)
    expect(pointMassesInertia([])).toBe(0)
  })

  it("quadruples when the radius doubles", () => {
    expect(rotorInertia(1, 2) / rotorInertia(1, 1)).toBeCloseTo(4, 12)
  })

  it("matches the standard shape formulas", () => {
    expect(solidSphere(5, 2)).toBeCloseTo(8, 12)
    expect(solidCylinder(4, 3)).toBeCloseTo(18, 12)
    expect(solidBox(12, 1, 2)).toBeCloseTo(5, 12)
    expect(rodCentre(12, 2)).toBeCloseTo(4, 12)
    expect(rodEnd(3, 2)).toBeCloseTo(4, 12)
  })

  it("moves a rod's axis from its centre to its end with the parallel axis theorem", () => {
    const m = 3
    const length = 2
    expect(parallelAxis(rodCentre(m, length), m, length / 2)).toBeCloseTo(
      rodEnd(m, length),
      12
    )
  })

  it("converges a discretised rod to the closed form", () => {
    const n = 2000
    const dm = 1 / n
    const slices = Array.from({ length: n }, (_, i) => ({
      m: dm,
      r: ((i + 0.5) / n - 0.5) * 2,
    }))
    expect(pointMassesInertia(slices)).toBeCloseTo(rodCentre(1, 2), 5)
  })

  it("gives the same torque less spin on a larger rotor", () => {
    const near = spinFromTorque(0.8, rotorInertia(1, 0.5), 5)
    const wide = spinFromTorque(0.8, rotorInertia(1, 1.8), 5)
    expect(near).toBeCloseTo(8, 12)
    expect(near / wide).toBeCloseTo(12.96, 12)
  })

  it("conserves L = Iω when the radius changes", () => {
    const L = 3
    for (const r of [0.5, 1, 1.8]) {
      const inertia = rotorInertia(1, r)
      expect(inertia * spinFromMomentum(L, inertia)).toBeCloseTo(L, 12)
    }
    expect(spinFromMomentum(L, rotorInertia(1, 0.5))).toBeCloseTo(6, 12)
  })
})

describe("inverse inertia tensor", () => {
  const IDENTITY: Mat3Tuple = [1, 0, 0, 0, 1, 0, 0, 0, 1]
  // 90° about +z: local x maps to world y, local y to world -x.
  const QUARTER_Z: Mat3Tuple = [0, -1, 0, 1, 0, 0, 0, 0, 1]

  it("uses the two perpendicular extents on each box axis", () => {
    const [ix, iy, iz] = boxInverseInertia(12, 1, 2, 3)
    expect(ix).toBeCloseTo(1 / 13, 12)
    expect(iy).toBeCloseTo(1 / 10, 12)
    expect(iz).toBeCloseTo(1 / 5, 12)
  })

  it("keeps the diagonal unchanged under the identity rotation", () => {
    expect(inverseInertiaWorld(IDENTITY, [1, 2, 3])).toEqual([
      1, 0, 0, 0, 2, 0, 0, 0, 3,
    ])
  })

  it("swaps the x and y terms after a quarter turn about z", () => {
    const world = inverseInertiaWorld(QUARTER_Z, [1, 2, 3])
    expect(world[0]).toBeCloseTo(2, 12)
    expect(world[4]).toBeCloseTo(1, 12)
    expect(world[8]).toBeCloseTo(3, 12)
  })

  it("is symmetric for an arbitrary rotation", () => {
    const c = Math.cos(0.7)
    const s = Math.sin(0.7)
    const aboutX: Mat3Tuple = [1, 0, 0, 0, c, -s, 0, s, c]
    const w = inverseInertiaWorld(aboutX, [1, 2, 3])
    expect(w[5]).toBeCloseTo(w[7], 12)
    expect(w[1]).toBeCloseTo(w[3], 12)
    // The trace is rotation-invariant.
    expect(w[0] + w[4] + w[8]).toBeCloseTo(6, 12)
  })

  it("keeps a static body static with a zero inverse", () => {
    expect(
      inverseInertiaWorld(QUARTER_Z, [0, 0, 0]).every((x) => x === 0)
    ).toBe(true)
  })
})
