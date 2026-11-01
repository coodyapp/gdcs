export function calculateBoltzmannAcceptance(
  oldEnergy: number,
  newEnergy: number,
  temperature: number
) {
  if (![oldEnergy, newEnergy, temperature].every(Number.isFinite)) {
    throw new Error("Energies and temperature must be finite")
  }
  if (oldEnergy < 0 || newEnergy < 0) {
    throw new Error("Energies must be non-negative")
  }
  if (temperature <= 0) {
    throw new Error("Temperature must be positive")
  }

  // Three-dimensional density of states is proportional to sqrt(E).
  if (oldEnergy === 0) return newEnergy === 0 ? 1 : 1
  if (newEnergy === 0) return 0
  const densityRatio = Math.sqrt(newEnergy / oldEnergy)
  const boltzmannRatio = Math.exp(-(newEnergy - oldEnergy) / temperature)

  return Math.min(1, densityRatio * boltzmannRatio)
}
