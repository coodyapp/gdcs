/**
 * Metropolis sampling of the thermal energy distribution
 * P(E) ∝ g(E) e^(−E/kT) with density of states g(E) ∝ E^p
 * (p = ½ for a 3D ideal gas, 0 in 2D, −½ in 1D).
 */

/** Acceptance min(1, (E'/E)^p · e^(−(E'−E)/kT)). Matches calculateBoltzmannAcceptance for p = ½. */
export function metropolisAcceptance(
  oldEnergy: number,
  newEnergy: number,
  temperature: number,
  power: number
) {
  if (power === 0)
    return Math.min(1, Math.exp(-(newEnergy - oldEnergy) / temperature))
  if (oldEnergy === 0) return 1
  if (newEnergy === 0) return power > 0 ? 0 : 1
  return Math.min(
    1,
    (newEnergy / oldEnergy) ** power *
      Math.exp(-(newEnergy - oldEnergy) / temperature)
  )
}

/**
 * One sweep: every walker proposes E' = |E + δ|, δ uniform in ±step (a
 * symmetric proposal), and accepts with the Metropolis rule.
 * Returns the acceptance ratio. Mutates `energies`; no allocation.
 */
export function metropolisSweep(
  energies: Float32Array,
  temperature: number,
  power: number,
  step: number,
  random: () => number
) {
  let accepted = 0
  for (let i = 0; i < energies.length; i++) {
    const e = energies[i]
    const proposal = Math.abs(e + (random() * 2 - 1) * step)
    if (random() < metropolisAcceptance(e, proposal, temperature, power)) {
      energies[i] = proposal
      accepted++
    }
  }
  return accepted / energies.length
}

/** Lanczos approximation of Γ(x) for x > 0. */
export function gammaFunction(x: number): number {
  if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * gammaFunction(1 - x))
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ]
  const z = x - 1
  let a = c[0]
  const t = z + 7.5
  for (let i = 1; i < 9; i++) a += c[i] / (z + i)
  return Math.sqrt(2 * Math.PI) * t ** (z + 0.5) * Math.exp(-t) * a
}

/** Normalised density P(E) = E^p e^(−E/kT) / (Γ(p+1) (kT)^(p+1)). */
export function energyDensity(
  energy: number,
  temperature: number,
  power: number
) {
  if (energy < 0) return 0
  return (
    (energy ** power * Math.exp(-energy / temperature)) /
    (gammaFunction(power + 1) * temperature ** (power + 1))
  )
}

/** Mean energy ⟨E⟩ = (p + 1) kT; for a 3D gas that is the familiar 3/2 kT. */
export const meanThermalEnergy = (temperature: number, power: number) =>
  (power + 1) * temperature
