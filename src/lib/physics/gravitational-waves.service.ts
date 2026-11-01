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

/**
 * Chirp mass of a binary system.
 * M_c = (m1 * m2)^(3/5) / (m1 + m2)^(1/5)
 */
function chirpMass(mass1: number, mass2: number): number {
  const larger = Math.max(mass1, mass2)
  const ratio = Math.min(mass1, mass2) / larger
  return (
    larger * Math.exp((3 / 5) * Math.log(ratio) - (1 / 5) * Math.log1p(ratio))
  )
}

export class GravitationalWavesService {
  /**
   * Leading-order gravitational-wave strain amplitude for a circular binary.
   * h = 4 * (G * M_c / c^2)^(5/3) * (pi * f / c)^(2/3) / r
   */
  static calculateWaveAmplitude(
    mass1: number,
    mass2: number,
    distance: number,
    frequency: number
  ): number {
    requirePositive(mass1, "Mass 1")
    requirePositive(mass2, "Mass 2")
    requirePositive(distance, "Distance")
    requireNonNegative(frequency, "Frequency")
    const { G, c } = PHYSICS_CONSTANTS
    const mc = chirpMass(mass1, mass2)
    if (frequency === 0) return 0
    const logAmplitude =
      Math.log(4) +
      (5 / 3) * Math.log((G * mc) / (c * c)) +
      (2 / 3) * Math.log((Math.PI * frequency) / c) -
      Math.log(distance)
    return Math.exp(logAmplitude)
  }

  /**
   * Orbital frequency from Kepler's third law.
   * f = sqrt(G * (m1 + m2) / a^3) / (2 * pi)
   */
  static calculateFrequency(
    mass1: number,
    mass2: number,
    separation: number
  ): number {
    requirePositive(mass1, "Mass 1")
    requirePositive(mass2, "Mass 2")
    requirePositive(separation, "Separation")
    const { G } = PHYSICS_CONSTANTS
    const larger = Math.max(mass1, mass2)
    const totalMass = larger * (1 + Math.min(mass1, mass2) / larger)
    return (
      Math.exp(
        0.5 * (Math.log(G) + Math.log(totalMass) - 3 * Math.log(separation))
      ) /
      (2 * Math.PI)
    )
  }

  /**
   * Strain amplitude using the chirp-mass quadrupole formula (alias of calculateWaveAmplitude).
   */
  static calculateStrainAmplitude(
    mass1: number,
    mass2: number,
    distance: number,
    frequency: number
  ): number {
    return this.calculateWaveAmplitude(mass1, mass2, distance, frequency)
  }
}
