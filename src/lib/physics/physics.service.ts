import { Vector3 } from "three"
import { PHYSICS_CONSTANTS } from "@/lib/physics/constants"

function requirePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`${name} must be finite and positive`)
}

function requireNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be finite and non-negative`)
  }
}

function requireFiniteVector(value: Vector3, name: string): void {
  if (![value.x, value.y, value.z].every(Number.isFinite)) {
    throw new Error(`${name} must contain finite coordinates`)
  }
}

export class PhysicsService {
  static readonly G = PHYSICS_CONSTANTS.G // Gravitational constant (m^3 kg^-1 s^-2)
  static readonly C = PHYSICS_CONSTANTS.c // Speed of light (m/s)

  static calculateGravitationalForce(
    mass1: number,
    mass2: number,
    distance: number
  ): number {
    requirePositive(mass1, "Mass 1")
    requirePositive(mass2, "Mass 2")
    requirePositive(distance, "Distance")
    return (this.G * mass1 * mass2) / (distance * distance)
  }

  static calculateOrbitalVelocity(centralMass: number, radius: number): number {
    requireNonNegative(centralMass, "Central mass")
    requirePositive(radius, "Radius")
    return Math.sqrt((this.G * centralMass) / radius)
  }

  static calculateEscapeVelocity(mass: number, radius: number): number {
    requireNonNegative(mass, "Mass")
    requirePositive(radius, "Radius")
    return Math.sqrt((2 * this.G * mass) / radius)
  }

  static schwarzschildRadius(mass: number): number {
    requireNonNegative(mass, "Mass")
    return (2 * this.G * mass) / (this.C * this.C)
  }

  static calculateNewtonianPotentialOverC2(
    mass: number,
    position: Vector3,
    centerPosition: Vector3
  ): number {
    requireNonNegative(mass, "Mass")
    requireFiniteVector(position, "Position")
    requireFiniteVector(centerPosition, "Center position")
    const r = position.distanceTo(centerPosition)
    if (r === 0) throw new Error("Position must differ from center position")

    const rs = this.schwarzschildRadius(mass)
    return -rs / (2 * r)
  }

  /** @deprecated Use calculateNewtonianPotentialOverC2; this is not curvature. */
  static calculateSpacetimeCurvature(
    mass: number,
    position: Vector3,
    centerPosition: Vector3
  ): number {
    return this.calculateNewtonianPotentialOverC2(
      mass,
      position,
      centerPosition
    )
  }
}
