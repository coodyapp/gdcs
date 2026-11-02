import * as THREE from "three"
import { describe, expect, it } from "vite-plus/test"

import {
  aabbOverlap,
  boundsOf,
  boxVolume,
  COMPOUND,
  emptyFraction,
  enclosingRadius,
  type M3,
  obbOverlap,
  refitAabb,
  rotationAxisAngle,
  solidVolume,
  sphereOverlap,
  sphereVolume,
  transformPoint,
  type Aabb,
  type Box,
  type Obb,
  type V3,
} from "./bounding-volumes"

const IDENTITY: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]
const SIGNS = [-1, 1]
const newAabb = (): Aabb => ({ min: [0, 0, 0], max: [0, 0, 0] })

/** Small deterministic PRNG so failures reproduce. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

function randomRotation(r: () => number): M3 {
  const axis = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize()
  return rotationAxisAngle([axis.x, axis.y, axis.z], r() * Math.PI * 2, [])
}

function randomObb(r: () => number): Obb {
  return {
    center: [r() * 6 - 3, r() * 6 - 3, r() * 6 - 3],
    half: [0.2 + r() * 1.5, 0.2 + r() * 1.5, 0.2 + r() * 1.5],
    rot: randomRotation(r),
  }
}

function corners(o: Obb): V3[] {
  const out: V3[] = []
  for (const x of SIGNS)
    for (const y of SIGNS)
      for (const z of SIGNS) {
        const p: V3 = [x * o.half[0], y * o.half[1], z * o.half[2]]
        out.push(transformPoint(o.rot, p, o.center, [0, 0, 0]))
      }
  return out
}

const axisOf = (o: Obb, i: number) =>
  new THREE.Vector3(o.rot[i], o.rot[3 + i], o.rot[6 + i])

/** Independent SAT: project all 8 corners of both boxes on all 15 axes. */
function bruteForceOverlap(a: Obb, b: Obb) {
  const axes: THREE.Vector3[] = []
  for (let i = 0; i < 3; i++) axes.push(axisOf(a, i), axisOf(b, i))
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      axes.push(new THREE.Vector3().crossVectors(axisOf(a, i), axisOf(b, j)))
  const ca = corners(a)
  const cb = corners(b)
  for (const axis of axes) {
    if (axis.lengthSq() < 1e-12) continue
    const project = (cs: V3[]) =>
      cs.map((c) => axis.x * c[0] + axis.y * c[1] + axis.z * c[2])
    const pa = project(ca)
    const pb = project(cb)
    if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa))
      return false
  }
  return true
}

describe("rotationAxisAngle", () => {
  it("matches Three.js", () => {
    const r = rng(1)
    for (let n = 0; n < 50; n++) {
      const axis = new THREE.Vector3(
        r() - 0.5,
        r() - 0.5,
        r() - 0.5
      ).normalize()
      const angle = r() * 7
      const R = rotationAxisAngle([axis.x, axis.y, axis.z], angle, [])
      const e = new THREE.Matrix4().makeRotationAxis(axis, angle).elements
      // Three.js stores column-major.
      const expected = [e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]]
      R.forEach((x, i) => expect(x).toBeCloseTo(expected[i], 10))
    }
  })
})

