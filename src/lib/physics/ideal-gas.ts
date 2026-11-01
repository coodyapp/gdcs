import { gaussian, mulberry32 } from "./seeded-random"

/**
 * Hard-walled box of non-interacting point particles (m = 1, k_B = 1).
 * Velocities are stored for T = 1; the simulation scales them by √T, which
 * is exactly what changing temperature does to a Maxwell–Boltzmann gas.
 */
export interface Gas {
  n: number
  pos: Float32Array
  vel: Float32Array
}

export function createGas(
  n: number,
  half: readonly [number, number, number],
  seed = 1
): Gas {
  const random = mulberry32(seed)
  const pos = new Float32Array(n * 3)
  const vel = new Float32Array(n * 3)
  for (let i = 0; i < n * 3; i++) {
    pos[i] = (random() * 2 - 1) * half[i % 3]
    vel[i] = gaussian(random)
  }
  return { n, pos, vel }
}

/**
 * Advances the first `count` particles by dt·√T with specular wall bounces.
 * Returns the total momentum impulse Σ 2m|vₙ| delivered to all walls.
 */
export function stepGas(
  g: Gas,
  count: number,
  dt: number,
  temperature: number,
  half: readonly [number, number, number]
): number {
  const scale = Math.sqrt(temperature)
  let impulse = 0
  for (let i = 0; i < count * 3; i++) {
    const b = half[i % 3]
    const v = g.vel[i] * scale
    let p = g.pos[i] + v * dt
    if (p > b || p < -b) {
      const wall = p > 0 ? b : -b
      p = 2 * wall - p
      if (p > b || p < -b) p = wall // far outside after a resize: snap in
      g.vel[i] = -g.vel[i]
      impulse += 2 * Math.abs(v)
    }
    g.pos[i] = p
  }
  return impulse
}

/** Kinetic temperature k_B T = m⟨v²⟩/3 of the first `count` particles at temperature scale T. */
export function kineticTemperature(g: Gas, count: number, temperature: number) {
  let sum = 0
  for (let i = 0; i < count * 3; i++) sum += g.vel[i] * g.vel[i]
  return (sum * temperature) / (3 * count)
}

/** Ideal-gas pressure P = N k_B T / V. */
export const idealPressure = (n: number, temperature: number, volume: number) =>
  (n * temperature) / volume

/** Root-mean-square speed √(3 k_B T / m). */
export const rmsSpeed = (temperature: number) => Math.sqrt(3 * temperature)
