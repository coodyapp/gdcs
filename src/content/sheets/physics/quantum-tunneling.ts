import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "quantum-tunneling",
  category: "physics",
  subcategory: "quantum-mechanics",
  title: "Quantum Tunneling",
  hook: "a wave leaks through a wall it can't climb",
  summary:
    "A quantum packet hitting a barrier higher than its energy still partly gets through: transmission falls off exponentially with barrier width.",
  level: "advanced",
  tags: ["quantum", "tunneling", "barrier", "transmission", "wave-packet"],
  updated: "2026-11-02",
  prompt:
    "In TypeScript, implement transmission(E, V, a) for a 1D rectangular potential barrier in natural units (ħ = m = 1), covering E < V (sinh form), E > V (sin form) and the E = V limit, returning 0 for E ≤ 0. Then build a Three.js visual: a translucent barrier box of height V and width a, a dashed line at height E, and a Gaussian |ψ|² curve drawn on that line that travels at speed √(2E) and splits into a transmitted part (scaled by T) and a reflected mirror image (scaled by 1−T) at the barrier's left face, updating a preallocated buffer each frame. Unit-test that T + R = 1, that T decreases monotonically with a when E < V, that T = 1 at ka = π for E > V, and continuity across E = V within 1e-4.",
  related: ["particle-in-box", "schrodinger-2d", "tunneling"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Classically, a ball with energy `E` cannot cross a hill of height `V > E`. A quantum particle is a wave, and inside the barrier its wavefunction does not stop dead. It decays exponentially as `e^(−κx)`. If the barrier is thin enough, some amplitude is left on the far side and continues as a transmitted wave.",
    "For a rectangular barrier the transmission probability `T` has an exact closed form. Below the top (`E < V`) it is dominated by `e^(−2κa)`, so doubling the width squares the suppression. Above the top (`E > V`) `T` is still not 1: the packet partly reflects off the step and shows resonances where whole half-waves fit inside the barrier.",
    "Tunneling explains alpha decay, scanning tunneling microscopes, flash memory and tunnel diodes. In code it is a good stress test for a [Schrödinger](/physics/quantum-mechanics/schrodinger-2d) solver: compare your measured `T` against the formula. It is unrelated to [physics-engine tunneling](/systems/collision/tunneling), where fast objects skip through thin colliders between steps.",
  ],
  formulas: [
    {
      label: "Time-dependent Schrödinger equation (1D)",
      math: tex`i\hbar\,\frac{\partial \psi}{\partial t} = -\frac{\hbar^2}{2m}\frac{\partial^2 \psi}{\partial x^2} + V(x)\,\psi`,
    },
    {
      label: "Decay constant inside the barrier",
      math: tex`\kappa = \frac{\sqrt{2m(\textcolor{#a3a3a3}{V} - \textcolor{#fdc700}{E})}}{\hbar}`,
    },
    {
      label: "Exact transmission, E < V",
      math: tex`T = \left[1 + \frac{V^2 \sinh^2(\kappa a)}{4E(V-E)}\right]^{-1}`,
    },
    {
      label: "Opaque-barrier limit",
      math: tex`T \approx 16\,\frac{E}{V}\left(1 - \frac{E}{V}\right) e^{-2\kappa a}\quad (\kappa a \gg 1)`,
    },
    {
      label: "Above the barrier, E > V",
      math: tex`T = \left[1 + \frac{V^2 \sin^2(k a)}{4E(E-V)}\right]^{-1},\quad k = \frac{\sqrt{2m(E-V)}}{\hbar}`,
      note: "T = 1 exactly when ka = nπ (transmission resonance).",
    },
  ],
  rules: [
    "In natural units (`ħ = m = 1`) κ = √(2(V − E)); κa ≳ 3 already means T below about 1 %.",
    "Handle E = V separately: the limit is T = 1 / (1 + mVa²/(2ħ²)), and the general formula divides by zero there.",
    "Electron, 1 eV below the top of a 1 nm barrier: κ ≈ 5.1 nm⁻¹, T ~ 10⁻⁴. At 0.5 nm it rises to ~10⁻².",
    "A packet's group velocity is ħk/m = √(2E/m). Faster packets carry more energy and tunnel more.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Rectangular-barrier transmission (ħ = m = 1), safe at E = V:",
      code: `export function transmission(E: number, V: number, a: number): number {
  if (E <= 0) return 0
  if (Math.abs(E - V) < 1e-9) return 1 / (1 + (V * a * a) / 2)
  if (E < V) {
    const kappa = Math.sqrt(2 * (V - E))
    const s = Math.sinh(kappa * a)
    return 1 / (1 + (V * V * s * s) / (4 * E * (V - E)))
  }
  const k = Math.sqrt(2 * (E - V))
  const s = Math.sin(k * a)
  return 1 / (1 + (V * V * s * s) / (4 * E * (E - V)))
}

// Reflection is whatever is not transmitted (probability is conserved).
export const reflection = (E: number, V: number, a: number) =>
  1 - transmission(E, V, a)`,
    },
  ],
  mistakes: [
    "Assuming everything passes when E > V. Above-barrier reflection is real and oscillates with width.",
    "Using sinh(κa) for large κa without care: it overflows near κa ≈ 710. Switch to the exponential approximation first.",
    "Scaling the packet's height with its energy. |ψ|² integrates to 1 whatever the energy.",
    "Calling a barrier's T a 'speed' or a delay. It is a probability, measured over many particles.",
  ],
  reading: [
    {
      title:
        "OpenStax University Physics Vol. 3 — Quantum Tunneling of Particles through Potential Barriers",
      url: "https://openstax.org/books/university-physics-volume-3/pages/7-6-the-quantum-tunneling-of-particles-through-potential-barriers",
    },
  ],
  visual:
    "The thick solid white curve is the packet's probability density riding on the dashed yellow energy line E, and the translucent grey block is the barrier (height V, width a). Lower the energy below the barrier top or widen the barrier and the transmitted bump shrinks; the readout shows the exact T and R.",
}

export default sheet