describe("refitAabb", () => {
  it("leaves the box alone at identity, apart from the translation", () => {
    const out = refitAabb(
      { center: [1, 0, 0], half: [2, 1, 0.5] },
      IDENTITY,
      [0, 3, 0],
      newAabb()
    )
    expect(out.min).toEqual([-1, 2, -0.5])
    expect(out.max).toEqual([3, 4, 0.5])
  })

  it("grows by √2 at 45° about Z for a square box", () => {
    const R = rotationAxisAngle([0, 0, 1], Math.PI / 4, [])
    const out = refitAabb(
      { center: [0, 0, 0], half: [1, 1, 1] },
      R,
      [0, 0, 0],
      newAabb()
    )
    expect(out.max[0]).toBeCloseTo(Math.SQRT2, 10)
    expect(out.max[1]).toBeCloseTo(Math.SQRT2, 10)
    expect(out.max[2]).toBeCloseTo(1, 10)
  })

  it("equals the AABB of the 8 transformed corners", () => {
    const r = rng(2)
    for (let n = 0; n < 200; n++) {
      const o = randomObb(r)
      const t: V3 = [r() * 4 - 2, r() * 4 - 2, r() * 4 - 2]
      const center: V3 = [r() - 0.5, r() - 0.5, r() - 0.5]
      const out = refitAabb({ center, half: o.half }, o.rot, t, newAabb())
      const world = corners({
        ...o,
        center: transformPoint(o.rot, center, t, [0, 0, 0]),
      })
      for (let i = 0; i < 3; i++) {
        const axis = world.map((c) => c[i])
        expect(out.min[i]).toBeCloseTo(Math.min(...axis), 9)
        expect(out.max[i]).toBeCloseTo(Math.max(...axis), 9)
      }
    }
  })

  it("the sheet's Three.js version matches Box3.applyMatrix4", () => {
    // Keep in step with the first code block of the sheet.
    function refit(local: THREE.Box3, m: THREE.Matrix4, out: THREE.Box3) {
      const e = m.elements // column-major: e[col * 4 + row]
      for (let i = 0; i < 3; i++) {
        let min = e[12 + i]
        let max = e[12 + i]
        for (let j = 0; j < 3; j++) {
          const a = e[j * 4 + i] * local.min.getComponent(j)
          const b = e[j * 4 + i] * local.max.getComponent(j)
          min += Math.min(a, b)
          max += Math.max(a, b)
        }
        out.min.setComponent(i, min)
        out.max.setComponent(i, max)
      }
      return out
    }
    const r = rng(3)
    for (let n = 0; n < 100; n++) {
      const local = new THREE.Box3(
        new THREE.Vector3(-r(), -r(), -r()),
        new THREE.Vector3(r(), r(), r())
      )
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(r() * 4, r() * 4, r() * 4),
        new THREE.Quaternion().random(),
        new THREE.Vector3(0.5 + r(), 0.5 + r(), 0.5 + r())
      )
      const expected = local.clone().applyMatrix4(m)
      const got = refit(local, m, new THREE.Box3())
      expect(got.min.distanceTo(expected.min)).toBeLessThan(1e-9)
      expect(got.max.distanceTo(expected.max)).toBeLessThan(1e-9)
    }
  })

  it("grows when wrongly re-fitted from its own world box", () => {
    const local: Box = { center: [0, 0, 0], half: [2, 1, 1] }
    const R = rotationAxisAngle([0, 0, 1], 0.5, [])
    const once = refitAabb(local, R, [0, 0, 0], newAabb())
    const fromWorld = refitAabb(
      { center: [0, 0, 0], half: [once.max[0], once.max[1], once.max[2]] },
      R,
      [0, 0, 0],
      newAabb()
    )
    expect(fromWorld.max[0]).toBeGreaterThan(once.max[0])
    expect(refitAabb(local, R, [0, 0, 0], newAabb())).toEqual(once)
  })
})

describe("overlap tests", () => {
  const box = (min: V3, max: V3): Aabb => ({ min, max })

  it("AABB needs overlap on every axis", () => {
    const a = box([0, 0, 0], [1, 1, 1])
    expect(aabbOverlap(a, box([0.5, 0.5, 0.5], [2, 2, 2]))).toBe(true)
    expect(aabbOverlap(a, box([2, 0, 0], [3, 1, 1]))).toBe(false)
    expect(aabbOverlap(a, box([0, 2, 0], [1, 3, 1]))).toBe(false)
    expect(aabbOverlap(a, box([0, 0, 2], [1, 1, 3]))).toBe(false)
    expect(aabbOverlap(a, box([1, 1, 1], [2, 2, 2]))).toBe(true) // touching
    expect(aabbOverlap(a, box([0.2, 0.2, 0.2], [0.4, 0.4, 0.4]))).toBe(true)
  })

  it("sphere compares against the squared sum of radii", () => {
    const a = { center: [0, 0, 0] as V3, radius: 2 }
    expect(sphereOverlap(a, { center: [3, 0, 0], radius: 1.5 })).toBe(true)
    expect(sphereOverlap(a, { center: [3, 0, 0], radius: 1 })).toBe(true) // touching
    // r² + r² would wrongly report a hit here (d² = 10 < 4 + 9 = 13).
    expect(sphereOverlap(a, { center: [3, 1, 0], radius: 1 })).toBe(false)
  })

  it("OBB finds a separation that only an edge cross product reveals", () => {
    // Bars along X and Y, each rolled 45° about its own length and offset in
    // Z. Only X × Y = Z separates them; no face normal of either box does.
    const a: Obb = {
      center: [0, 0, 0],
      half: [3, 0.1, 0.1],
      rot: rotationAxisAngle([1, 0, 0], Math.PI / 4, []),
    }
    const b: Obb = {
      center: [0, 0, 0.3],
      half: [0.1, 3, 0.1],
      rot: rotationAxisAngle([0, 1, 0], Math.PI / 4, []),
    }
    const faceAxes = [0, 1, 2].flatMap((i) => [axisOf(a, i), axisOf(b, i)])
    for (const axis of faceAxes) {
      const project = (o: Obb) =>
        corners(o).map((c) => axis.dot(new THREE.Vector3(...c)))
      expect(Math.max(...project(a))).toBeGreaterThan(Math.min(...project(b)))
      expect(Math.max(...project(b))).toBeGreaterThan(Math.min(...project(a)))
    }
    expect(obbOverlap(a, b)).toBe(false)
    // Their Z reach is 0.1·√2 each, so 0.25 apart they do overlap.
    expect(obbOverlap(a, { ...b, center: [0, 0, 0.25] })).toBe(true)
  })

  it("OBB agrees with an independent 15-axis projection", () => {
    const r = rng(4)
    let hits = 0
    let misses = 0
    for (let n = 0; n < 2000; n++) {
      const a = randomObb(r)
      const b = randomObb(r)
      const got = obbOverlap(a, b)
      expect(got).toBe(bruteForceOverlap(a, b))
      if (got) hits++
      else misses++
    }
    // The sample must exercise both outcomes to mean anything.
    expect(hits).toBeGreaterThan(100)
    expect(misses).toBeGreaterThan(100)
  })

  it("OBB never misses a real overlap", () => {
    const r = rng(5)
    for (let n = 0; n < 500; n++) {
      const a = randomObb(r)
      const b = randomObb(r)
      // A random interior point of A that also lies in B proves an overlap.
      const local: V3 = [
        (r() * 2 - 1) * a.half[0],
        (r() * 2 - 1) * a.half[1],
        (r() * 2 - 1) * a.half[2],
      ]
      const p = transformPoint(a.rot, local, a.center, [0, 0, 0])
      const d = [p[0] - b.center[0], p[1] - b.center[1], p[2] - b.center[2]]
      const inB = [0, 1, 2].every(
        (i) =>
          Math.abs(
            d[0] * b.rot[i] + d[1] * b.rot[3 + i] + d[2] * b.rot[6 + i]
          ) <= b.half[i]
      )
      if (inB) expect(obbOverlap(a, b)).toBe(true)
    }
  })
})

