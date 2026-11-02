import * as THREE from "three"
import { describe, expect, it } from "vite-plus/test"

import {
  bitangentFrom,
  buildFrame,
  cross,
  decodeNormal,
  dot,
  handedness,
  normalize,
  orthogonalize,
  tangentToWorld,
  triangleTangents,
  type V2,
  type V3,
} from "./tangent-space"

const close = (a: V3, b: V3) =>
  a.forEach((x, i) => expect(x).toBeCloseTo(b[i], 6))

// A unit right triangle in the XY plane, facing +Z.
const P: [V3, V3, V3] = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
]
const UV: [V2, V2, V2] = [
  [0, 0],
  [1, 0],
  [0, 1],
]
const MIRRORED: [V2, V2, V2] = [
  [1, 0],
  [0, 0],
  [1, 1],
]
const Z: V3 = [0, 0, 1]

describe("triangleTangents", () => {
  it("follows +U and +V on an axis-aligned UV triangle", () => {
    const r = triangleTangents(...P, ...UV)!
    close(r.tangent, [1, 0, 0])
    close(r.bitangent, [0, 1, 0])
  })

  it("follows UV directions rather than the triangle's edges", () => {
    // Rotated UVs: V rises along world +X and U falls along world +Y.
    const r = triangleTangents(...P, [1, 0], [1, 1], [0, 0])!
    close(r.tangent, [0, -1, 0])
    close(r.bitangent, [1, 0, 0])
  })

  it("is unchanged by UV scale and offset", () => {
    const r = triangleTangents(...P, [3, 5], [3.25, 5], [3, 5.5])!
    close(r.tangent, [1, 0, 0])
    close(r.bitangent, [0, 1, 0])
  })

  it("returns null for degenerate UVs", () => {
    expect(triangleTangents(...P, [0, 0], [1, 1], [2, 2])).toBeNull()
  })
})

describe("frame", () => {
  it("is orthonormal after Gram-Schmidt on a skewed triangle", () => {
    const r = triangleTangents(
      [0, 0, 0],
      [2, 0.3, 0.5],
      [0.4, 1.5, -0.2],
      [0.1, 0.2],
      [0.7, 0.3],
      [0.2, 0.9]
    )!
    // A smooth normal that is deliberately not the triangle's own normal.
    const { t, b, n } = buildFrame([0.2, -0.1, 1], r.tangent, r.bitangent)
    for (const axis of [t, b, n]) expect(dot(axis, axis)).toBeCloseTo(1, 6)
    expect(dot(t, n)).toBeCloseTo(0, 6)
    expect(dot(b, n)).toBeCloseTo(0, 6)
    expect(dot(t, b)).toBeCloseTo(0, 6)
  })

  it("orthogonalize keeps a tangent that is already perpendicular", () => {
    close(orthogonalize([1, 0, 0], Z), [1, 0, 0])
  })

  it("orthogonalize removes the component along the normal", () => {
    expect(dot(orthogonalize(normalize([1, 0, 1]), Z), Z)).toBeCloseTo(0, 6)
  })

  it("mirrored UVs flip the handedness, and B = w(N×T) recovers +V", () => {
    const plain = triangleTangents(...P, ...UV)!
    const mirror = triangleTangents(...P, ...MIRRORED)!
    expect(handedness(Z, plain.tangent, plain.bitangent)).toBe(1)
    expect(handedness(Z, mirror.tangent, mirror.bitangent)).toBe(-1)
    close(mirror.tangent, [-1, 0, 0])
    close(bitangentFrom(Z, mirror.tangent, -1), mirror.bitangent)
  })
})

describe("sampling", () => {
  it("decodes rgb to a signed direction", () => {
    close(decodeNormal([0.5, 0.5, 1]), Z)
    close(decodeNormal([1, 0.5, 0.5]), [1, 0, 0])
  })

  it("maps the flat sample to N and the axes to T and B", () => {
    const t: V3 = [0, 0, -1]
    const b: V3 = [1, 0, 0]
    const n: V3 = [0, -1, 0]
    close(tangentToWorld(Z, t, b, n), n)
    close(tangentToWorld([1, 0, 0], t, b, n), t)
    close(tangentToWorld([0, 1, 0], t, b, n), b)
  })

  it("survives rotation: rotating the frame rotates the result", () => {
    const m = new THREE.Matrix4().makeRotationFromEuler(
      new THREE.Euler(0.4, 1.1, -0.7)
    )
    const rot = (v: V3) =>
      new THREE.Vector3(...v).applyMatrix4(m).toArray() as V3
    const s = normalize([0.3, -0.2, 0.9])
    const t: V3 = [1, 0, 0]
    const b: V3 = [0, 1, 0]
    close(
      tangentToWorld(s, rot(t), rot(b), rot(Z)),
      rot(tangentToWorld(s, t, b, Z))
    )
  })
})

describe("agrees with BufferGeometry.computeTangents", () => {
  const compute = (uv: [V2, V2, V2]) => {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(P.flat(), 3))
    g.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3)
    )
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv.flat(), 2))
    g.setIndex([0, 1, 2])
    g.computeTangents()
    const a = g.getAttribute("tangent")
    return { t: [a.getX(0), a.getY(0), a.getZ(0)] as V3, w: a.getW(0) }
  }

  it.each([
    ["plain", UV, 1],
    ["mirrored", MIRRORED, -1],
  ] as const)("%s UVs", (_, uv, w) => {
    const ours = triangleTangents(...P, ...uv)!
    const three = compute(uv as [V2, V2, V2])
    close(three.t, ours.tangent)
    expect(three.w).toBe(w)
    expect(handedness(Z, ours.tangent, ours.bitangent)).toBe(three.w)
    close(cross(Z, three.t).map((x) => x * three.w) as V3, ours.bitangent)
  })
})
