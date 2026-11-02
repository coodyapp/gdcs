/**
 * Geometric optics helpers that mirror GLSL's reflect()/refract(), plus
 * Snell's law and Fresnel (Schlick) for the reflection/PBR sheets.
 */

export type V3 = [number, number, number]

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** Mirror incident direction I about unit normal N: I − 2(N·I)N. */
export function reflect(I: V3, N: V3): V3 {
  const k = 2 * dot(N, I)
  return [I[0] - k * N[0], I[1] - k * N[1], I[2] - k * N[2]]
}

/**
 * Refract unit direction I through unit normal N (facing against I) with
 * eta = n1 / n2. Same maths as GLSL refract(), but returns null on total
 * internal reflection instead of a zero vector.
 */
export function refract(I: V3, N: V3, eta: number): V3 | null {
  const c = dot(N, I)
  const k = 1 - eta * eta * (1 - c * c)
  if (k < 0) return null
  const m = eta * c + Math.sqrt(k)
  return [eta * I[0] - m * N[0], eta * I[1] - m * N[1], eta * I[2] - m * N[2]]
}

/** Snell's law n1·sinθ1 = n2·sinθ2. Returns θ2, or null on TIR. */
export function snell(theta1: number, n1: number, n2: number) {
  const s = (n1 / n2) * Math.sin(theta1)
  return Math.abs(s) > 1 ? null : Math.asin(s)
}

/** Critical angle for n1 → n2, or null when n1 ≤ n2 (no TIR possible). */
export const criticalAngle = (n1: number, n2: number) =>
  n1 > n2 ? Math.asin(n2 / n1) : null

/** Reflectance at normal incidence: ((n1 − n2)/(n1 + n2))². */
export const f0FromIor = (n1: number, n2 = 1) => ((n1 - n2) / (n1 + n2)) ** 2

/** Schlick's approximation: F0 + (1 − F0)(1 − cosθ)⁵. */
export const schlick = (cosTheta: number, f0: number) =>
  f0 + (1 - f0) * Math.pow(1 - Math.min(1, Math.max(0, cosTheta)), 5)

/**
 * Fraction of light reflected at an interface for incidence angle θ1.
 * Uses the angle on the less dense side (Schlick is only accurate there)
 * and returns 1 under total internal reflection.
 */
export function fresnel(theta1: number, n1: number, n2: number) {
  const theta2 = snell(theta1, n1, n2)
  if (theta2 === null) return 1
  const cos = n1 <= n2 ? Math.cos(theta1) : Math.cos(theta2)
  return schlick(cos, f0FromIor(n1, n2))
}

/** Metal/rough F0: lerp(0.04, baseColor, metalness) per channel. */
export const metalRoughF0 = (base: V3, metalness: number): V3 => [
  0.04 + (base[0] - 0.04) * metalness,
  0.04 + (base[1] - 0.04) * metalness,
  0.04 + (base[2] - 0.04) * metalness,
]
