import { describe, expect, it } from "vite-plus/test"
import * as THREE from "three"

import {
  chain,
  eulerMatrix,
  identity,
  invert,
  isGimbalLocked,
  multiply,
  rotation,
  scaling,
  transformPoint,
  translation,
  type EulerOrder,
  type Mat4,
  type Vec3,
} from "./transforms"

const close = (a: number[], b: number[], digits = 6) =>
  a.forEach((x, i) => expect(x).toBeCloseTo(b[i], digits))
const deg = Math.PI / 180

describe("transforms", () => {
  const T = translation(3, 0, 0)
  const R = rotation("Y", 90 * deg)
  const S = scaling(2)

  it("composition order matters: T·R·S ≠ R·T·S", () => {
    const trs = chain(T, R, S)
    const rts = chain(R, T, S)
    // Origin of the object lands at T for T·R·S, but orbits for R·T·S.
    close(transformPoint(trs, [0, 0, 0]), [3, 0, 0])
    close(transformPoint(rts, [0, 0, 0]), [0, 0, -3])
    expect(trs).not.toEqual(rts)
  })

  it("T·R·S scales, then rotates, then translates", () => {
    // (1,0,0) → scale (2,0,0) → rotate 90° about Y (0,0,-2) → move (3,0,-2)
    close(transformPoint(chain(T, R, S), [1, 0, 0]), [3, 0, -2])
  })

  it("matches THREE.Matrix4 for multiply and compose", () => {
    const q = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      90 * deg
    )
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(3, 0, 0),
      q,
      new THREE.Vector3(2, 2, 2)
    )
    close(chain(T, R, S), m.elements)
  })

  it("inverse(M)·M = I", () => {
    const m: Mat4 = chain(
      translation(1.5, -2, 0.7),
      eulerMatrix([0.3, -1.1, 2.2], "YXZ"),
      scaling(0.5, 2, 1.3)
    )
    const inv = invert(m)!
    close(multiply(inv, m), identity())
    close(multiply(m, inv), identity())
    const p: Vec3 = [0.2, 4, -1]
    close(transformPoint(inv, transformPoint(m, p)), p)
  })

  it("returns null for a singular matrix", () => {
    expect(invert(scaling(1, 0, 1))).toBeNull()
  })

  it("eulerMatrix matches THREE for every order", () => {
    const orders: EulerOrder[] = ["XYZ", "XZY", "YXZ", "YZX", "ZXY", "ZYX"]
    const a: Vec3 = [0.4, -0.9, 1.7]
    for (const order of orders) {
      const ref = new THREE.Matrix4().makeRotationFromEuler(
        new THREE.Euler(a[0], a[1], a[2], order)
      )
      close(eulerMatrix(a, order), ref.elements)
    }
  })

  it("detects gimbal lock on the middle axis only", () => {
    expect(isGimbalLocked([0.3, 90 * deg, 0.1], "XYZ")).toBe(true)
    expect(isGimbalLocked([0.3, -90 * deg, 0.1], "XYZ")).toBe(true)
    expect(isGimbalLocked([90 * deg, 0.2, 0.1], "XYZ")).toBe(false)
    expect(isGimbalLocked([90 * deg, 0.2, 0.1], "YXZ")).toBe(true)
    expect(isGimbalLocked([0.3, 80 * deg, 0.1], "XYZ")).toBe(false)
  })

  it("at lock, outer and inner angles collapse into one degree of freedom", () => {
    // XYZ with Y = 90°: only x + z matters.
    const a = eulerMatrix([0.4, 90 * deg, 0.3], "XYZ")
    const b = eulerMatrix([0.9, 90 * deg, -0.2], "XYZ")
    close(a, b)
    // Away from lock the same change gives a different orientation.
    const c = eulerMatrix([0.4, 45 * deg, 0.3], "XYZ")
    const d = eulerMatrix([0.9, 45 * deg, -0.2], "XYZ")
    expect(Math.max(...c.map((x, i) => Math.abs(x - d[i])))).toBeGreaterThan(
      0.1
    )
  })
})
