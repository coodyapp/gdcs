/**
 * Tiny 4×4 matrix + Euler helpers on plain arrays so they can be tested
 * without a renderer. Matrices are column-major (same layout as
 * THREE.Matrix4.elements) and act on column vectors: p' = M·p, so in
 * `multiply(a, b)` the transform `b` is applied first.
 */
export type Mat4 = number[]
export type Vec3 = [number, number, number]
export type EulerOrder = "XYZ" | "XZY" | "YXZ" | "YZX" | "ZXY" | "ZYX"
type Axis = "X" | "Y" | "Z"

export const identity = (): Mat4 => [
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
]

export function translation(x: number, y: number, z: number): Mat4 {
  const m = identity()
  m[12] = x
  m[13] = y
  m[14] = z
  return m
}

export function scaling(x: number, y = x, z = x): Mat4 {
  const m = identity()
  m[0] = x
  m[5] = y
  m[10] = z
  return m
}

export function rotation(axis: Axis, angle: number): Mat4 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const m = identity()
  // Indices are [column * 4 + row].
  if (axis === "X") {
    m[5] = c
    m[6] = s
    m[9] = -s
    m[10] = c
  } else if (axis === "Y") {
    m[0] = c
    m[2] = -s
    m[8] = s
    m[10] = c
  } else {
    m[0] = c
    m[1] = s
    m[4] = -s
    m[5] = c
  }
  return m
}

/** a·b: apply b first, then a. */
export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out: Mat4 = Array.from({ length: 16 }, () => 0)
  for (let col = 0; col < 4; col++)
    for (let row = 0; row < 4; row++) {
      let sum = 0
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k]
      out[col * 4 + row] = sum
    }
  return out
}

/** Product of any number of matrices, left to right: chain(A, B, C) = A·B·C. */
export const chain = (...ms: Mat4[]) => ms.reduce(multiply, identity())

/** Object-style transform: scale, then rotate about Y, then translate (T·R·S). */
export const composeTRS = (t: Vec3, yaw: number, s: number) =>
  chain(translation(...t), rotation("Y", yaw), scaling(s))

/** Applies M to a point (w = 1, so translation counts). */
export function transformPoint(m: Mat4, p: Vec3): Vec3 {
  const [x, y, z] = p
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
  ]
}

/** Applies M to a direction (w = 0, so translation is ignored). */
export function transformDirection(m: Mat4, d: Vec3): Vec3 {
  const [x, y, z] = d
  return [
    m[0] * x + m[4] * y + m[8] * z,
    m[1] * x + m[5] * y + m[9] * z,
    m[2] * x + m[6] * y + m[10] * z,
  ]
}

/** General 4×4 inverse (cofactor expansion). Returns null if singular. */
export function invert(m: Mat4): Mat4 | null {
  const [a00, a01, a02, a03, a10, a11, a12, a13] = m
  const [a20, a21, a22, a23, a30, a31, a32, a33] = m.slice(8)
  const b00 = a00 * a11 - a01 * a10
  const b01 = a00 * a12 - a02 * a10
  const b02 = a00 * a13 - a03 * a10
  const b03 = a01 * a12 - a02 * a11
  const b04 = a01 * a13 - a03 * a11
  const b05 = a02 * a13 - a03 * a12
  const b06 = a20 * a31 - a21 * a30
  const b07 = a20 * a32 - a22 * a30
  const b08 = a20 * a33 - a23 * a30
  const b09 = a21 * a32 - a22 * a31
  const b10 = a21 * a33 - a23 * a31
  const b11 = a22 * a33 - a23 * a32
  const det =
    b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06
  if (Math.abs(det) < 1e-12) return null
  const d = 1 / det
  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * d,
    (a02 * b10 - a01 * b11 - a03 * b09) * d,
    (a31 * b05 - a32 * b04 + a33 * b03) * d,
    (a22 * b04 - a21 * b05 - a23 * b03) * d,
    (a12 * b08 - a10 * b11 - a13 * b07) * d,
    (a00 * b11 - a02 * b08 + a03 * b07) * d,
    (a32 * b02 - a30 * b05 - a33 * b01) * d,
    (a20 * b05 - a22 * b02 + a23 * b01) * d,
    (a10 * b10 - a11 * b08 + a13 * b06) * d,
    (a01 * b08 - a00 * b10 - a03 * b06) * d,
    (a30 * b04 - a31 * b02 + a33 * b00) * d,
    (a21 * b02 - a20 * b04 - a23 * b00) * d,
    (a11 * b07 - a10 * b09 - a12 * b06) * d,
    (a00 * b09 - a01 * b07 + a02 * b06) * d,
    (a31 * b01 - a30 * b03 - a32 * b00) * d,
    (a20 * b03 - a21 * b01 + a22 * b00) * d,
  ]
}

/**
 * Rotation matrix for Euler angles [x, y, z] (radians) in Three.js's
 * convention: order "XYZ" means M = Rx·Ry·Rz, so X is the outermost gimbal
 * and Z the innermost.
 */
export function eulerMatrix(angles: Vec3, order: EulerOrder = "XYZ"): Mat4 {
  const byAxis = { X: angles[0], Y: angles[1], Z: angles[2] }
  return chain(
    ...(order.split("") as Axis[]).map((a) => rotation(a, byAxis[a]))
  )
}

/** The axis of the middle gimbal: the one whose ±90° causes gimbal lock. */
export const middleAxis = (order: EulerOrder) => order[1] as Axis

/**
 * True when the middle angle is within `tolerance` radians of ±90°: the
 * outer and inner gimbal axes are then parallel and one degree of freedom
 * is gone.
 */
export function isGimbalLocked(
  angles: Vec3,
  order: EulerOrder = "XYZ",
  tolerance = 0.01
) {
  const mid = angles["XYZ".indexOf(middleAxis(order))]
  return Math.abs(Math.cos(mid)) < Math.sin(tolerance)
}
