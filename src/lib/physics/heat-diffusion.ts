/**
 * Explicit (FTCS) finite-difference solver for ∂T/∂t = α∇²T on a square
 * n×n grid with cold (T = 0) edges. Stable only when r = αΔt/Δx² ≤ ¼.
 */
export const HEAT_STABILITY_LIMIT_2D = 0.25

/** Largest stable explicit time step for a 2D grid. */
export const maxStableDt = (alpha: number, dx: number) =>
  (HEAT_STABILITY_LIMIT_2D * dx * dx) / alpha

/** Mesh Fourier number r = αΔt/Δx². */
export const fourierNumber = (alpha: number, dt: number, dx: number) =>
  (alpha * dt) / (dx * dx)

/**
 * One explicit step from `T` into `out` (separate buffers, no allocation).
 * Cells where `fixed[i] >= 0` are held at that temperature (a heater).
 */
export function heatStep(
  T: Float32Array,
  out: Float32Array,
  n: number,
  r: number,
  fixed?: Float32Array
) {
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i
      if (i === 0 || j === 0 || i === n - 1 || j === n - 1) {
        out[k] = 0
      } else if (fixed && fixed[k] >= 0) {
        out[k] = fixed[k]
      } else {
        out[k] =
          T[k] + r * (T[k - 1] + T[k + 1] + T[k - n] + T[k + n] - 4 * T[k])
      }
    }
  }
}
