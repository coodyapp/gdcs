/**
 * Minimal quaternion math on plain tuples [x, y, z, w], so it can be tested
 * and reused outside Three.js. Angles are radians; Euler order is XYZ
 * (Three.js's default).
 */
export type Quat = [number, number, number, number]

export function fromEuler(x: number, y: number, z: number): Quat {
  const c1 = Math.cos(x / 2)
  const c2 = Math.cos(y / 2)
  const c3 = Math.cos(z / 2)
  const s1 = Math.sin(x / 2)
  const s2 = Math.sin(y / 2)
  const s3 = Math.sin(z / 2)
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  ]
}

export const dot = (a: Quat, b: Quat) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]

export function normalize(q: Quat): Quat {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]
}

/** Rotation angle (radians, 0..π) needed to go from a to b. */
export const angleBetween = (a: Quat, b: Quat) =>
  2 * Math.acos(Math.min(1, Math.abs(dot(a, b))))

/**
 * Spherical linear interpolation. With `shortest` (default) it flips b when
 * the quaternions are more than 180° apart in rotation, so it never takes the
 * long way round. Falls back to normalized lerp when a ≈ b.
 */
export function slerp(a: Quat, b: Quat, t: number, shortest = true): Quat {
  let cos = dot(a, b)
  let bb = b
  if (shortest && cos < 0) {
    cos = -cos
    bb = [-b[0], -b[1], -b[2], -b[3]]
  }
  if (Math.abs(cos) > 0.9995) {
    return normalize([
      a[0] + (bb[0] - a[0]) * t,
      a[1] + (bb[1] - a[1]) * t,
      a[2] + (bb[2] - a[2]) * t,
      a[3] + (bb[3] - a[3]) * t,
    ])
  }
  const theta = Math.acos(cos)
  const s = Math.sin(theta)
  const wa = Math.sin((1 - t) * theta) / s
  const wb = Math.sin(t * theta) / s
  return [
    a[0] * wa + bb[0] * wb,
    a[1] * wa + bb[1] * wb,
    a[2] * wa + bb[2] * wb,
    a[3] * wa + bb[3] * wb,
  ]
}

/** Euler angles lerped component-wise, the naive way. */
export function eulerLerp(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): Quat {
  return fromEuler(
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  )
}

/** Total rotation swept by a path, summed over `steps` samples. */
export function sweptAngle(path: (t: number) => Quat, steps = 128) {
  let total = 0
  let prev = path(0)
  for (let i = 1; i <= steps; i++) {
    const q = path(i / steps)
    total += angleBetween(prev, q)
    prev = q
  }
  return total
}
