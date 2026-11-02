/**
 * Barycentric coordinates: a point as three weights on a triangle's corners.
 * Works on plain number arrays of any dimension (2D screen, 3D world) and
 * writes into `out`, so a render loop can call it without allocating.
 */

export type Vec = ArrayLike<number>
export type Weights = [number, number, number]

/** Below this sin²(angle between the edges) the triangle counts as flat. */
const DEGENERATE_EPS = 1e-12

/**
 * Solves p = u·a + v·b + w·c with u + v + w = 1, using dot products only, and
 * writes (u, v, w) into `out`. A 3D point off the triangle's plane is projected
 * onto it. Returns false for a degenerate triangle (zero area), which has no
 * unique answer: `out` then holds (1, 0, 0).
 */
function solve(p: Vec, a: Vec, b: Vec, c: Vec, out: Weights): boolean {
  let d00 = 0
  let d01 = 0
  let d11 = 0
  let d20 = 0
  let d21 = 0
  for (let i = 0; i < p.length; i++) {
    const e0 = b[i] - a[i]
    const e1 = c[i] - a[i]
    const e2 = p[i] - a[i]
    d00 += e0 * e0
    d01 += e0 * e1
    d11 += e1 * e1
    d20 += e2 * e0
    d21 += e2 * e1
  }
  const denom = d00 * d11 - d01 * d01
  if (denom <= DEGENERATE_EPS * d00 * d11) {
    out[0] = 1
    out[1] = 0
    out[2] = 0
    return false
  }
  const v = (d11 * d20 - d01 * d21) / denom
  const w = (d00 * d21 - d01 * d20) / denom
  out[0] = 1 - v - w
  out[1] = v
  out[2] = w
  return true
}

/**
 * The weights of p on triangle (a, b, c). A degenerate triangle gives
 * (1, 0, 0): reading an attribute with those weights still returns a real
 * vertex value, never NaN.
 */
export function barycentric(
  p: Vec,
  a: Vec,
  b: Vec,
  c: Vec,
  out: Weights = [0, 0, 0]
): Weights {
  solve(p, a, b, c, out)
  return out
}

/** All three weights non-negative, within `eps` so edge points count as inside. */
export const insideWeights = (weights: Weights, eps = 1e-9) =>
  weights[0] >= -eps && weights[1] >= -eps && weights[2] >= -eps

const scratch: Weights = [0, 0, 0]

/** Point-in-triangle test. A degenerate triangle contains nothing. */
export function pointInTriangle(p: Vec, a: Vec, b: Vec, c: Vec, eps = 1e-9) {
  return solve(p, a, b, c, scratch) && insideWeights(scratch, eps)
}

/** Blends a per-vertex attribute (colour, UV, normal…) by the weights. */
export function interpolate<T extends number[]>(
  weights: Weights,
  a: Vec,
  b: Vec,
  c: Vec,
  out: T
): T {
  for (let i = 0; i < out.length; i++)
    out[i] = weights[0] * a[i] + weights[1] * b[i] + weights[2] * c[i]
  return out
}

/**
 * Perspective-correct blend of a scalar attribute. `weights` are measured in
 * screen space and `clipW` holds each vertex's clip-space w: interpolate
 * attr/w and 1/w linearly, then divide.
 */
export function interpolatePerspective(
  weights: Weights,
  attr: Vec,
  clipW: Vec
): number {
  let attrOverW = 0
  let oneOverW = 0
  for (let i = 0; i < 3; i++) {
    attrOverW += (weights[i] * attr[i]) / clipW[i]
    oneOverW += weights[i] / clipW[i]
  }
  return attrOverW / oneOverW
}
