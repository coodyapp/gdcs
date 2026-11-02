import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "schrodinger-2d",
  category: "physics",
  subcategory: "quantum-mechanics",
  title: "2D Schrödinger Wave Packet",
  hook: "a cloud of probability that spreads, scatters and interferes",
  summary:
    "A Gaussian wave packet in 2D drifts, spreads and splits at a potential bump; brightness shows |ψ|² and colour shows the quantum phase.",
  level: "advanced",
  tags: ["quantum", "schrodinger", "wave-packet", "scattering", "pde"],
  updated: "2026-11-02",
  prompt:
    "Build a 2D time-dependent Schrödinger solver in TypeScript using the split-step Fourier method on an N×N periodic grid (N a power of two, ħ = m = 1). Inputs: grid size, domain length, Δt, a potential V(x,y) (Float32Array), and an initial Gaussian packet (x0, y0, σ0, k0). Each step: half-step potential phase e^{−iVΔt/2}, FFT, kinetic phase e^{−ik²Δt/2}, inverse FFT, half-step potential. Use preallocated Float32Array real/imag buffers. Render |ψ|² as heights of a Three.js PlaneGeometry (≤ 64² vertices) and phase as colour. Add an absorbing edge layer. Tests: norm stays 1 ± 1e-6 over 500 steps with V = 0, and a free packet's width follows σ(t) = σ0√(1 + (t/(2σ0²))²) within 2 %.",
  related: ["quantum-tunneling", "particle-in-box", "heat-diffusion"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "In two dimensions the wavefunction `ψ(x, y, t)` is a complex field over the plane. Its magnitude squared `|ψ|²` is the probability density (where the particle is likely to be found), and its phase `arg ψ` encodes momentum: phase stripes perpendicular to the motion, spaced one de Broglie wavelength apart.",
    "A **Gaussian wave packet** is the most localized state you can build. It moves at the group velocity `ħk/m` and spreads as it goes, because its momentum components travel at different speeds. A narrower start spreads faster, which is the uncertainty principle at work. When it meets a potential bump, part of it is reflected, part goes through, and the pieces carry curved phase fronts.",
    "To get this exactly you have to solve the PDE on a grid. Split-step Fourier and Crank–Nicolson are the usual unconditionally stable choices. The visual here is an **illustrative** model: the packet motion, spreading and split are scripted from analytic pieces rather than integrated. Start from the 1D [particle in a box](/physics/quantum-mechanics/particle-in-box) and [tunneling](/physics/quantum-mechanics/quantum-tunneling) to see the exact results this scene stylizes.",
  ],
  formulas: [
    {
      label: "Time-dependent Schrödinger equation (2D)",
      math: tex`i\hbar\,\partial_t \psi = -\frac{\hbar^2}{2m}\left(\partial_x^2 + \partial_y^2\right)\psi + \textcolor{#f5d547}{V(x,y)}\,\psi`,
    },
    {
      label: "Initial Gaussian packet",
      math: tex`\psi_0(x,y) = \frac{1}{\sqrt{2\pi}\,\sigma_0}\, e^{-\frac{(x-x_0)^2 + (y-y_0)^2}{4\sigma_0^2}}\, e^{i k_0 x}`,
    },
    {
      label: "Free spreading",
      math: tex`\sigma(t) = \sigma_0 \sqrt{1 + \left(\frac{\hbar t}{2 m \sigma_0^2}\right)^2}`,
    },
    {
      label: "Normalization and momentum",
      math: tex`\iint \textcolor{#fafafa}{|\psi|^2}\,dx\,dy = 1,\qquad p = \hbar k_0,\quad \lambda = \frac{2\pi}{k_0}`,
    },
  ],
  rules: [
    "Resolve the wavelength: `k_0·Δx ≤ 1` (6+ grid points per wavelength), or the phase aliases and the packet stalls.",
    "Split-step Fourier is exact for free motion and norm-preserving. Step size is limited by accuracy, not stability.",
    "Pad the domain or add an absorbing layer (complex potential) at the edges, or the packet wraps or reflects back.",
    "CPU grids of 64² update easily at 60 fps; a real 256² solver belongs in a GPU compute or ping-pong shader.",
    "Check that ∑|ψ|²·Δx·Δy stays at 1 to within 1e-6 per step, which catches most integrator bugs.",
  ],
  code: [
    {
      lang: "ts",
      caption:
        "Write |ψ|² into heights and phase into colour, in place (no per-frame allocation):",
      code: `// pos: xyz per vertex of a grid in the XZ plane; col: rgb per vertex.
export function paintPacket(
  pos: Float32Array, col: Float32Array,
  x0: number, sigma: number, k0: number, t: number,
  a: [number, number, number], b: [number, number, number] // phase ramp
) {
  const inv = 1 / (2 * sigma * sigma)
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], z = pos[i + 2]
    const rho = Math.exp(-((x - x0) ** 2 + z * z) * inv) // |ψ|², peak 1
    const phase = k0 * x - 0.5 * k0 * k0 * t // free plane-wave phase
    const m = 0.5 + 0.5 * Math.cos(phase)
    pos[i + 1] = rho * 1.7
    for (let c = 0; c < 3; c++) col[i + c] = (a[c] + (b[c] - a[c]) * m) * rho
  }
}`,
    },
  ],
  mistakes: [
    "Integrating with explicit Euler: the norm grows every step and the field blows up, whatever Δt you pick.",
    "Plotting Re ψ and calling it the density. Use |ψ|², and show the phase separately with hue or a second ramp.",
    "Undersampling the carrier wave (k₀Δx > 1), which makes the packet drift at the wrong speed.",
    "Letting the packet hit hard grid edges and reading the bounce as physics.",
  ],
  reading: [
    {
      title: "OpenStax University Physics Vol. 3 — The Schrödinger Equation",
      url: "https://openstax.org/books/university-physics-volume-3/pages/7-3-the-schrodinger-equation",
    },
  ],
  visual:
    "Surface height and brightness are the density |ψ|² (dark where it is near zero), and the white-to-grey stripes are the phase fronts. The yellow ring around a translucent yellow cylinder is the circular potential V. Raise the potential strength to reflect more of the packet, and widen the initial spread to slow its spreading. The split is illustrative, not a PDE solve.",
}

export default sheet
