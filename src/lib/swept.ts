/**
 * Continuous (swept) collision helpers. THREE.Vector3 satisfies `V3`.
 */
export interface V3 {
  x: number
  y: number
  z: number
}

const AXES = ["x", "y", "z"] as const

/**
 * Segment p0→p1 against an AABB (slab method). Returns the entry time
 * t ∈ [0, 1], or null when the segment misses. Starting inside returns 0.
 */
export function segmentAabb(p0: V3, p1: V3, min: V3, max: V3): number | null {
  let tEnter = 0
  let tExit = 1
  for (const k of AXES) {
    const d = p1[k] - p0[k]
    if (Math.abs(d) < 1e-12) {
      if (p0[k] < min[k] || p0[k] > max[k]) return null
      continue
    }
    let t0 = (min[k] - p0[k]) / d
    let t1 = (max[k] - p0[k]) / d
    if (t0 > t1) [t0, t1] = [t1, t0]
    tEnter = Math.max(tEnter, t0)
    tExit = Math.min(tExit, t1)
    if (tEnter > tExit) return null
  }
  return tEnter
}

/**
 * Sphere of radius r moving p0→p1 against an AABB: grow the box by r and cast
 * the centre as a segment. Conservative at the box corners (may report a hit
 * up to ~0.4r early there), which is fine for bullets vs walls.
 */
export function sweptSphereAabb(
  p0: V3,
  p1: V3,
  r: number,
  min: V3,
  max: V3
): number | null {
  return segmentAabb(
    p0,
    p1,
    { x: min.x - r, y: min.y - r, z: min.z - r },
    { x: max.x + r, y: max.y + r, z: max.z + r }
  )
}

/** Exact swept sphere vs static sphere: earliest t ∈ [0, 1] of contact. */
export function sweptSphereSphere(
  p0: V3,
  p1: V3,
  r: number,
  center: V3,
  radius: number
): number | null {
  const R = r + radius
  const dx = p1.x - p0.x
  const dy = p1.y - p0.y
  const dz = p1.z - p0.z
  const mx = p0.x - center.x
  const my = p0.y - center.y
  const mz = p0.z - center.z
  const c = mx * mx + my * my + mz * mz - R * R
  if (c <= 0) return 0 // already touching
  const a = dx * dx + dy * dy + dz * dz
  const b = mx * dx + my * dy + mz * dz
  if (a < 1e-12 || b >= 0) return null // not moving, or moving away
  const disc = b * b - a * c
  if (disc < 0) return null
  const t = (-b - Math.sqrt(disc)) / a
  return t <= 1 ? t : null
}

/** Discrete test: does a sphere at `c` overlap the AABB right now? */
export function sphereAabbOverlap(c: V3, r: number, min: V3, max: V3): boolean {
  let d2 = 0
  for (const k of AXES) {
    const v = Math.max(min[k], Math.min(c[k], max[k])) - c[k]
    d2 += v * v
  }
  return d2 <= r * r
}
