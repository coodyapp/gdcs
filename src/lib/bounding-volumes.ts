/**
 * Bounding volumes: AABB, OBB and sphere, their overlap tests, the abs-matrix
 * (Arvo) AABB re-fit, and the volume figures behind a tightness percentage.
 * Functions that run per frame write into `out` and do not allocate.
 */
export type V3 = [number, number, number]
/** 3×3 rotation, row-major: world = R · local, so columns are the box axes. */
export type M3 = number[]

/** An axis-aligned box as centre and half extents. */
export interface Box {
  center: V3
  half: V3
}
export interface Aabb {
  min: V3
  max: V3
}
export interface Obb {
  center: V3
  half: V3
  rot: M3
}
export interface Sphere {
  center: V3
  radius: number
}

/** Rodrigues' formula. `axis` must be unit length. */
export function rotationAxisAngle(axis: V3, angle: number, out: M3): M3 {
  const x = axis[0]
  const y = axis[1]
  const z = axis[2]
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const k = 1 - c
  out[0] = c + x * x * k
  out[1] = x * y * k - z * s
  out[2] = x * z * k + y * s
  out[3] = y * x * k + z * s
  out[4] = c + y * y * k
  out[5] = y * z * k - x * s
  out[6] = z * x * k - y * s
  out[7] = z * y * k + x * s
  out[8] = c + z * z * k
  return out
}

/** out = R · p + t. `out` may not alias `p`. */
export function transformPoint(R: M3, p: V3, t: V3, out: V3): V3 {
  out[0] = R[0] * p[0] + R[1] * p[1] + R[2] * p[2] + t[0]
  out[1] = R[3] * p[0] + R[4] * p[1] + R[5] * p[2] + t[1]
  out[2] = R[6] * p[0] + R[7] * p[1] + R[8] * p[2] + t[2]
  return out
}

/**
 * World AABB of a transformed local box (Arvo): c' = R·c + t and
 * e'ᵢ = Σⱼ |Rᵢⱼ| hⱼ. It is the exact AABB of the rotated box, with no need to
 * visit its 8 corners. Always feed it the local box, never last frame's result.
 */
export function refitAabb(local: Box, R: M3, t: V3, out: Aabb): Aabb {
  const { center: c, half: h } = local
  for (let i = 0; i < 3; i++) {
    const r = i * 3
    const center = R[r] * c[0] + R[r + 1] * c[1] + R[r + 2] * c[2] + t[i]
    const extent =
      Math.abs(R[r]) * h[0] +
      Math.abs(R[r + 1]) * h[1] +
      Math.abs(R[r + 2]) * h[2]
    out.min[i] = center - extent
    out.max[i] = center + extent
  }
  return out
}

/** Boxes overlap only if their intervals overlap on all three axes. Touching counts. */
export const aabbOverlap = (a: Aabb, b: Aabb) =>
  a.min[0] <= b.max[0] &&
  b.min[0] <= a.max[0] &&
  a.min[1] <= b.max[1] &&
  b.min[1] <= a.max[1] &&
  a.min[2] <= b.max[2] &&
  b.min[2] <= a.max[2]

/** Compares squared distances, so no square root is needed. Touching counts. */
export function sphereOverlap(a: Sphere, b: Sphere) {
  const dx = b.center[0] - a.center[0]
  const dy = b.center[1] - a.center[1]
  const dz = b.center[2] - a.center[2]
  const r = a.radius + b.radius
  return dx * dx + dy * dy + dz * dz <= r * r
}

const EPSILON = 1e-9
const rel = new Float64Array(9)
const absRel = new Float64Array(9)
const tA = new Float64Array(3)

/**
 * Separating axis test for two OBBs: 3 axes of A, 3 of B and 9 edge cross
 * products. Any axis that separates the projections proves there is no overlap.
 */
