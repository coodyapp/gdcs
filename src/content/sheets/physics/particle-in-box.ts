import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "particle-in-box",
  category: "physics",
  subcategory: "quantum-mechanics",
  title: "Particle in a Box",
  hook: "walls force whole half-waves, so energy comes in steps",
  summary:
    "A particle trapped between hard walls can only hold standing waves, so its energy is quantized as n² and superpositions slosh at beat frequencies.",
  level: "common",
  tags: [
    "quantum",
    "schrodinger",
    "eigenstates",
    "superposition",
    "standing-waves",
  ],
  updated: "2026-11-01",
  prompt:
    "Write a TypeScript module plus a Three.js visual for a particle in an infinite square well. Use natural units (ħ = m = L = 1, E_n = n²). Export boxDensity(out: Float32Array, t, n, mix) that fills |Ψ(x,t)|² for Ψ = √(1−mix)·ψ1·e^{−it} + √mix·ψn·e^{−in²t} with ψk = √2·sin(kπx), allocation-free. Render the density as a line between two wall meshes and move a marker to ⟨x⟩ each frame by updating buffers in place. Clamp n to integers 2–6 and mix to 0–0.95. Write unit tests: the density integrates to 1 (trapezoid rule, 1e-3 tolerance) at several times, and with mix = 0 it is time-independent.",
  related: ["quantum-tunneling", "schrodinger-2d", "spring-mass-oscillator"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Put a particle between two infinitely high walls a distance `L` apart. The wavefunction must vanish at both walls, so only waves that fit a whole number of half-wavelengths survive: `sin(nπx/L)` for `n = 1, 2, 3…`. Each of these **eigenstates** has a fixed energy that grows as `n²`.",
    "A single eigenstate is *stationary*: its phase spins at a rate set by its energy, but `|ψ|²` never changes. Mix two eigenstates and the phases drift apart. Their interference makes the probability density slosh from wall to wall at the **beat frequency** `(E_n − E_1)/ħ`.",
    "This is the simplest model of quantization (electrons in a quantum dot, conjugated molecules, a guitar string's harmonics) and a good first test case for any [Schrödinger](/physics/quantum-mechanics/schrodinger-2d) solver, because the answer is exact. Real walls are finite, which is where [tunneling](/physics/quantum-mechanics/quantum-tunneling) comes in.",
  ],
  formulas: [
    {
      label: "Eigenstates",
      math: tex`\psi_n(x) = \sqrt{\tfrac{2}{L}}\,\sin\!\left(\frac{n\pi x}{L}\right),\quad 0 \le x \le L`,
    },
    {
      label: "Energy levels",
      math: tex`E_n = \frac{n^2 \pi^2 \hbar^2}{2 m L^2} = n^2 E_1`,
    },
    {
      label: "Two-state superposition",
      math: tex`\Psi(x,t) = a_1 \psi_1 e^{-iE_1 t/\hbar} + a_n \psi_n e^{-iE_n t/\hbar},\quad |a_1|^2 + |a_n|^2 = 1`,
    },
    {
      label: "Beat period of the density",
      math: tex`T_{\text{beat}} = \frac{2\pi\hbar}{E_n - E_1} = \frac{2\pi\hbar}{(n^2-1)E_1}`,
      note: "With even n the density sloshes left–right; odd n keeps ⟨x⟩ = L/2 by symmetry.",
    },
  ],
  rules: [
    "Natural units (`ħ = m = L = 1`, energies in `E_1`) keep the numbers near 1; the visual uses them.",
    "An electron in a 1 nm box has `E_1 ≈ 0.38 eV`, so the n = 1 → 2 gap is ≈ 1.1 eV (near-infrared light).",
    "Sample at least ~20 points per half-wave: n = 6 needs ≥ 120 samples across the box to look smooth.",
    "Amplitudes are √(probability): a 45 % excited mix means `a_n = √0.45 ≈ 0.67`, not 0.45.",
  ],
  code: [
    {
      lang: "ts",
      caption:
        "Probability density of a two-level superposition, written into a reusable buffer:",
      code: `// Natural units: ħ = m = L = 1, energies in units of E1, so E_n = n².
export function boxDensity(
  out: Float32Array, // length = samples
  t: number,
  n: number,
  mix: number // probability in the excited state, 0..1
) {
  const a1 = Math.sqrt(1 - mix)
  const an = Math.sqrt(mix)
  const c1 = Math.cos(t), s1 = Math.sin(t)
  const cn = Math.cos(n * n * t), sn = Math.sin(n * n * t)
  for (let i = 0; i < out.length; i++) {
    const x = i / (out.length - 1)
    const p1 = Math.SQRT2 * a1 * Math.sin(Math.PI * x)
    const pn = Math.SQRT2 * an * Math.sin(n * Math.PI * x)
    const re = p1 * c1 + pn * cn
    const im = -(p1 * s1 + pn * sn)
    out[i] = re * re + im * im // integrates to 1 over [0, 1]
  }
  return out
}`,
    },
  ],
  mistakes: [
    "Using the mix probability as the amplitude, which breaks normalization; amplitudes are square roots.",
    "Animating each eigenstate's density on its own: a single eigenstate's |ψ|² never moves; only the cross term oscillates.",
    "Giving every level the same phase speed. The phase rate is E_n/ħ ∝ n², which sets the beat frequency.",
    "Forgetting the √(2/L) normalization when changing L, so the total probability drifts away from 1.",
  ],
  reading: [
    {
      title:
        "OpenStax University Physics Vol. 3 — The Quantum Particle in a Box",
      url: "https://openstax.org/books/university-physics-volume-3/pages/7-4-the-quantum-particle-in-a-box",
    },
  ],
  visual:
    "The cyan curve is the probability density |Ψ|², the orange curve above it is Re Ψ, and the yellow cone marks the mean position ⟨x⟩. Raise the excited-state mix or pick an even level n to make the density slosh between the grey walls; the readout gives the beat period.",
}

export default sheet
