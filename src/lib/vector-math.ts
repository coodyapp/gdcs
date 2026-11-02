/**
 * Small, allocation-light vector and angle helpers on plain tuples. Used by
 * the vector, dot/cross and trigonometry sheets; mirrors what THREE.Vector3
 * and THREE.MathUtils do, so the tests double as a spec.
 */

export type V2 = [number, number]
export type V3 = [number, number, number]

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s]

export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

export const lengthSq = (a: V3) => dot(a, a)
export const length = (a: V3) => Math.sqrt(lengthSq(a))
export const distance = (a: V3, b: V3) => length(sub(a, b))
export const distanceSq = (a: V3, b: V3) => lengthSq(sub(a, b))

/** Unit vector in the same direction; the zero vector stays zero (no NaN). */
export function normalize(a: V3, eps = 1e-12): V3 {
  const len = length(a)
  return len > eps ? scale(a, 1 / len) : [0, 0, 0]
}

/** Unsigned angle between two vectors in radians, in [0, π]. 0 if either is zero. */
export function angleBetween(a: V3, b: V3) {
  const denom = length(a) * length(b)
  if (denom === 0) return 0
  return Math.acos(Math.min(1, Math.max(-1, dot(a, b) / denom)))
}

/** Vector projection of `a` onto `b` (the "shadow" of a along b). */
export function project(a: V3, b: V3): V3 {
  const bb = lengthSq(b)
  return bb === 0 ? [0, 0, 0] : scale(b, dot(a, b) / bb)
}

/** Area of the parallelogram spanned by a and b: |a × b|. */
export const parallelogramArea = (a: V3, b: V3) => length(cross(a, b))

// ── Angles ────────────────────────────────────────────────────────────────

export const TAU = Math.PI * 2
export const degToRad = (d: number) => (d * Math.PI) / 180
export const radToDeg = (r: number) => (r * 180) / Math.PI

/** Wrap any angle into (-π, π]. */
export function wrapAngle(a: number) {
  const w = a - TAU * Math.floor((a + Math.PI) / TAU)
  // floor puts exactly +π at -π; keep the half-open interval (-π, π].
  return w === -Math.PI ? Math.PI : w
}

/** Shortest signed turn from angle `from` to angle `to`, in (-π, π]. */
export const angleDelta = (from: number, to: number) => wrapAngle(to - from)

/** Point on a circle of radius r at angle θ (counter-clockwise from +x). */
export const onCircle = (theta: number, r = 1): V2 => [
  r * Math.cos(theta),
  r * Math.sin(theta),
]

/** Heading (radians) that points from `from` towards `to`, via atan2(dy, dx). */
export const aimAngle = (from: V2, to: V2) =>
  Math.atan2(to[1] - from[1], to[0] - from[0])
