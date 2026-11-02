/**
 * Scalar interpolation helpers: lerp, inverse lerp, remap, clamp, the
 * smoothstep family and frame-rate-independent exponential damping.
 */

export const clamp = (x: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, x))

/** a at t = 0, b at t = 1; extrapolates outside [0, 1]. */
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Where v sits between a and b as a 0..1 fraction (unclamped). 0 when a = b. */
export const inverseLerp = (a: number, b: number, v: number) =>
  a === b ? 0 : (v - a) / (b - a)

/** Map v from [inMin, inMax] to [outMin, outMax] (unclamped). */
export const remap = (
  v: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
) => lerp(outMin, outMax, inverseLerp(inMin, inMax, v))

/** Hermite 3t² − 2t³ between two edges, clamped. Zero slope at both ends. */
export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp(inverseLerp(edge0, edge1, x))
  return t * t * (3 - 2 * t)
}

/** Ken Perlin's 6t⁵ − 15t⁴ + 10t³: zero slope and zero curvature at both ends. */
export function smootherstep(edge0: number, edge1: number, x: number) {
  const t = clamp(inverseLerp(edge0, edge1, x))
  return t * t * t * (t * (t * 6 - 15) + 10)
}

/**
 * Frame-rate-independent "lerp towards target": closes the same fraction of
 * the gap per second at any dt. `lambda` is the decay rate (1/s).
 */
export const damp = (
  current: number,
  target: number,
  lambda: number,
  dt: number
) => lerp(current, target, 1 - Math.exp(-lambda * dt))

/** Decay rate that closes `fraction` (e.g. 0.99) of the gap in `seconds`. */
export const lambdaFor = (fraction: number, seconds: number) =>
  -Math.log(1 - fraction) / seconds
