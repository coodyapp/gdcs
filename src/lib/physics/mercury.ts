import { Vector3 } from "three"
import { PHYSICS_CONSTANTS } from "@/lib/physics/constants"

/**
 * Mercury perihelion precession helpers.
 *
 * The rendered orbit uses dimensionless "sim units": the semi-major axis is
 * a = 8, mass is measured in solar masses, G_sim = 1 and c_sim = 8. Real SI
 * constants at a = 8 render units would give superluminal, unstable orbits, so
 * c_sim is tuned small enough that Δω = 6πGM / (c²a(1−e²)) is visible while
 * the weak-field condition v ≪ c still holds. The real-Mercury reference
 * (`calculateRealPrecessionPerOrbit`) stays in SI units.
 */
export const SIM_G = 1
export const SIM_C = 8
/** Semi-major axis of the demo orbit, in sim units. */
export const SIM_SEMI_MAJOR_AXIS = 8
/** Fixed RK4 step in sim seconds. */
export const FIXED_TIME_STEP = 1 / 120

const SOLAR_MASS_KG = PHYSICS_CONSTANTS.M_sun
const simMass = (kg: number) => kg / SOLAR_MASS_KG

function validateOrbitParameters(
  mass: number,
  semiMajorAxis: number,
  eccentricity: number
): void {
  if (![mass, semiMajorAxis, eccentricity].every(Number.isFinite)) {
    throw new Error("Orbit parameters must be finite")
  }
  if (
    mass <= 0 ||
    semiMajorAxis <= 0 ||
    eccentricity < 0 ||
    eccentricity >= 1
  ) {
    throw new Error(
      "Orbit requires positive mass and axis, with 0 <= eccentricity < 1"
    )
  }
}

/**
 * Relativistic perihelion precession per orbit (Schwarzschild), in sim units.
 * Δω = 6πGM / (c²a(1−e²))   [radians per orbit]
 */
export function calculatePrecessionPerOrbit(
  centralMassKg: number,
  semiMajorAxis: number,
  eccentricity: number
): number {
  validateOrbitParameters(centralMassKg, semiMajorAxis, eccentricity)
  const M = simMass(centralMassKg)
  return (
    (6 * Math.PI * SIM_G * M) /
    (SIM_C * SIM_C * semiMajorAxis * (1 - eccentricity * eccentricity))
  )
}

/** Real perihelion precession per orbit in SI units (Mercury: ~43″/century). */
export function calculateRealPrecessionPerOrbit(
  centralMassKg: number,
  semiMajorAxisMeters: number,
  eccentricity: number
): number {
  validateOrbitParameters(centralMassKg, semiMajorAxisMeters, eccentricity)
  const { G, c } = PHYSICS_CONSTANTS
  return (
    (6 * Math.PI * G * centralMassKg) /
    (c * c * semiMajorAxisMeters * (1 - eccentricity * eccentricity))
  )
}

/** Orbital speed from the vis-viva equation in sim units: v² = GM(2/r − 1/a). */
export function calculateOrbitalVelocity(
  centralMassKg: number,
  radius: number,
  semiMajorAxis: number
): number {
  if (![centralMassKg, radius, semiMajorAxis].every(Number.isFinite)) {
    throw new Error("Orbit parameters must be finite")
  }
  if (
    centralMassKg <= 0 ||
    radius <= 0 ||
    semiMajorAxis <= 0 ||
    radius >= 2 * semiMajorAxis
  ) {
    throw new Error("Mass and radii must define a bound orbit")
  }
  const M = simMass(centralMassKg)
  return Math.sqrt(SIM_G * M * (2 / radius - 1 / semiMajorAxis))
}

/** Newtonian orbital period in sim seconds: T = 2π√(a³/GM). */
export function calculateOrbitalPeriod(
  centralMassKg: number,
  semiMajorAxis: number
): number {
  validateOrbitParameters(centralMassKg, semiMajorAxis, 0)
  return (
    2 *
    Math.PI *
    Math.sqrt(semiMajorAxis ** 3 / (SIM_G * simMass(centralMassKg)))
  )
}

// Scratch buffers for the allocation-free integrator: k1..k4 derivatives and a probe state.
const k1 = new Float64Array(6)
const k2 = new Float64Array(6)
const k3 = new Float64Array(6)
const k4 = new Float64Array(6)
const PROBE = new Float64Array(6)

/** d/dt [x, y, z, vx, vy, vz] for Newtonian gravity plus the 1PN Schwarzschild term. */
function derivative(
  s: Float64Array,
  M: number,
  relativity: boolean,
  out: Float64Array
): void {
  const x = s[0]
  const y = s[1]
  const z = s[2]
  const vx = s[3]
  const vy = s[4]
  const vz = s[5]
  out[0] = vx
  out[1] = vy
  out[2] = vz
  const r2 = x * x + y * y + z * z
  const r = Math.sqrt(r2)
  if (r < 1e-9) {
    out[3] = out[4] = out[5] = 0
    return
  }
  // a = −GM/r² · r̂ · (1 + 3L²/(c²r²)), with L = |r × v| (specific angular momentum).
  let factor = 1
  if (relativity) {
    const lx = y * vz - z * vy
    const ly = z * vx - x * vz
    const lz = x * vy - y * vx
    const L2 = lx * lx + ly * ly + lz * lz
    if (L2 > 1e-20) factor += (3 * L2) / (SIM_C * SIM_C * r2)
  }
  const k = (-SIM_G * M * factor) / (r2 * r)
  out[3] = k * x
  out[4] = k * y
  out[5] = k * z
}

/**
 * One RK4 step, in place, on a packed state [x, y, z, vx, vy, vz] (sim units).
 * Allocation-free, so it is safe to call thousands of times per frame.
 */
export function stepOrbitInPlace(
  state: Float64Array,
  centralMassKg: number,
  showRelativity: boolean,
  dt: number
): void {
  const M = simMass(centralMassKg)
  derivative(state, M, showRelativity, k1)
  for (let i = 0; i < 6; i++) PROBE[i] = state[i] + k1[i] * (dt / 2)
  derivative(PROBE, M, showRelativity, k2)
  for (let i = 0; i < 6; i++) PROBE[i] = state[i] + k2[i] * (dt / 2)
  derivative(PROBE, M, showRelativity, k3)
  for (let i = 0; i < 6; i++) PROBE[i] = state[i] + k3[i] * dt
  derivative(PROBE, M, showRelativity, k4)
  for (let i = 0; i < 6; i++) {
    state[i] += (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])
  }
}

export interface OrbitState {
  position: Vector3
  velocity: Vector3
}

/** Immutable RK4 step (convenience wrapper around `stepOrbitInPlace`). */
export function advanceOrbitState(
  state: OrbitState,
  centralMassKg: number,
  showRelativity: boolean,
  dt: number
): OrbitState {
  if (!Number.isFinite(dt) || dt <= 0)
    throw new Error("Time step must be finite and positive")
  validateOrbitParameters(centralMassKg, 1, 0)
  const s = new Float64Array(6)
  state.position.toArray(s, 0)
  state.velocity.toArray(s, 3)
  stepOrbitInPlace(s, centralMassKg, showRelativity, dt)
  return {
    position: new Vector3(s[0], s[1], s[2]),
    velocity: new Vector3(s[3], s[4], s[5]),
  }
}