describe("volumes and tightness", () => {
  const local = boundsOf(COMPOUND)

  it("the demo parts do not overlap, so their volumes simply add", () => {
    for (let i = 0; i < COMPOUND.length; i++)
      for (let j = i + 1; j < COMPOUND.length; j++)
        for (let k = 0; k < 3; k++) {
          const a = COMPOUND[i]
          const b = COMPOUND[j]
          const gap =
            Math.abs(a.center[k] - b.center[k]) - (a.half[k] + b.half[k])
          if (gap >= -1e-9) break // separated or touching on this axis
          expect(k, `parts ${i} and ${j} overlap`).toBeLessThan(2)
        }
  })

  it("computes box and sphere volumes", () => {
    expect(boxVolume([1, 2, 3])).toBeCloseTo(48)
    expect(sphereVolume(2)).toBeCloseTo((32 / 3) * Math.PI)
    expect(solidVolume([{ center: [0, 0, 0], half: [1, 1, 1] }])).toBe(8)
  })

  it("the local box contains every part and touches each face", () => {
    for (let i = 0; i < 3; i++) {
      const lo = local.center[i] - local.half[i]
      const hi = local.center[i] + local.half[i]
      const mins = COMPOUND.map((p) => p.center[i] - p.half[i])
      const maxs = COMPOUND.map((p) => p.center[i] + p.half[i])
      expect(Math.min(...mins)).toBeCloseTo(lo, 10)
      expect(Math.max(...maxs)).toBeCloseTo(hi, 10)
    }
  })

  it("the enclosing sphere contains every corner and touches the farthest", () => {
    const radius = enclosingRadius(COMPOUND, local.center)
    let far = 0
    for (const p of COMPOUND)
      for (const x of SIGNS)
        for (const y of SIGNS)
          for (const z of SIGNS)
            far = Math.max(
              far,
              Math.hypot(
                p.center[0] + x * p.half[0] - local.center[0],
                p.center[1] + y * p.half[1] - local.center[1],
                p.center[2] + z * p.half[2] - local.center[2]
              )
            )
    expect(radius).toBeCloseTo(far, 10)
  })

  it("clamps the empty fraction", () => {
    expect(emptyFraction(1, 4)).toBeCloseTo(0.75)
    expect(emptyFraction(4, 4)).toBe(0)
    expect(emptyFraction(5, 4)).toBe(0)
    expect(emptyFraction(1, 0)).toBe(0)
  })

  it("orders tightness: OBB beats any rotated AABB, sphere is loosest here", () => {
    const solid = solidVolume(COMPOUND)
    const obb = emptyFraction(solid, boxVolume(local.half))
    const sphere = emptyFraction(
      solid,
      sphereVolume(enclosingRadius(COMPOUND, local.center))
    )
    const out = newAabb()
    const R = rotationAxisAngle([0, 0, 1], Math.PI / 4, [])
    refitAabb(local, R, [0, 0, 0], out)
    const half: V3 = [
      (out.max[0] - out.min[0]) / 2,
      (out.max[1] - out.min[1]) / 2,
      (out.max[2] - out.min[2]) / 2,
    ]
    const aabb = emptyFraction(solid, boxVolume(half))
    expect(obb).toBeLessThan(aabb)
    expect(aabb).toBeLessThan(sphere)
  })
})
