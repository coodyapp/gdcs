/**
 * Moment-of-inertia formulas: standard shapes about their centre of mass, the
 * parallel axis theorem, and the local-to-world inverse inertia tensor.
 */

/** A point mass at distance `r` from the rotation axis. */
export interface PointMass {
  m: number
  r: number
}

/** I = Σ m r². */
export const pointMassesInertia = (masses: PointMass[]) =>
  masses.reduce((sum, { m, r }) => sum + m * r * r, 0)

/** Two equal masses on opposite ends of a massless arm: I = 2 m r². */
export const rotorInertia = (massEach: number, r: number) =>
  2 * massEach * r * r

/** Solid sphere about any axis through its centre: 2/5 m r². */
export const solidSphere = (m: number, r: number) => 0.4 * m * r * r

/** Solid cylinder or disc about its long axis: 1/2 m r². */
export const solidCylinder = (m: number, r: number) => 0.5 * m * r * r

/** Solid box about the centre axis perpendicular to the w × h face. */
export const solidBox = (m: number, w: number, h: number) =>
  (m * (w * w + h * h)) / 12

/** Thin rod about a perpendicular axis through its centre: 1/12 m L². */
export const rodCentre = (m: number, length: number) =>
  (m * length * length) / 12

/** Thin rod about a perpendicular axis through one end: 1/3 m L². */
export const rodEnd = (m: number, length: number) => (m * length * length) / 3

/** Inertia about an axis parallel to a centre-of-mass axis, `d` away. */
export const parallelAxis = (iCentre: number, m: number, d: number) =>
  iCentre + m * d * d

/** Spin gained from rest under constant torque: ω = τ t / I. */
export const spinFromTorque = (torque: number, inertia: number, t: number) =>
  (torque * t) / inertia

/** Spin implied by a conserved angular momentum: ω = L / I. */
export const spinFromMomentum = (momentum: number, inertia: number) =>
  momentum / inertia

export type Vec3Tuple = [number, number, number]
/** Row-major 3×3 matrix. */
export type Mat3Tuple = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
]

/** Diagonal of a solid box's inverse local tensor, for full sizes w, h, d. */
export const boxInverseInertia = (
  m: number,
  w: number,
  h: number,
  d: number
): Vec3Tuple => [
  1 / solidBox(m, h, d),
  1 / solidBox(m, w, d),
  1 / solidBox(m, w, h),
]

/** I_world⁻¹ = R · diag(invLocal) · Rᵀ. */
export function inverseInertiaWorld(
  rotation: Mat3Tuple,
  invLocal: Vec3Tuple
): Mat3Tuple {
  const out: Mat3Tuple = [0, 0, 0, 0, 0, 0, 0, 0, 0]
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 3; col++)
      for (let k = 0; k < 3; k++)
        out[row * 3 + col] +=
          rotation[row * 3 + k] * invLocal[k] * rotation[col * 3 + k]
  return out
}
