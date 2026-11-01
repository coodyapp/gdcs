import { describe, expect, it } from "vite-plus/test"
import * as THREE from "three"

import {
  angleBetween,
  eulerLerp,
  fromEuler,
  slerp,
  sweptAngle,
  type Quat,
} from "./quat"

const deg = Math.PI / 180
const close = (a: Quat, b: Quat) =>
  a.forEach((x, i) => expect(x).toBeCloseTo(b[i], 6))

describe("quaternions", () => {
  it("fromEuler matches Three.js (XYZ order)", () => {
    const e = new THREE.Euler(0.4, -1.1, 2.3, "XYZ")
    const q = new THREE.Quaternion().setFromEuler(e)
    close(fromEuler(0.4, -1.1, 2.3), [q.x, q.y, q.z, q.w])
  })

  it("slerp hits both endpoints and stays unit length", () => {
    const a = fromEuler(0.2, 0.5, -0.3)
    const b = fromEuler(1.4, -0.7, 2.0)
    close(slerp(a, b, 0), a)
    for (let i = 0; i <= 10; i++) {
      const q = slerp(a, b, i / 10)
      expect(Math.hypot(...q)).toBeCloseTo(1, 6)
    }
    expect(angleBetween(slerp(a, b, 1), b)).toBeCloseTo(0, 5)
  })

  it("slerp turns at constant speed", () => {
    const a = fromEuler(0, 0, 0)
    const b = fromEuler(0, 2, 0)
    expect(angleBetween(a, slerp(a, b, 0.25))).toBeCloseTo(0.5, 5)
    expect(angleBetween(a, slerp(a, b, 0.5))).toBeCloseTo(1, 5)
  })

  it("shortest arc vs long arc add up to a full turn", () => {
    const a = fromEuler(0, 170 * deg, 0)
    const b = fromEuler(0, -170 * deg, 0)
    const short = sweptAngle((t) => slerp(a, b, t, true))
    const long = sweptAngle((t) => slerp(a, b, t, false))
    expect(short / deg).toBeCloseTo(20, 1)
    expect(long / deg).toBeCloseTo(340, 1)
  })

  it("Euler lerp across the ±180° seam takes the long way", () => {
    const swept = sweptAngle((t) =>
      eulerLerp([0, 170 * deg, 0], [0, -170 * deg, 0], t)
    )
    expect(swept / deg).toBeCloseTo(340, 0)
  })
})
