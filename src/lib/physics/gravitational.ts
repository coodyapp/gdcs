import { Vector3 } from "three"
import { PHYSICS_CONSTANTS } from "@/lib/physics/constants"

export interface WaveSource {
  position: Vector3
  mass1: number
  mass2: number
  orbitalRadius: number
  orbitalFrequency: number
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

export function calculateGravitationalWaveAmplitude(
  source: WaveSource,
  observerPosition: Vector3,
  time: number
): number {
  requireFiniteVector(source.position, "Source position")
  requireFiniteVector(observerPosition, "Observer position")
  requirePositive(source.mass1, "Mass 1")
  requirePositive(source.mass2, "Mass 2")
  requirePositive(source.orbitalRadius, "Orbital radius")
  requireFinite(source.orbitalFrequency, "Orbital frequency")
  if (source.orbitalFrequency < 0)
    throw new Error("Orbital frequency must be non-negative")
  requireFinite(time, "Time")

  const distance = source.position.distanceTo(observerPosition)
  if (distance === 0) throw new Error("Observer distance must be positive")
  const { mass1, mass2, orbitalRadius, orbitalFrequency } = source
  const waveFrequency = 2 * orbitalFrequency

  const larger = Math.max(mass1, mass2)
  const ratio = Math.min(mass1, mass2) / larger
  const reducedMass = (larger * ratio) / (1 + ratio)
  const angularFrequency = 2 * Math.PI * orbitalFrequency
  // Leading quadrupole strain. orbitalRadius means body-to-body separation.
  const amplitude =
    (4 *
      PHYSICS_CONSTANTS.G *
      reducedMass *
      orbitalRadius ** 2 *
      angularFrequency ** 2) /
    (PHYSICS_CONSTANTS.c ** 4 * distance)

  return amplitude * Math.cos(2 * Math.PI * waveFrequency * time)
}

export function calculateStrainTensor(
  amplitude: number,
  polarization: "plus" | "cross"
): number[][] {
  requireFinite(amplitude, "Amplitude")
  const h = amplitude

  if (polarization === "plus") {
    return [
      [h, 0, 0],
      [0, -h, 0],
      [0, 0, 0],
    ]
  } else {
    return [
      [0, h, 0],
      [h, 0, 0],
      [0, 0, 0],
    ]
  }
}
