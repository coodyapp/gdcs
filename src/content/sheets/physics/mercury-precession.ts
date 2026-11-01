import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "mercury-precession",
  category: "physics",
  subcategory: "relativity",
  title: "Mercury's Perihelion Precession",
  hook: "relativity keeps the ellipse from quite closing",
  summary:
    "General relativity adds a small 1/r⁴ pull that makes an orbit's closest point creep forward each lap: about 43 arcseconds per century for Mercury.",
  level: "advanced",
  tags: ["relativity", "orbits", "precession", "rk4", "mercury"],
  updated: "2026-11-01",
  prompt:
    "Implement a Mercury-style perihelion precession demo in TypeScript + Three.js. Use sim units (G = 1, M in solar masses, a = 8, c = 8). Write an allocation-free RK4 step on a Float64Array state [x, y, z, vx, vy, vz] with acceleration −GM r̂/r²·(1 + 3L²/(c²r²)) when GR is on. Launch at perihelion r0 = a(1−e) with vis-viva speed, and run fixed 1/120 s substeps (time scale = substeps per fixed tick) with a clamped accumulator. Draw a 720-point ring-buffered trail spanning ~4 orbits, a dashed Newtonian reference ellipse, and a line to the latest perihelion. Unit tests: real Mercury precession ≈ 42.98″/century, energy drift < 1e-8 over 30k classical steps, a classical orbit's perihelion stays put, and the measured GR advance over 3 orbits is within 5 % of 6πGM/(c²a(1−e²)).",
  related: ["keplers-laws", "mass-effect", "fixed-timestep"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "In pure Newtonian gravity a lone planet traces a closed ellipse forever, returning to the same perihelion (closest point) every orbit. Mercury doesn't. Its perihelion advances about 574″ per century. Pulls from the other planets explain ~531″, and the leftover **~43″/century** puzzled astronomers for decades until general relativity predicted it exactly.",
    "Near a mass, the Schwarzschild geometry adds a correction to the effective force proportional to `L²/r⁴`, where `L` is the orbit's angular momentum per unit mass. It is strongest at perihelion. The orbit becomes a slowly rotating ellipse, a rosette, advancing by `Δω = 6πGM/(c²a(1−e²))` per lap. That is tiny for Mercury and huge for stars orbiting the galactic-centre black hole.",
    "Real numbers would never show up on screen, so the visual uses **sim units**: G = 1, M in solar masses, a = 8, and a reduced c = 8. That makes Δω a few degrees per orbit while keeping v ≪ c. The integrator is fixed-step RK4 (see [fixed timestep](/systems/simulation/fixed-timestep)), and the readout still checks the real Sun–Mercury value in SI units. Compare with the closed orbits of [Kepler's laws](/physics/mechanics/keplers-laws).",
  ],
  formulas: [
    {
      label: "Precession per orbit",
      math: tex`\Delta\omega = \frac{6\pi G M}{c^2 a (1 - e^2)}\ \text{rad/orbit}`,
    },
    {
      label: "Weak-field (1PN) radial acceleration",
      math: tex`\ddot{\mathbf r} = -\frac{GM}{r^2}\,\hat{\mathbf r}\left(1 + \frac{3L^2}{c^2 r^2}\right),\qquad L = |\mathbf r \times \dot{\mathbf r}|`,
    },
    {
      label: "Vis-viva (launch speed)",
      math: tex`v^2 = GM\left(\frac{2}{r} - \frac{1}{a}\right)`,
    },
    { label: "Orbital period", math: tex`T = 2\pi\sqrt{\frac{a^3}{GM}}` },
    {
      label: "Mercury check",
      math: tex`\Delta\omega \approx 0.1035''\ \text{per orbit} \times 415\ \text{orbits} \approx 43''\ \text{per century}`,
    },
  ],
  rules: [
    "Mercury: a = 5.791×10¹⁰ m, e = 0.206, 415 orbits per century, giving 42.98″/century from GR.",
    "Use RK4 or a symplectic integrator at a fixed dt. Here dt = 1/120 sim-second keeps energy drift under 1e-8 over 30k steps.",
    "Detect perihelion as a local minimum of r between consecutive steps, then take atan2 to measure the advance.",
    "Speed up time by doing more fixed substeps per frame, never by growing dt, and clamp the accumulator so slow frames can't spiral.",
    "Keep v/c at perihelion below ~0.1 in scaled units, or the 1PN correction stops being a small perturbation.",
  ],
  code: [
    {
      lang: "ts",
      caption:
        "Allocation-free acceleration with the GR term, for an RK4 step on [x, y, vx, vy]:",
      code: `const GM = 1, C = 8 // sim units

export function accel(s: Float64Array, gr: boolean, out: Float64Array) {
  const x = s[0], y = s[1], vx = s[2], vy = s[3]
  const r2 = x * x + y * y
  const r = Math.sqrt(r2)
  const L = x * vy - y * vx // specific angular momentum (z)
  const boost = gr ? 1 + (3 * L * L) / (C * C * r2) : 1
  const k = (-GM * boost) / (r2 * r)
  out[0] = vx
  out[1] = vy
  out[2] = k * x
  out[3] = k * y
}

// Each frame: for (n = 0; n < timeScale; n++) rk4(state, 1 / 120)
// Perihelion: prevR < prevPrevR && prevR < r  →  angle = atan2(y, x)`,
    },
  ],
  mistakes: [
    "Using real SI constants at render scale. At a = 8 m the orbit becomes superluminal and blows up.",
    "Integrating with explicit Euler: its spurious energy drift precesses the orbit too and swamps the GR signal.",
    "Speeding up time by enlarging dt instead of adding substeps, which changes the physics with the slider.",
    "Keeping too short a trail. The rosette only shows when the trail spans several orbits.",
    "Forgetting the 1/(1 − e²) factor: eccentric orbits precess more per lap.",
  ],
  reading: [
    {
      title:
        "OpenStax University Physics Vol. 1 — Einstein's Theory of Gravity",
      url: "https://openstax.org/books/university-physics-volume-1/pages/13-8-einsteins-theory-of-gravity",
    },
    {
      title: "Gaffer On Games — Integration Basics",
      url: "https://gafferongames.com/post/integration_basics/",
    },
  ],
  visual:
    "The cyan trail is the planet's (orange) last few orbits around the yellow star, the dashed grey ellipse is the closed Newtonian orbit, and the yellow line points at the latest perihelion. Toggle general relativity to watch the rosette appear or vanish, and raise the star mass or eccentricity for faster precession.",
}

export default sheet
