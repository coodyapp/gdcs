/**
 * Charged particle in uniform E and B fields: dv/dt = (q/m)(E + v × B).
 * Three interchangeable steppers that mutate `s` in place and allocate
 * nothing, so they can run inside a render loop.
 */
export interface ParticleState {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
}

export type Vec3Tuple = readonly [number, number, number]

export type LorentzStepper = (
  s: ParticleState,
  E: Vec3Tuple,
  B: Vec3Tuple,
  qm: number,
  dt: number
) => void

/** Explicit Euler: cheap, but spirals outward (gains energy) in a pure B field. */
export const eulerStep: LorentzStepper = (s, E, B, qm, dt) => {
  const ax = qm * (E[0] + s.vy * B[2] - s.vz * B[1])
  const ay = qm * (E[1] + s.vz * B[0] - s.vx * B[2])
  const az = qm * (E[2] + s.vx * B[1] - s.vy * B[0])
  s.x += s.vx * dt
  s.y += s.vy * dt
  s.z += s.vz * dt
  s.vx += ax * dt
  s.vy += ay * dt
  s.vz += az * dt
}

/**
 * Boris push: half electric kick, exact-norm magnetic rotation, half kick.
 * Conserves speed exactly when E = 0, which is why plasma codes use it.
 */
export const borisStep: LorentzStepper = (s, E, B, qm, dt) => {
  const h = 0.5 * qm * dt
  // v⁻ = v + (q/m)E dt/2
  let vx = s.vx + h * E[0]
  let vy = s.vy + h * E[1]
  let vz = s.vz + h * E[2]
  const tx = h * B[0]
  const ty = h * B[1]
  const tz = h * B[2]
  const f = 2 / (1 + tx * tx + ty * ty + tz * tz)
  // v' = v⁻ + v⁻ × t
  const px = vx + (vy * tz - vz * ty)
  const py = vy + (vz * tx - vx * tz)
  const pz = vz + (vx * ty - vy * tx)
  // v⁺ = v⁻ + v' × s, with s = 2t / (1 + t²)
  vx += f * (py * tz - pz * ty)
  vy += f * (pz * tx - px * tz)
  vz += f * (px * ty - py * tx)
  s.vx = vx + h * E[0]
  s.vy = vy + h * E[1]
  s.vz = vz + h * E[2]
  s.x += s.vx * dt
  s.y += s.vy * dt
  s.z += s.vz * dt
}

// Scratch for RK4 (module-level so stepping never allocates).
const k = new Float64Array(24)

function deriv(
  vx: number,
  vy: number,
  vz: number,
  E: Vec3Tuple,
  B: Vec3Tuple,
  qm: number,
  o: number
) {
  k[o] = vx
  k[o + 1] = vy
  k[o + 2] = vz
  k[o + 3] = qm * (E[0] + vy * B[2] - vz * B[1])
  k[o + 4] = qm * (E[1] + vz * B[0] - vx * B[2])
  k[o + 5] = qm * (E[2] + vx * B[1] - vy * B[0])
}

/** Classic fourth-order Runge–Kutta: very accurate, slowly loses energy over long runs. */
export const rk4Step: LorentzStepper = (s, E, B, qm, dt) => {
  // Uniform fields: the derivative only depends on velocity.
  deriv(s.vx, s.vy, s.vz, E, B, qm, 0)
  deriv(
    s.vx + 0.5 * dt * k[3],
    s.vy + 0.5 * dt * k[4],
    s.vz + 0.5 * dt * k[5],
    E,
    B,
    qm,
    6
  )
  deriv(
    s.vx + 0.5 * dt * k[9],
    s.vy + 0.5 * dt * k[10],
    s.vz + 0.5 * dt * k[11],
    E,
    B,
    qm,
    12
  )
  deriv(s.vx + dt * k[15], s.vy + dt * k[16], s.vz + dt * k[17], E, B, qm, 18)
  const w = dt / 6
  s.x += w * (k[0] + 2 * k[6] + 2 * k[12] + k[18])
  s.y += w * (k[1] + 2 * k[7] + 2 * k[13] + k[19])
  s.z += w * (k[2] + 2 * k[8] + 2 * k[14] + k[20])
  s.vx += w * (k[3] + 2 * k[9] + 2 * k[15] + k[21])
  s.vy += w * (k[4] + 2 * k[10] + 2 * k[16] + k[22])
  s.vz += w * (k[5] + 2 * k[11] + 2 * k[17] + k[23])
}

/** Larmor (gyro) radius r = m v⊥ / (|q| B). */
export const larmorRadius = (vPerp: number, B: number, qm: number) =>
  vPerp / Math.abs(qm * B)

/** Cyclotron period T = 2π m / (|q| B). */
export const cyclotronPeriod = (B: number, qm: number) =>
  (2 * Math.PI) / Math.abs(qm * B)

/** Magnitude of the E × B drift for perpendicular fields: E / B (independent of q and m). */
export const exbDriftSpeed = (E: number, B: number) => Math.abs(E / B)
