import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "boltzmann-distribution",
  category: "physics",
  subcategory: "thermodynamics",
  title: "Boltzmann Energy Distribution",
  hook: "high energy is possible, just exponentially rare",
  summary:
    "At temperature T a state of energy E is weighted by e^(−E/kT). Metropolis sampling reproduces the distribution with a simple accept/reject rule.",
  level: "advanced",
  tags: [
    "statistical-mechanics",
    "boltzmann",
    "metropolis",
    "monte-carlo",
    "sampling",
  ],
  updated: "2026-11-02",
  prompt:
    "Write a Metropolis sampler for the Boltzmann energy distribution in TypeScript. Inputs: a Float32Array of walker energies, temperature kT, density-of-states exponent p (g ∝ E^p) and a seeded PRNG. Each sweep proposes E' = |E + δ| with δ uniform in ±max(0.3, kT) and accepts with min(1, (E'/E)^p·e^(−(E'−E)/kT)), handling E = 0 and p = 0 safely; return the acceptance ratio. Also implement the normalised density E^p·e^(−E/kT)/(Γ(p+1)·kT^(p+1)) with a Lanczos gamma. Render a 48-bin exponentially averaged histogram as an InstancedMesh with the theory curve overlaid in Three.js. Tests: density integrates to 1; acceptance matches the reference 3D rule for p = ½; mean energy after burn-in is (p+1)kT within 5% for p = 0, ½ and 1.5.",
  related: ["ideal-gas", "heat-diffusion", "finite-state-machine"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "In thermal equilibrium the probability of finding a system in a particular state falls off exponentially with that state's energy: `e^(−E/kT)`. Temperature sets the scale: at low T almost everything sits near the ground state, at high T the tail reaches far.",
    "What you measure is usually the probability of an **energy**, not a single state, so the Boltzmann factor is multiplied by the **density of states** `g(E)`, the number of states with that energy. For a 3D ideal gas `g ∝ √E`, which turns the plain exponential into a hump that peaks at `kT/2` and has mean `(3/2)kT`. In general, with `g ∝ E^p`, the mean is `(p + 1)kT`.",
    "The **Metropolis** algorithm samples this without ever computing the normalisation: propose a small random change, always accept it if the weighted probability goes up, otherwise accept it with probability equal to the ratio. Run many walkers and their histogram converges to the target distribution.",
    "In games the same accept-uphill-sometimes rule is simulated annealing for level generation and layout, and Boltzmann (softmax) weights pick AI actions with a tunable 'temperature' of randomness. The physical picture connects to the [ideal gas](/physics/thermodynamics/ideal-gas), whose particle energies follow exactly the p = ½ curve.",
  ],
  formulas: [
    {
      label: "Energy distribution",
      math: tex`\textcolor{#fafafa}{P(E)} = \frac{g(E)\, e^{-E/k_B T}}{Z}, \qquad Z = \int_0^\infty g(E)\, e^{-E/k_B T}\, dE`,
    },
    {
      label: "Power-law density of states",
      math: tex`g(E) \propto E^{p} \;\Rightarrow\; P(E) = \frac{E^{p}\, e^{-E/k_B T}}{\Gamma(p+1)\,(k_B T)^{p+1}}`,
      note: "p = ½ for a 3D gas, 0 in 2D, −½ in 1D.",
    },
    {
      label: "Mean and most likely energy",
      math: tex`\textcolor{#f5d547}{\langle E \rangle} = (p+1)\,k_B T, \qquad E_{\text{peak}} = p\,k_B T`,
    },
    {
      label: "Metropolis acceptance",
      math: tex`A(E \to E') = \min\!\left(1,\; \frac{g(E')}{g(E)}\, e^{-(E' - E)/k_B T}\right)`,
    },
    { label: "Gibbs entropy", math: tex`S = -k_B \sum_i p_i \ln p_i` },
  ],
  rules: [
    "Use a symmetric proposal, e.g. `E' = |E + δ|` with δ uniform in ±kT; asymmetric proposals need the Hastings correction.",
    "Aim for 30–60% acceptance: scale the step with kT so it stays in that range at every temperature.",
    "Discard the first few hundred sweeps (burn-in) before measuring averages.",
    "1,000–4,000 walkers gives a smooth 40–60 bin histogram; average it over a few sweeps to hide noise.",
    "Softmax action choice is the same formula: P(a) ∝ e^(score/T). T → 0 is greedy, large T is uniform random.",
  ],
  code: [
    {
      lang: "ts",
      caption: "One Metropolis sweep over many walkers (no allocation):",
      code: `export function sweep(E: Float32Array, kT: number, p: number, rand: () => number) {
  let accepted = 0
  for (let i = 0; i < E.length; i++) {
    const e = E[i]
    const next = Math.abs(e + (rand() * 2 - 1) * kT) // symmetric proposal
    const ratio =
      e === 0 ? 1 : (next / e) ** p * Math.exp(-(next - e) / kT) // g(E) = E^p
    if (rand() < Math.min(1, ratio)) {
      E[i] = next
      accepted++
    }
  }
  return accepted / E.length // keep near 0.3–0.6
}`,
    },
  ],
  mistakes: [
    "Forgetting the density of states and expecting a pure exponential: a 3D gas has very few particles near zero energy.",
    "Rejecting a move and then not counting the old state again; a rejection still produces a sample.",
    "Using a proposal that cannot reach negative-side reflections symmetrically (e.g. clamping to 0), which biases low energies.",
    "Measuring averages before burn-in, so the result still remembers the starting energy.",
  ],
  reading: [
    {
      title:
        "OpenStax University Physics Vol. 2 — Distribution of Molecular Speeds",
      url: "https://openstax.org/books/university-physics-volume-2/pages/2-4-distribution-of-molecular-speeds",
    },
  ],
  visual:
    "Solid white bars are the histogram P(E) of 1,500 Metropolis walkers (small white dots below the axis), the solid white curve is the exact distribution, and the dashed yellow line marks the theoretical mean energy ⟨E⟩ while the yellow ball tracks the walkers' mean. Every walker starts at the same low energy; raise T to broaden the curve or change p to switch between 1D, 2D and 3D-like systems.",
}

export default sheet
