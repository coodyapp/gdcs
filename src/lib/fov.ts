/**
 * Field-of-view helpers on a 2D plane (the XZ floor stored as x/y).
 * Pure, allocation-free in the hot path: callers pass scratch objects and
 * preallocated buffers, so the visuals can run them every frame.
 */
export interface Vec2 {
  x: number
  y: number
}

/** cos(viewAngle / 2): compare dot products against this, never call acos. */
export const cosHalfAngle = (viewAngleRad: number) => Math.cos(viewAngleRad / 2)

/**
 * Cone test without line of sight: target within `radius` and within half the
 * view angle of `forward` (unit length). Works on squared distance and a dot.
 */
export function inViewCone(
  origin: Vec2,
  forward: Vec2,
  target: Vec2,
  radius: number,
  cosHalf: number
): boolean {
  const dx = target.x - origin.x
  const dy = target.y - origin.y
  const d2 = dx * dx + dy * dy
  if (d2 > radius * radius) return false
  if (d2 < 1e-12) return true // standing on the eye: count as seen
  const dot = (forward.x * dx + forward.y * dy) / Math.sqrt(d2)
  return dot >= cosHalf - 1e-9
}

/** Obstacles: circles and axis-aligned boxes (center + half extents). */
export type Obstacle =
  | { kind: "circle"; x: number; y: number; r: number }
  | { kind: "box"; x: number; y: number; hx: number; hy: number }

/** Result of one ray cast. `id` is the obstacle index, or -1 for a miss. */
export interface Hit {
  x: number
  y: number
  dist: number
  id: number
}

export const makeHit = (): Hit => ({ x: 0, y: 0, dist: 0, id: -1 })

export function copyHit(out: Hit, h: Hit): Hit {
  out.x = h.x
  out.y = h.y
  out.dist = h.dist
  out.id = h.id
  return out
}

/** Distance along a unit ray to a circle, or Infinity. */
export function rayCircle(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  c: { x: number; y: number; r: number }
): number {
  const mx = ox - c.x
  const my = oy - c.y
  const b = mx * dx + my * dy
  const cc = mx * mx + my * my - c.r * c.r
  if (cc > 0 && b > 0) return Infinity
  const disc = b * b - cc
  if (disc < 0) return Infinity
  return Math.max(0, -b - Math.sqrt(disc))
}

/** Slab test against an axis-aligned box, or Infinity. */
export function rayBox(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  b: { x: number; y: number; hx: number; hy: number }
): number {
  let tMin = 0
  let tMax = Infinity
  // x slab
  if (Math.abs(dx) < 1e-12) {
    if (ox < b.x - b.hx || ox > b.x + b.hx) return Infinity
  } else {
    const t1 = (b.x - b.hx - ox) / dx
    const t2 = (b.x + b.hx - ox) / dx
    tMin = Math.max(tMin, Math.min(t1, t2))
    tMax = Math.min(tMax, Math.max(t1, t2))
  }
  // y slab
  if (Math.abs(dy) < 1e-12) {
    if (oy < b.y - b.hy || oy > b.y + b.hy) return Infinity
  } else {
    const t1 = (b.y - b.hy - oy) / dy
    const t2 = (b.y + b.hy - oy) / dy
    tMin = Math.max(tMin, Math.min(t1, t2))
    tMax = Math.min(tMax, Math.max(t1, t2))
  }
  return tMin <= tMax ? tMin : Infinity
}

/**
 * Cast one ray from `origin` at `angle` (radians, direction (cos, sin)) up to
 * `maxDist`. A miss stops at maxDist with id -1.
 */
export function castRay(
  obstacles: readonly Obstacle[],
  origin: Vec2,
  angle: number,
  maxDist: number,
  out: Hit
): Hit {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  let best = maxDist
  let id = -1
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i]
    const t =
      o.kind === "circle"
        ? rayCircle(origin.x, origin.y, dx, dy, o)
        : rayBox(origin.x, origin.y, dx, dy, o)
    if (t < best) {
      best = t
      id = i
    }
  }
  out.x = origin.x + dx * best
  out.y = origin.y + dy * best
  out.dist = best
  out.id = id
  return out
}

/**
 * Line of sight: true when no obstacle sits between `origin` and `target`.
 * `hit` receives the blocking point (or the target when clear).
 */
export function lineOfSight(
  obstacles: readonly Obstacle[],
  origin: Vec2,
  target: Vec2,
  hit: Hit
): boolean {
  const dist = Math.hypot(target.x - origin.x, target.y - origin.y)
  const angle = Math.atan2(target.y - origin.y, target.x - origin.x)
  castRay(obstacles, origin, angle, dist, hit)
  return hit.id === -1
}

/** A cast function: fill `out` for a ray at `angle`. */
export type Cast = (angle: number, out: Hit) => Hit

/** Two neighbouring rays disagree: different object, or a big depth jump. */
export const isEdge = (a: Hit, b: Hit, distThreshold: number) =>
  a.id !== b.id || Math.abs(a.dist - b.dist) > distThreshold

export interface Edge {
  /** Last angle still on `a`'s surface, and its hit. */
  aAngle: number
  a: Hit
  /** First angle on the other side, and its hit. */
  bAngle: number
  b: Hit
  casts: number
}

