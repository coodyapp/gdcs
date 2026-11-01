import { Vector3 } from "three"
import { calculateBarycentricPositions } from "@/lib/physics/binary-orbit"
import { PHYSICS_CONSTANTS } from "@/lib/physics/constants"

export interface CelestialBody {
  position: Vector3
  velocity: Vector3
  mass: number
  radius: number
}

function requireFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`)
}

function requirePositive(value: number, name: string): void {
  requireFinite(value, name)
  if (value <= 0) throw new Error(`${name} must be positive`)
}

function requireFiniteVector(value: Vector3, name: string): void {
  if (![value.x, value.y, value.z].every(Number.isFinite)) {
    throw new Error(`${name} must contain finite coordinates`)
  }
}

export function calculateGravitationalForce(
  body1: CelestialBody,
  body2: CelestialBody
): Vector3 {
  requireFiniteVector(body1.position, "Body 1 position")
  requireFiniteVector(body2.position, "Body 2 position")
  requirePositive(body1.mass, "Body 1 mass")
  requirePositive(body2.mass, "Body 2 mass")
  const direction = body2.position.clone().sub(body1.position)
  const distance = direction.length()

  if (distance < 0.001) return new Vector3()

  const forceMagnitude =
    (PHYSICS_CONSTANTS.G * body1.mass * body2.mass) / distance ** 2
  return direction.normalize().multiplyScalar(forceMagnitude)
}

export function calculateGravitationalAcceleration(
  body: CelestialBody,
  force: Vector3
): Vector3 {
  requirePositive(body.mass, "Body mass")
  requireFiniteVector(force, "Force")
  return force.clone().divideScalar(body.mass)
}

export function schwarzschildRadius(mass: number): number {
  requireFinite(mass, "Mass")
  if (mass < 0) throw new Error("Mass must be non-negative")
  return (2 * PHYSICS_CONSTANTS.G * mass) / PHYSICS_CONSTANTS.c ** 2
}

export function escapeVelocity(mass: number, radius: number): number {
  requireFinite(mass, "Mass")
  if (mass < 0) throw new Error("Mass must be non-negative")
  requirePositive(radius, "Radius")
  return Math.sqrt((2 * PHYSICS_CONSTANTS.G * mass) / radius)
}

/**
 * Calculate combined gravitational field from two masses
 * Used for binary black hole systems
 */
export function calculateBinaryPotentialProxy(
  x: number,
  y: number,
  mass1: number,
  mass2: number,
  separation: number,
  phase: number
): number {
  ;[x, y, phase].forEach((value, index) =>
    requireFinite(value, ["X", "Y", "Phase"][index])
  )
  requirePositive(mass1, "Mass 1")
  requirePositive(mass2, "Mass 2")
  requirePositive(separation, "Separation")
  const positions = calculateBarycentricPositions(
    mass1,
    mass2,
    separation,
    phase
  )

  // Distance to each mass
  const r1 = Math.sqrt(
    (x - positions.body1.x) ** 2 + (y - positions.body1.z) ** 2
  )
  const r2 = Math.sqrt(
    (x - positions.body2.x) ** 2 + (y - positions.body2.z) ** 2
  )

  // Combined gravitational potential
  const minRadius = 0.5
  const curvature1 = -mass1 / Math.max(r1, minRadius)
  const curvature2 = -mass2 / Math.max(r2, minRadius)

  return curvature1 + curvature2
}

/**
 * Simple spacetime curvature calculation for visualization
 * Based on simplified Schwarzschild metric
 */
export function calculatePotentialWellProxy(
  x: number,
  y: number,
  mass: number
): number {
  requireFinite(x, "X")
  requireFinite(y, "Y")
  requireFinite(mass, "Mass")
  if (mass < 0) throw new Error("Mass must be non-negative")
  // Distance from center
  const r = Math.sqrt(x * x + y * y)

  // Avoid singularity at center
  const minRadius = 0.5
  const effectiveRadius = Math.max(r, minRadius)

  // Simplified gravitational potential
  const curvature = -mass / effectiveRadius

  // Apply smooth falloff
  const falloff = Math.exp(-effectiveRadius / 5)

  return curvature * falloff
}

/** @deprecated Use calculateBinaryPotentialProxy; result is not spacetime curvature. */
export const calculateBinarySystem = calculateBinaryPotentialProxy

/** @deprecated Use calculatePotentialWellProxy; result is a stylized potential well. */
export const calculateSpacetimeCurvatureSimple = calculatePotentialWellProxy
