/**
 * Bézier helpers. Generic forms work on number arrays of any dimension;
 * the cubic helpers write into `{ x, y, z }` objects (THREE.Vector3 fits)
 * so a per-frame caller can avoid allocations.
 */
export type Vec = number[]
export interface XYZ {
  x: number
  y: number
  z: number
}

const lerpVec = (a: Vec, b: Vec, t: number) =>
  a.map((x, i) => x + (b[i] - x) * t)

/**
 * de Casteljau: repeatedly lerp neighbouring points by t. Returns every
 * construction level (levels[0] = the control points) and the final point.
 */
export function deCasteljau(points: Vec[], t: number) {
  const levels: Vec[][] = [points]
  let current = points
  while (current.length > 1) {
    const next: Vec[] = []
    for (let i = 0; i < current.length - 1; i++)
      next.push(lerpVec(current[i], current[i + 1], t))
    levels.push(next)
    current = next
  }
  return { point: current[0], levels }
}

function binomial(n: number, k: number) {
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return r
}

/** Bernstein form: B(t) = Σ C(n,i) (1-t)^(n-i) t^i P_i. */
export function bernstein(points: Vec[], t: number): Vec {
  const n = points.length - 1
  const out = points[0].map(() => 0)
  points.forEach((p, i) => {
    const w = binomial(n, i) * (1 - t) ** (n - i) * t ** i
    p.forEach((x, d) => (out[d] += w * x))
  })
  return out
}

/** Cubic point at t, written into `out`. */
export function cubicPoint<T extends XYZ>(
  p0: XYZ,
  p1: XYZ,
  p2: XYZ,
  p3: XYZ,
  t: number,
  out: T
): T {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  out.x = a * p0.x + b * p1.x + c * p2.x + d * p3.x
  out.y = a * p0.y + b * p1.y + c * p2.y + d * p3.y
  out.z = a * p0.z + b * p1.z + c * p2.z + d * p3.z
  return out
}

/** Cubic derivative dB/dt (tangent, not normalized) at t, written into `out`. */
export function cubicTangent<T extends XYZ>(
  p0: XYZ,
  p1: XYZ,
  p2: XYZ,
  p3: XYZ,
  t: number,
  out: T
): T {
  const u = 1 - t
  const a = 3 * u * u
  const b = 6 * u * t
  const c = 3 * t * t
  out.x = a * (p1.x - p0.x) + b * (p2.x - p1.x) + c * (p3.x - p2.x)
  out.y = a * (p1.y - p0.y) + b * (p2.y - p1.y) + c * (p3.y - p2.y)
  out.z = a * (p1.z - p0.z) + b * (p2.z - p1.z) + c * (p3.z - p2.z)
  return out
}

const prev: XYZ = { x: 0, y: 0, z: 0 }
const cur: XYZ = { x: 0, y: 0, z: 0 }

/**
 * Cumulative arc length at n + 1 evenly spaced t values (table[0] = 0,
 * table[n] = total length), measured with straight chords.
 */
export function arcLengthTable(
  sample: (t: number, out: XYZ) => XYZ,
  n = 64,
  table = new Float64Array(n + 1)
) {
  sample(0, prev)
  table[0] = 0
  for (let i = 1; i <= n; i++) {
    sample(i / n, cur)
    table[i] =
      table[i - 1] + Math.hypot(cur.x - prev.x, cur.y - prev.y, cur.z - prev.z)
    prev.x = cur.x
    prev.y = cur.y
    prev.z = cur.z
  }
  return table
}

/**
 * Inverts the table: the t at which the curve has travelled distance s.
 * Binary search, then linear interpolation inside the bracket.
 */
export function tAtDistance(table: ArrayLike<number>, s: number) {
  const n = table.length - 1
  const total = table[n]
  if (s <= 0) return 0
  if (s >= total) return 1
  let lo = 0
  let hi = n
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (table[mid] < s) lo = mid
    else hi = mid
  }
  const span = table[hi] - table[lo] || 1
  return (lo + (s - table[lo]) / span) / n
}
