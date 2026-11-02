import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "heat-diffusion",
  category: "physics",
  subcategory: "thermodynamics",
  title: "Heat Diffusion",
  hook: "each cell drifts toward the average of its neighbours",
  summary:
    "Heat flows down temperature gradients at a rate set by the Laplacian. The explicit grid update is four lines of code, and is stable only if αΔt/Δx² ≤ ¼.",
  level: "common",
  tags: [
    "diffusion",
    "heat-equation",
    "finite-difference",
    "stability",
    "grid",
  ],
  updated: "2026-11-02",
  prompt:
    "Implement a 2D explicit finite-difference heat solver in TypeScript for a Three.js heightfield. Inputs: grid size n, cell size dx, diffusivity alpha, a Float32Array of fixed temperatures (−1 for free cells) and the seconds to advance. Use two preallocated Float32Array buffers (ping-pong), cold Dirichlet edges, and choose Δt = 0.8·dx²/(4α) with as many substeps as needed. Write heights and vertex colours into an existing PlaneGeometry each frame without allocating, and recompute normals. Tests: maxStableDt(0.2, 0.1) = 0.0125; with r = 0.25 a single hot cell never exceeds its start value or goes negative over 300 steps; with r = 0.3 it oscillates to |T| > 10 and negative values within 80 steps.",
  related: ["ideal-gas", "fixed-timestep", "time-slicing"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "The heat equation says a point warms up when it is colder than the average of its surroundings and cools when it is hotter. The second derivative (the **Laplacian**) measures exactly that difference, and the diffusivity `α` sets how fast it evens out.",
    "On a grid, the Laplacian becomes 'sum of the four neighbours minus four times the centre'. The **explicit** (forward-time, centred-space) update adds a fraction `r = αΔt/Δx²` of that difference each step. It is cheap and trivially parallel, which is why it shows up in shaders and cellular simulations.",
    "The catch is stability. In 2D the update is only stable for `r ≤ ¼` (½ in 1D, ⅙ in 3D). Above that, the checkerboard pattern of alternating hot and cold cells grows every step and temperatures go negative. Halving the cell size quarters the allowed time step, so fine grids need many substeps or an implicit solver.",
    "In games the same diffusion step spreads heat, gas, scent maps for AI, influence maps, fog of war softening, wet surfaces and blur. Run it at a [fixed timestep](/systems/simulation/fixed-timestep) and, for big grids, [time-slice](/performance/cpu/time-slicing) it across frames.",
  ],
  formulas: [
    {
      label: "Heat equation",
      math: tex`\frac{\partial \textcolor{#f5d547}{T}}{\partial t} = \alpha \nabla^2 \textcolor{#f5d547}{T} = \alpha\left(\frac{\partial^2 T}{\partial x^2} + \frac{\partial^2 T}{\partial y^2}\right)`,
    },
    {
      label: "Explicit (FTCS) update",
      math: tex`T_{i,j}^{n+1} = T_{i,j}^n + r\left(T_{i+1,j}^n + T_{i-1,j}^n + T_{i,j+1}^n + T_{i,j-1}^n - 4T_{i,j}^n\right)`,
    },
    {
      label: "Stability (mesh Fourier number)",
      math: tex`r = \frac{\alpha\,\Delta t}{\Delta x^2} \le \frac{1}{2d}`,
      note: "¼ in 2D. Larger r makes the scheme oscillate and diverge.",
    },
    {
      label: "Diffusion length",
      math: tex`L \approx \sqrt{4\alpha t}`,
      note: "Spreading time grows with the square of distance.",
    },
  ],
  rules: [
    "Choose Δt = 0.8–0.9 × Δx²/(4α) and run as many substeps per frame as the simulated time needs.",
    "Always read from one buffer and write to another (ping-pong); updating in place mixes old and new values.",
    "Cold edges = Dirichlet (set boundary cells to 0); insulated edges = Neumann (copy the neighbour).",
    "A heater is just cells you reset to a fixed temperature after every step.",
    "Approximate diffusivities: copper 1.1×10⁻⁴ m²/s, steel 1.2×10⁻⁵, water 1.4×10⁻⁷. For games, pick α by how many seconds heat should take to cross the map.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Ping-pong explicit diffusion with a stable step count:",
      code: `export function diffuse(a: Float32Array, b: Float32Array, n: number,
                        alpha: number, dx: number, seconds: number) {
  const dtMax = (dx * dx) / (4 * alpha)
  const steps = Math.ceil(seconds / (0.9 * dtMax))
  const r = (alpha * (seconds / steps)) / (dx * dx) // always <= 0.225
  for (let s = 0; s < steps; s++) {
    for (let j = 1; j < n - 1; j++) {
      for (let i = 1; i < n - 1; i++) {
        const k = j * n + i
        b[k] = a[k] + r * (a[k - 1] + a[k + 1] + a[k - n] + a[k + n] - 4 * a[k])
      }
    }
    ;[a, b] = [b, a] // cold edges stay 0 in both buffers
  }
  return a // latest field
}`,
    },
  ],
  mistakes: [
    "Using the frame delta as Δt: a hitch makes r > ¼ and the grid explodes into a red-and-blue checkerboard.",
    "Updating the grid in place, which makes heat flow faster in the scan direction.",
    "Refining the grid without shrinking Δt; the limit scales with Δx².",
    "Forgetting to clamp or reset the heater cells after each step, so the source slowly cools.",
  ],
  reading: [
    {
      title: "OpenStax University Physics Vol. 2 — Mechanisms of Heat Transfer",
      url: "https://openstax.org/books/university-physics-volume-2/pages/1-6-mechanisms-of-heat-transfer",
    },
  ],
  visual:
    "Height and colour both show temperature T: low and dark grey when cold, rising through grey and yellow to tall, bright yellow when hot, on a plate with cold edges and an yellow heater disc in the middle. Red cells dipping below the plate mean negative, impossible temperatures. Change the diffusivity and heater temperature, and push Δt/Δt_max past 1 to break the stability limit.",
}

export default sheet