export const makeEdge = (): Edge => ({
  aAngle: 0,
  a: makeHit(),
  bAngle: 0,
  b: makeHit(),
  casts: 0,
})

const mid = makeHit()

/**
 * Binary search between two rays that disagree. Each iteration halves the
 * angular gap; the result brackets the silhouette within gap / 2^iterations.
 */
export function findEdge(
  cast: Cast,
  aAngle: number,
  aHit: Hit,
  bAngle: number,
  bHit: Hit,
  iterations: number,
  distThreshold: number,
  out: Edge
): Edge {
  out.aAngle = aAngle
  out.bAngle = bAngle
  copyHit(out.a, aHit)
  copyHit(out.b, bHit)
  out.casts = 0
  for (let i = 0; i < iterations; i++) {
    const angle = (out.aAngle + out.bAngle) / 2
    cast(angle, mid)
    out.casts++
    if (isEdge(out.a, mid, distThreshold)) {
      out.bAngle = angle
      copyHit(out.b, mid)
    } else {
      out.aAngle = angle
      copyHit(out.a, mid)
    }
  }
  return out
}

export interface FanResult {
  /** Points written to `out` (x, y pairs), not counting the origin. */
  count: number
  /** Rays in the even sweep. */
  rays: number
  /** Extra casts spent on edge refinement. */
  refineCasts: number
}

/** Upper bound on fan points for `rays` rays (each gap can add two). */
export const fanCapacity = (rays: number) => rays + 2 * Math.max(0, rays - 1)

function writePoint(out: Float32Array, i: number, h: Hit) {
  out[i * 2] = h.x
  out[i * 2 + 1] = h.y
  return i + 1
}

const prev = makeHit()
const cur = makeHit()
const edge = makeEdge()

/**
 * Sweep `rays` evenly spaced rays across [heading − angle/2, heading + angle/2]
 * and write hit points as x, y pairs into `out` (length ≥ 2·fanCapacity).
 * With `iterations` > 0, gaps whose rays disagree get two extra points from
 * findEdge, which pins the mesh edge onto the obstacle silhouette.
 * Optional `refined[i]` is set to 1 for points that came from refinement.
 */
export function castFan(
  cast: Cast,
  heading: number,
  viewAngle: number,
  rays: number,
  iterations: number,
  distThreshold: number,
  out: Float32Array,
  result: FanResult,
  refined?: Uint8Array
): FanResult {
  const n = Math.max(2, Math.floor(rays))
  const start = heading - viewAngle / 2
  const step = viewAngle / (n - 1)
  let count = 0
  let refine = 0
  for (let i = 0; i < n; i++) {
    const angle = start + step * i
    cast(angle, cur)
    if (i > 0 && iterations > 0 && isEdge(prev, cur, distThreshold)) {
      findEdge(
        cast,
        angle - step,
        prev,
        angle,
        cur,
        iterations,
        distThreshold,
        edge
      )
      refine += edge.casts
      if (refined) refined[count] = refined[count + 1] = 1
      count = writePoint(out, count, edge.a)
      count = writePoint(out, count, edge.b)
    }
    if (refined) refined[count] = 0
    count = writePoint(out, count, cur)
    copyHit(prev, cur)
  }
  result.count = count
  result.rays = n
  result.refineCasts = refine
  return result
}

/**
 * Triangle-fan indices for `points` rim vertices plus the origin at index 0:
 * triangle i is (0, i + 1, i + 2). Allocate once at capacity, then use
 * geometry.setDrawRange(0, fanIndexCount(count)).
 */
export const fanIndexCount = (points: number) => Math.max(0, points - 1) * 3

export function buildFanIndices(points: number): Uint16Array | Uint32Array {
  const indices =
    points + 1 > 65535
      ? new Uint32Array(fanIndexCount(points))
      : new Uint16Array(fanIndexCount(points))
  for (let i = 0; i < points - 1; i++) {
    indices[i * 3] = 0
    indices[i * 3 + 1] = i + 1
    indices[i * 3 + 2] = i + 2
  }
  return indices
}

/**
 * Write origin + rim points into an xyz position buffer on the floor plane
 * (x, height, y). Returns the vertex count (points + 1).
 */
export function writeFanPositions(
  origin: Vec2,
  points: Float32Array,
  count: number,
  height: number,
  positions: Float32Array
): number {
  positions[0] = origin.x
  positions[1] = height
  positions[2] = origin.y
  for (let i = 0; i < count; i++) {
    positions[(i + 1) * 3] = points[i * 2]
    positions[(i + 1) * 3 + 1] = height
    positions[(i + 1) * 3 + 2] = points[i * 2 + 1]
  }
  return count + 1
}

/** Shoelace area of the fan polygon (origin + rim points). */
export function fanArea(origin: Vec2, points: Float32Array, count: number) {
  let area = 0
  for (let i = 0; i < count - 1; i++) {
    const ax = points[i * 2] - origin.x
    const ay = points[i * 2 + 1] - origin.y
    const bx = points[i * 2 + 2] - origin.x
    const by = points[i * 2 + 3] - origin.y
    area += ax * by - ay * bx
  }
  return Math.abs(area) / 2
}
