/**
 * 1D FDTD (Yee) grid in normalised units (c = 1, Δx = 1, η₀ = 1).
 * Ey lives on integer nodes, Hz on the half nodes between them, and they
 * leapfrog in time. The Courant number S = cΔt/Δx must stay ≤ 1.
 */
export interface Fdtd1D {
  n: number
  ey: Float64Array
  /** hz[i] sits between ey[i] and ey[i + 1]. */
  hz: Float64Array
  /** Relative permittivity per node (1 = vacuum). */
  eps: Float64Array
  /** Previous edge values for the Mur absorbing boundary. */
  mur: Float64Array
  time: number
  steps: number
}

export function createFdtd(n: number): Fdtd1D {
  return {
    n,
    ey: new Float64Array(n),
    hz: new Float64Array(n - 1),
    eps: new Float64Array(n).fill(1),
    mur: new Float64Array(4),
    time: 0,
    steps: 0,
  }
}

export function resetFdtd(g: Fdtd1D) {
  g.ey.fill(0)
  g.hz.fill(0)
  g.mur.fill(0)
  g.time = 0
  g.steps = 0
}

/** Largest stable Courant number in 1D. */
export const COURANT_LIMIT_1D = 1

/**
 * One leapfrog step with Courant number S. `source(t)` is added to Ey at
 * `sourceIndex` (a soft source, so waves pass through it). Both ends use a
 * first-order Mur absorbing boundary, exact at S = 1.
 */
export function stepFdtd(
  g: Fdtd1D,
  S: number,
  sourceIndex = -1,
  source?: (t: number) => number
) {
  const { n, ey, hz, eps, mur } = g
  // Remember edge values for Mur before Ey changes.
  mur[0] = ey[0]
  mur[1] = ey[1]
  mur[2] = ey[n - 1]
  mur[3] = ey[n - 2]
  // H half-step: ∂Hz/∂t = −∂Ey/∂x
  for (let i = 0; i < n - 1; i++) hz[i] -= S * (ey[i + 1] - ey[i])
  // E step: ∂Ey/∂t = −(1/ε) ∂Hz/∂x
  for (let i = 1; i < n - 1; i++) ey[i] -= (S / eps[i]) * (hz[i] - hz[i - 1])
  g.time += S
  if (source && sourceIndex > 0) ey[sourceIndex] += source(g.time)
  const m = (S - 1) / (S + 1)
  ey[0] = mur[1] + m * (ey[1] - mur[0])
  ey[n - 1] = mur[3] + m * (ey[n - 2] - mur[2])
  g.steps++
}

/** Discrete field energy ½Σ(εE² + H²): use it to spot blow-ups. */
export function fdtdEnergy(g: Fdtd1D) {
  let e = 0
  for (let i = 0; i < g.n; i++) e += g.eps[i] * g.ey[i] * g.ey[i]
  for (let i = 0; i < g.n - 1; i++) e += g.hz[i] * g.hz[i]
  return 0.5 * e
}