export function obbOverlap(a: Obb, b: Obb) {
  const ra = a.rot
  const rb = b.rot
  // B's axes expressed in A's frame: rel[i*3+j] = Aᵢ · Bⱼ.
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const d = ra[i] * rb[j] + ra[3 + i] * rb[3 + j] + ra[6 + i] * rb[6 + j]
      rel[i * 3 + j] = d
      // The epsilon keeps near-parallel edges (a near-zero cross) from
      // producing a false separation.
      absRel[i * 3 + j] = Math.abs(d) + EPSILON
    }
  }
  const dx = b.center[0] - a.center[0]
  const dy = b.center[1] - a.center[1]
  const dz = b.center[2] - a.center[2]
  for (let i = 0; i < 3; i++)
    tA[i] = dx * ra[i] + dy * ra[3 + i] + dz * ra[6 + i]

  const ea = a.half
  const eb = b.half
  for (let i = 0; i < 3; i++) {
    const r = i * 3
    const reach =
      ea[i] + eb[0] * absRel[r] + eb[1] * absRel[r + 1] + eb[2] * absRel[r + 2]
    if (Math.abs(tA[i]) > reach) return false
  }
  for (let j = 0; j < 3; j++) {
    const reach =
      ea[0] * absRel[j] + ea[1] * absRel[3 + j] + ea[2] * absRel[6 + j] + eb[j]
    const dist = tA[0] * rel[j] + tA[1] * rel[3 + j] + tA[2] * rel[6 + j]
    if (Math.abs(dist) > reach) return false
  }
  for (let i = 0; i < 3; i++) {
    const i1 = (i + 1) % 3
    const i2 = (i + 2) % 3
    for (let j = 0; j < 3; j++) {
      const j1 = (j + 1) % 3
      const j2 = (j + 2) % 3
      const reach =
        ea[i1] * absRel[i2 * 3 + j] +
        ea[i2] * absRel[i1 * 3 + j] +
        eb[j1] * absRel[i * 3 + j2] +
        eb[j2] * absRel[i * 3 + j1]
      const dist = tA[i2] * rel[i1 * 3 + j] - tA[i1] * rel[i2 * 3 + j]
      if (Math.abs(dist) > reach) return false
    }
  }
  return true
}

/** Smallest axis-aligned box around some axis-aligned parts (the local OBB fit). */
export function boundsOf(parts: Box[]): Box {
  const min: V3 = [Infinity, Infinity, Infinity]
  const max: V3 = [-Infinity, -Infinity, -Infinity]
  for (const { center, half } of parts) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], center[i] - half[i])
      max[i] = Math.max(max[i], center[i] + half[i])
    }
  }
  return {
    center: [
      (min[0] + max[0]) / 2,
      (min[1] + max[1]) / 2,
      (min[2] + max[2]) / 2,
    ],
    half: [(max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2],
  }
}

/** Radius that encloses every part when centred on `center`. Not the minimal sphere. */
export function enclosingRadius(parts: Box[], center: V3) {
  let best = 0
  for (const p of parts) {
    // The farthest corner per axis gives the farthest corner overall.
    let d2 = 0
    for (let i = 0; i < 3; i++) {
      const d = Math.abs(p.center[i] - center[i]) + p.half[i]
      d2 += d * d
    }
    best = Math.max(best, d2)
  }
  return Math.sqrt(best)
}

export const boxVolume = (half: V3) => 8 * half[0] * half[1] * half[2]
export const sphereVolume = (radius: number) => (4 / 3) * Math.PI * radius ** 3

/** Total volume of parts that do not overlap each other. */
export const solidVolume = (parts: Box[]) =>
  parts.reduce((sum, p) => sum + boxVolume(p.half), 0)

/** Share of a bounding volume not occupied by the object, from 0 to 1. */
export const emptyFraction = (solid: number, volume: number) =>
  volume > 0 ? Math.min(1, Math.max(0, 1 - solid / volume)) : 0

/** The demo object: a lopsided hammer of three boxes that only touch at faces. */
export const COMPOUND: Box[] = [
  { center: [-0.15, 0, 0], half: [1.65, 0.22, 0.22] },
  { center: [1.85, 0.15, 0], half: [0.35, 0.7, 0.35] },
  { center: [-1.35, -0.52, 0], half: [0.3, 0.3, 0.18] },
]
