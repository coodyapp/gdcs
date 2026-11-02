/**
 * Tangent-space helpers: the T/B/N basis of a surface point and the matrix
 * [T B N] that carries a normal-map sample out of tangent space.
 */

export type V3 = [number, number, number]
export type V2 = [number, number]

export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

export function normalize(a: V3): V3 {
  const len = Math.hypot(a[0], a[1], a[2])
  return len > 0 ? [a[0] / len, a[1] / len, a[2] / len] : [0, 0, 0]
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

/**
 * Unit tangent (+U) and bitangent (+V) of a triangle, from solving
 * E1 = Δu1·T + Δv1·B and E2 = Δu2·T + Δv2·B. Returns null when the UVs are
 * degenerate (zero area in UV space), since no direction follows +U then.
 */
export function triangleTangents(
  p0: V3,
  p1: V3,
  p2: V3,
  uv0: V2,
  uv1: V2,
  uv2: V2
): { tangent: V3; bitangent: V3 } | null {
  const e1 = sub(p1, p0)
  const e2 = sub(p2, p0)
  const du1 = uv1[0] - uv0[0]
  const dv1 = uv1[1] - uv0[1]
  const du2 = uv2[0] - uv0[0]
  const dv2 = uv2[1] - uv0[1]
  const det = du1 * dv2 - du2 * dv1
  if (Math.abs(det) < 1e-12) return null
  const r = 1 / det
  return {
    tangent: normalize([
      (dv2 * e1[0] - dv1 * e2[0]) * r,
      (dv2 * e1[1] - dv1 * e2[1]) * r,
      (dv2 * e1[2] - dv1 * e2[2]) * r,
    ]),
    bitangent: normalize([
      (du1 * e2[0] - du2 * e1[0]) * r,
      (du1 * e2[1] - du2 * e1[1]) * r,
      (du1 * e2[2] - du2 * e1[2]) * r,
    ]),
  }
}

/** Gram-Schmidt: remove T's component along unit N, then renormalize. */
export function orthogonalize(tangent: V3, normal: V3): V3 {
  const d = dot(normal, tangent)
  return normalize([
    tangent[0] - normal[0] * d,
    tangent[1] - normal[1] * d,
    tangent[2] - normal[2] * d,
  ])
}

/** The sign stored in tangent.w: −1 when the UVs are mirrored. */
export const handedness = (normal: V3, tangent: V3, bitangent: V3) =>
  dot(cross(normal, tangent), bitangent) < 0 ? -1 : 1

/** Bitangent rebuilt the way shaders do it: B = w·(N × T). */
export function bitangentFrom(normal: V3, tangent: V3, w: number): V3 {
  const c = cross(normal, tangent)
  return [c[0] * w, c[1] * w, c[2] * w]
}

/** Orthonormal frame from a smooth normal and a raw triangle tangent pair. */
export function buildFrame(normal: V3, tangent: V3, bitangent: V3) {
  const n = normalize(normal)
  const t = orthogonalize(tangent, n)
  const w = handedness(n, t, bitangent)
  return { t, b: bitangentFrom(n, t, w), n, w }
}

/** Decode a normal-map texel: rgb in 0..1 becomes a direction in −1..1. */
export const decodeNormal = (rgb: V3): V3 => [
  rgb[0] * 2 - 1,
  rgb[1] * 2 - 1,
  rgb[2] * 2 - 1,
]

/** [T B N]·s: tangent-space sample to the space T, B and N are expressed in. */
export function tangentToWorld(sample: V3, t: V3, b: V3, n: V3): V3 {
  return normalize([
    t[0] * sample[0] + b[0] * sample[1] + n[0] * sample[2],
    t[1] * sample[0] + b[1] * sample[1] + n[1] * sample[2],
    t[2] * sample[0] + b[2] * sample[1] + n[2] * sample[2],
  ])
}
