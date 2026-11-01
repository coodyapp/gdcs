import { PHYSICS_CONSTANTS } from "@/lib/physics/constants"
import { Vector3, Matrix4 } from "three"

function requireFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`)
}

function requireNonNegative(value: number, name: string): void {
  requireFinite(value, name)
  if (value < 0) throw new Error(`${name} must be non-negative`)
}

function requireFiniteVector(value: Vector3, name: string): void {
  if (![value.x, value.y, value.z].every(Number.isFinite)) {
    throw new Error(`${name} must contain finite coordinates`)
  }
}

/**
 * SpacetimeService - Handles spacetime calculations based on General Relativity
 * Following Single Responsibility Principle
 */
export class SpacetimeService {
  /**
   * Schwarzschild metric in coordinate basis (ct, r, theta, phi).
   * position is Cartesian and only supplies r and theta.
   * @throws Error if position is within the Schwarzschild radius
   */
  static calculateMetricTensor(position: Vector3, mass: number): Matrix4 {
    requireFiniteVector(position, "Position")
    requireNonNegative(mass, "Mass")
    const r = position.length()
    const rs = this.schwarzschildRadius(mass)

    if (r <= rs) {
      throw new Error("Position is within the Schwarzschild radius")
    }

    const factor = 1 - rs / r
    const cosTheta = Math.max(-1, Math.min(1, position.z / r))
    const sinThetaSquared = Math.max(0, 1 - cosTheta * cosTheta)

    // Three.js Matrix4 uses column-major order
    const matrix = new Matrix4()
    matrix.set(
      -factor,
      0,
      0,
      0,
      0,
      1 / factor,
      0,
      0,
      0,
      0,
      r ** 2,
      0,
      0,
      0,
      0,
      r ** 2 * sinThetaSquared
    )
    return matrix
  }

  /**
   * Partial Schwarzschild Christoffel symbols in basis (ct, r, theta, phi).
   * Only Γ^t_tr, Γ^t_rt, and Γ^r_tt are populated.
   */
  static calculatePartialChristoffelSymbols(
    position: Vector3,
    mass: number
  ): number[][][] {
    requireFiniteVector(position, "Position")
    requireNonNegative(mass, "Mass")
    const symbols: number[][][] = Array(4)
      .fill(null)
      .map(() =>
        Array(4)
          .fill(null)
          .map(() => Array(4).fill(0))
      )

    const r = position.length()
    const rs = this.schwarzschildRadius(mass)

    if (r <= rs)
      throw new Error("Position must be outside the Schwarzschild radius")

    // Non-zero components (simplified)
    symbols[0][0][1] = rs / (2 * r * (r - rs))
    symbols[0][1][0] = symbols[0][0][1]
    symbols[1][0][0] = (rs * (r - rs)) / (2 * r ** 3)

    return symbols
  }

  /** @deprecated Use calculatePartialChristoffelSymbols; returned tensor is intentionally partial. */
  static calculateChristoffelSymbols(
    position: Vector3,
    mass: number
  ): number[][][] {
    return this.calculatePartialChristoffelSymbols(position, mass)
  }

  /**
   * Calculate a curvature proxy for visualization.
   */
  static calculateSpacetimeCurvature(position: Vector3, mass: number): number {
    requireFiniteVector(position, "Position")
    requireNonNegative(mass, "Mass")
    const r = position.length()
    if (r === 0) throw new Error("Position must be away from the origin")
    const rs = this.schwarzschildRadius(mass)

    // Schwarzschild vacuum Ricci scalar is zero; this proxy preserves useful visual falloff.
    return rs / r ** 3
  }

  /**
   * Calculate Schwarzschild radius (event horizon)
   */
  static schwarzschildRadius(mass: number): number {
    requireNonNegative(mass, "Mass")
    return (2 * PHYSICS_CONSTANTS.G * mass) / PHYSICS_CONSTANTS.c ** 2
  }

  /**
   * Calculate time dilation factor based on Schwarzschild metric
   */
  static calculateTimeDilation(r: number, mass: number): number {
    requireFinite(r, "Radius")
    if (r <= 0) throw new Error("Radius must be positive")
    requireNonNegative(mass, "Mass")
    const rs = this.schwarzschildRadius(mass)
    if (r <= rs) return 0

    return Math.sqrt(1 - rs / r)
  }

  /**
   * Calculate a curvature proxy for visualization purposes.
   */
  static calculateCurvatureProxy(x: number, y: number, mass: number): number {
    requireFinite(x, "X")
    requireFinite(y, "Y")
    requireNonNegative(mass, "Mass")
    const r = Math.sqrt(x * x + y * y)
    const minRadius = 0.5
    const effectiveRadius = Math.max(r, minRadius)

    // Visualization proxy: curvature ∝ M/r³.
    return mass / Math.pow(effectiveRadius, 3)
  }

  /** @deprecated Use calculateCurvatureProxy; Schwarzschild vacuum Ricci scalar is zero. */
  static calculateRicciScalar(x: number, y: number, mass: number): number {
    return this.calculateCurvatureProxy(x, y, mass)
  }

  /**
   * Calculate orbital velocity at given radius
   * Based on Newtonian approximation (valid for weak fields)
   */
  static calculateOrbitalVelocity(r: number, mass: number): number {
    requireFinite(r, "Radius")
    if (r <= 0) throw new Error("Radius must be positive")
    requireNonNegative(mass, "Mass")
    return Math.sqrt((PHYSICS_CONSTANTS.G * mass) / r)
  }
}

/**
 * GravitationalWaveService - Handles gravitational wave calculations
 * Separated for Single Responsibility Principle
 */
export class GravitationalWaveService {
  /**
   * Calculate gravitational wave distortion
   * Based on linearized Einstein equations for weak gravitational waves
   */
  static calculateWaveDistortion(
    x: number,
    y: number,
    time: number,
    amplitude: number,
    frequency: number
  ): number {
    ;[x, y, time, amplitude, frequency].forEach((value) =>
      requireFinite(value, "Wave parameter")
    )
    if (frequency < 0) throw new Error("Frequency must be non-negative")
    if (amplitude === 0) return 0

    const angularFrequency = 2 * Math.PI * frequency
    // Wave vector (propagating in x direction) scaled for the visualization grid.
    const k = angularFrequency * 0.5

    // Plus polarization: h_+ = A cos(ωt - kx)
    const phase = angularFrequency * time - k * x
    const hPlus = amplitude * Math.cos(phase)

    // Cross polarization: h_x = A sin(ωt - kx)
    const hCross = amplitude * Math.sin(phase)

    // Combine polarizations with spatial dependence
    // This creates the characteristic quadrupole pattern
    const distortion =
      hPlus * Math.cos(2 * Math.atan2(y, x)) +
      hCross * Math.sin(2 * Math.atan2(y, x))

    // Apply spatial envelope for visualization
    const r = Math.sqrt(x * x + y * y)
    const envelope = Math.exp((-r * r) / 100)

    return distortion * envelope
  }
}

// Export legacy functions for backward compatibility
export const calculateMetricTensor =
  SpacetimeService.calculateMetricTensor.bind(SpacetimeService)
export const calculateChristoffelSymbols =
  SpacetimeService.calculateChristoffelSymbols.bind(SpacetimeService)
export const calculatePartialChristoffelSymbols =
  SpacetimeService.calculatePartialChristoffelSymbols.bind(SpacetimeService)
export const calculateSpacetimeCurvature =
  SpacetimeService.calculateSpacetimeCurvature.bind(SpacetimeService)
export const calculateGravitationalWave =
  GravitationalWaveService.calculateWaveDistortion.bind(
    GravitationalWaveService
  )
export const calculateRicciScalar =
  SpacetimeService.calculateRicciScalar.bind(SpacetimeService)
export const calculateCurvatureProxy =
  SpacetimeService.calculateCurvatureProxy.bind(SpacetimeService)
export const calculateTimeDilation =
  SpacetimeService.calculateTimeDilation.bind(SpacetimeService)
export const calculateOrbitalVelocity =
  SpacetimeService.calculateOrbitalVelocity.bind(SpacetimeService)
