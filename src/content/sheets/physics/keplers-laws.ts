import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "keplers-laws",
  category: "physics",
  subcategory: "mechanics",
  title: "Kepler's Laws",
  hook: "ellipses, equal areas, and T² ∝ a³",
  summary:
    "Orbits are ellipses with the star at one focus, sweep equal areas in equal times, and have T² ∝ a³. Place planets on rails exactly with Kepler's equation.",
  level: "common",
  tags: ["orbits", "gravity", "kepler", "astronomy", "on-rails"],
  updated: "2026-11-02",
  prompt:
    "Write a TypeScript module for a Three.js space game that places bodies on Kepler orbits. Inputs: semi-major axis a, eccentricity e in [0, 0.99), period T, argument of periapsis ω, and time t. Solve Kepler's equation M = E − e·sin E with Newton (start at π when e > 0.8, wrap M to [−π, π], stop when |Δ| < 1e-12 or 15 iterations), return position relative to the focus rotated by ω, and the velocity vector. Provide orbitLine(samples) for drawing with THREE.Line. Unit tests: residual |E − e sin E − M| < 1e-9 for e up to 0.95, and the area swept from the focus over four equal time slices is equal.",
  related: ["solar-system", "projectile-motion", "fixed-timestep"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Kepler's three laws describe any two-body orbit under inverse-square gravity. **One:** the path is an ellipse with the star at a focus (not the centre). **Two:** the line from star to planet sweeps equal areas in equal times, so the planet races through perihelion and dawdles at aphelion. **Three:** the period squared is proportional to the semi-major axis cubed.",
    'The second law makes "where is the planet at time t?" a puzzle: angle does not grow linearly. The trick is the **mean anomaly** `M = n·t`, which does grow linearly, and Kepler\'s equation `M = E − e·sin E` that converts it into the **eccentric anomaly** `E`. From `E` the position is just `(a·cos E, b·sin E)` measured from the ellipse centre. There is no closed-form inverse, so you solve it with a few Newton iterations.',
    "For games this is the right way to put planets, moons and comets **on rails**: positions are exact for any time, never drift, and can be scrubbed forwards or backwards (time warp, save/load, multiplayer sync). Switch to numerical [n-body integration](/physics/mechanics/solar-system) only for objects that thrust or interact.",
  ],
  formulas: [
    {
      label: "Orbit (focus at origin)",
      math: tex`r(\nu) = \dfrac{a(1-e^2)}{1 + e\cos\nu}`,
    },
    {
      label: "Kepler's equation",
      math: tex`M = n t = E - e \sin E`,
      note: "Solve for E with Newton: E ← E − (E − e sin E − M)/(1 − e cos E).",
    },
    {
      label: "Position from the ellipse centre",
      math: tex`x = a\cos E,\quad y = b\sin E,\quad b = a\sqrt{1-e^2}`,
    },
    { label: "Third law", math: tex`T^2 = \dfrac{4\pi^2 a^3}{G M}` },
    {
      label: "Speed ratio",
      math: tex`\dfrac{\textcolor{#f5d547}{v_{\text{peri}}}}{\textcolor{#f5d547}{v_{\text{apo}}}} = \dfrac{1+e}{1-e}`,
    },
  ],
  rules: [
    "Start Newton at `E = M` for e ≤ 0.8 and at `E = π` above that; 5–10 iterations reach double precision.",
    "Wrap `M` into [−π, π] before solving so large times do not lose precision.",
    "Mean motion `n = 2π/T`. Earth: e ≈ 0.017 (nearly circular); Halley's comet: e ≈ 0.97.",
    "The star sits at `(a·e, 0)` from the ellipse centre; the empty second focus is at `(−a·e, 0)`.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Planet on rails: exact position for any time (Three.js):",
      code: `import * as THREE from "three"

export function solveKepler(M: number, e: number) {
  M = Math.atan2(Math.sin(M), Math.cos(M)) // wrap to [-π, π]
  let E = e > 0.8 ? Math.sign(M || 1) * Math.PI : M
  for (let i = 0; i < 10; i++) {
    E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
  }
  return E
}

/** Position relative to the star (focus) at time t. */
export function orbitPosition(a: number, e: number, period: number, t: number, out: THREE.Vector3) {
  const E = solveKepler((2 * Math.PI * t) / period, e)
  const b = a * Math.sqrt(1 - e * e)
  return out.set(a * (Math.cos(E) - e), 0, b * Math.sin(E))
}`,
    },
  ],
  mistakes: [
    "Advancing the true angle at a constant rate: the planet moves at the same speed everywhere and the second law is violated.",
    "Putting the star at the ellipse centre instead of a focus.",
    "Newton from `E = M` at high eccentricity can overshoot and oscillate; start at π or bisect first.",
    "Integrating orbits with explicit Euler: the planet spirals outward within a few revolutions. Use rails, or a symplectic integrator.",
  ],
  reading: [
    {
      title: "OpenStax University Physics — Kepler's Laws of Planetary Motion",
      url: "https://openstax.org/books/university-physics-volume-1/pages/13-5-keplers-laws-of-planetary-motion",
    },
  ],
  visual:
    "The white star sits at one focus and the yellow planet moves along the solid grey ellipse; the white line is its radius and the dashed yellow line is its velocity v. The translucent white and grey wedges alternate, each takes one eighth of the period, and they all have the same area (the current one is brighter). Raise the eccentricity to see short, wide wedges swept quickly near the star and long, narrow ones swept slowly far away.",
}

export default sheet
