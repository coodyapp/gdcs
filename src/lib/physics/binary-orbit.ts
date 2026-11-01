export interface BarycentricRadii {
  body1: number
  body2: number
}

export interface BarycentricPositions {
  body1: { x: number; z: number }
  body2: { x: number; z: number }
}

function requirePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`${name} must be finite and positive`)
}

function requireFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`)
}

export function calculateAngularPhase(
  timeSeconds: number,
  frequencyHz: number
) {
  requireFinite(timeSeconds, "Time")
  if (!Number.isFinite(frequencyHz) || frequencyHz < 0) {
    throw new Error("Frequency must be finite and non-negative")
  }
  return 2 * Math.PI * frequencyHz * timeSeconds
}

export function calculateBarycentricRadii(
  mass1: number,
  mass2: number,
  separation: number
): BarycentricRadii {
  requirePositive(mass1, "Mass 1")
  requirePositive(mass2, "Mass 2")
  requirePositive(separation, "Separation")
  const larger = Math.max(mass1, mass2)
  const ratio = Math.min(mass1, mass2) / larger
  const totalMass = larger * (1 + ratio)

  return {
    body1: (separation * mass2) / totalMass,
    body2: (separation * mass1) / totalMass,
  }
}

export function calculateBarycentricPositions(
  mass1: number,
  mass2: number,
  separation: number,
  phase: number
): BarycentricPositions {
  requireFinite(phase, "Phase")
  const radii = calculateBarycentricRadii(mass1, mass2, separation)
  const cosPhase = Math.cos(phase)
  const sinPhase = Math.sin(phase)

  return {
    body1: {
      x: radii.body1 * cosPhase,
      z: radii.body1 * sinPhase,
    },
    body2: {
      x: -radii.body2 * cosPhase,
      z: -radii.body2 * sinPhase,
    },
  }
}
