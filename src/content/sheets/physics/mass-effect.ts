import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "mass-effect",
  category: "physics",
  subcategory: "relativity",
  title: "Mass Effect on Spacetime",
  hook: "more mass, deeper well, tighter orbits",
  summary:
    "Mass curves spacetime: picture a gravity well whose depth follows −GM/r, with the Schwarzschild radius 2GM/c² marking where light can no longer escape.",
  level: "common",
  tags: ["relativity", "gravity", "schwarzschild", "potential", "black-hole"],
  updated: "2026-11-01",
  prompt:
    "Create a Three.js + TypeScript gravity-well visual. Input: mass in solar masses (0.1–10) and grid resolution (10–40). Build a PlaneGeometry (20×20 units) whose vertex height is −M/max(r, 0.5)·e^(−r/5), rotated so the dip points down, and render it as a wireframe; rebuild the geometry only when inputs change and dispose the old one. Place a sphere at the well bottom and a probe orbiting at r = 4.2 with angular speed ∝ √(M/r³), moved in useFrame without allocations. Show r_s = 2GM/c² in km. Unit-test schwarzschildRadius(1 M☉) ≈ 2953 m (±1 m) and that well depth scales linearly with mass.",
  related: ["mercury-precession", "gravitational-waves", "keplers-laws"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "General relativity says mass and energy curve spacetime, and free bodies follow the straightest possible paths through that curved geometry. Far from a mass, the effect matches Newton: the gravitational potential is `Φ = −GM/r`, and orbits, tides and escape speeds all follow from it.",
    "The familiar **rubber-sheet** picture plots that potential as a surface: the deeper the dip, the stronger the pull. It is an *analogy*. The real curvature lives in four dimensions, and a lot of it is the slowing of clocks rather than the bending of space. It still gives the right intuition: more mass makes a deeper, wider well and faster orbits at a given radius.",
    "Squeeze a mass inside its **Schwarzschild radius** `r_s = 2GM/c²` and the escape speed reaches `c`, so you get a black hole. For the Sun `r_s ≈ 2.95 km`, so it scales at about 3 km per solar mass. Orbits deep in the well are no longer closed ellipses: see [Mercury's precession](/physics/relativity/mercury-precession). Accelerating masses send ripples through the geometry: see [gravitational waves](/physics/relativity/gravitational-waves).",
  ],
  formulas: [
    { label: "Schwarzschild radius", math: tex`r_s = \frac{2GM}{c^2}` },
    {
      label: "Newtonian potential (weak field)",
      math: tex`\Phi(r) = -\frac{GM}{r}`,
    },
    {
      label: "Escape velocity",
      math: tex`v_{\text{esc}} = \sqrt{\frac{2GM}{r}} = c\,\sqrt{\frac{r_s}{r}}`,
    },
    {
      label: "Gravitational time dilation (static clock)",
      math: tex`\frac{d\tau}{dt} = \sqrt{1 - \frac{r_s}{r}}`,
    },
    {
      label: "Circular orbit speed and rate",
      math: tex`v = \sqrt{\frac{GM}{r}},\qquad \omega = \sqrt{\frac{GM}{r^3}}`,
    },
  ],
  rules: [
    "r_s ≈ 2.95 km × (M / M☉). Earth's is about 8.9 mm.",
    "Weak-field (Newtonian) is fine when r ≫ r_s. GPS clocks at r/r_s ≈ 3×10⁹ still need a ~45 µs/day correction.",
    "For a well visual, clamp the radius (here r ≥ 0.5) so the 1/r spike stays finite, and add a falloff such as e^(−r/5) so the edges are flat.",
    "A 40×40 wireframe grid (1.7k vertices) is plenty. Rebuild it only when mass changes, not every frame.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Build a gravity-well grid once per mass change (Three.js):",
      code: `import * as THREE from "three"

const G = 6.6743e-11, C = 299_792_458, M_SUN = 1.989e30
export const schwarzschildRadius = (kg: number) => (2 * G * kg) / (C * C)

// Stylized potential: −M/r, clamped near the centre, faded towards the edges.
export function wellGeometry(solarMasses: number, size = 20, res = 40) {
  const geo = new THREE.PlaneGeometry(size, size, res, res)
  const p = geo.attributes.position.array as Float32Array
  for (let i = 0; i < p.length; i += 3) {
    const r = Math.max(Math.hypot(p[i], p[i + 1]), 0.5)
    p[i + 2] = (-solarMasses / r) * Math.exp(-r / 5)
  }
  geo.computeVertexNormals()
  return geo // rotate −90° about X so the dip points down
}

schwarzschildRadius(M_SUN) // ≈ 2953 m`,
    },
  ],
  mistakes: [
    "Reading the rubber sheet literally. It is a picture of the potential, not the shape of space, and it needs gravity to explain itself.",
    "Calling r_s the size of the star. It is only an event horizon if all the mass is inside it.",
    "Rebuilding a high-resolution grid every frame when only the mass slider changed.",
    "Mixing kilograms and solar masses in one formula. Convert once at the boundary.",
  ],
  reading: [
    {
      title:
        "OpenStax University Physics Vol. 1 — Einstein's Theory of Gravity",
      url: "https://openstax.org/books/university-physics-volume-1/pages/13-8-einsteins-theory-of-gravity",
    },
  ],
  visual:
    "The cyan wireframe is the gravity-well analogy, the yellow sphere is the central mass, and the orange probe orbits faster as the well deepens. Drag the mass slider to deepen the well and switch the well off to compare with flat space; the readout gives the Schwarzschild radius.",
}

export default sheet
