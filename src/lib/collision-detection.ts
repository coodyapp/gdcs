/**
 * Two-phase collision detection helpers. The uniform-grid broad phase itself
 * lives in `spatial-grid.ts`; this module adds the exact narrow-phase tests,
 * contact data, and seeded sampling for the visual's readout.
 */
import {
  bruteForceChecks,
  circlesOverlap,
  gridPairs,
  SpatialGrid,
  type Circle,
} from "./spatial-grid"

export {
  bruteForcePairs,
  circlesOverlap,
  gridPairs,
  SpatialGrid,
} from "./spatial-grid"
export type { Circle } from "./spatial-grid"

/** All unordered pairs among n objects: n(n − 1) / 2. */
export const pairCount = bruteForceChecks

export interface Sphere {
  x: number
  y: number
  z: number
  r: number
}

export interface Aabb {
  minX: number
  minY: number
  minZ: number
  maxX: number
  maxY: number
  maxZ: number
}

/** Exact sphere–sphere test without a square root. Touching does not count. */
export function spheresOverlap(a: Sphere, b: Sphere) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dz = b.z - a.z
  const rr = a.r + b.r
  return dx * dx + dy * dy + dz * dz < rr * rr
}

/** Exact AABB–AABB test: boxes overlap only if they overlap on every axis. */
export const aabbsOverlap = (a: Aabb, b: Aabb) =>
  a.minX <= b.maxX &&
  a.maxX >= b.minX &&
  a.minY <= b.maxY &&
  a.maxY >= b.minY &&
  a.minZ <= b.maxZ &&
  a.maxZ >= b.minZ

export interface Contact2D {
  /** Unit normal pointing from a to b. */
  nx: number
  ny: number
  /** How far the shapes interpenetrate along the normal. */
  depth: number
}

/**
 * Contact data for two circles, written into `out` to avoid allocation.
 * Returns false when they do not overlap. Coincident centres have no defined
 * direction, so they fall back to +x rather than producing NaN.
 */
export function circleContact(a: Circle, b: Circle, out: Contact2D) {
  if (!circlesOverlap(a, b)) return false
  const dx = b.x - a.x
  const dy = b.y - a.y
  const d = Math.hypot(dx, dy)
  out.nx = d > 0 ? dx / d : 1
  out.ny = d > 0 ? dy / d : 0
  out.depth = a.r + b.r - d
  return true
}

/** Small deterministic PRNG (LCG), so samples and tests are reproducible. */
export function seededRandom(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 2 ** 32
  }
}

/** Circles with radii in [minR, maxR] and centres inside a box centred on the origin. */
export function scatterCircles(
  n: number,
  width: number,
  height: number,
  minR: number,
  maxR: number,
  seed: number
): Circle[] {
  const rand = seededRandom(seed)
  return Array.from({ length: n }, () => {
    const r = minR + rand() * (maxR - minR)
    return {
      x: (rand() - 0.5) * (width - 2 * r),
      y: (rand() - 0.5) * (height - 2 * r),
      r,
    }
  })
}

/** Average grid candidate count over a few seeded layouts: a typical frame. */
export function typicalCandidates(
  n: number,
  width: number,
  height: number,
  minR: number,
  maxR: number,
  cell: number,
  samples = 8
) {
  const grid = new SpatialGrid(width, height, cell, n, -width / 2, -height / 2)
  let total = 0
  for (let s = 1; s <= samples; s++)
    total += gridPairs(
      scatterCircles(n, width, height, minR, maxR, s),
      grid
    ).checks
  return Math.round(total / samples)
}
