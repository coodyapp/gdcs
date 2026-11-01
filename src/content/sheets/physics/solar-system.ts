import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "solar-system",
  category: "physics",
  subcategory: "mechanics",
  title: "Solar System: Two-Body Orbits",
  hook: "everything orbits the shared centre of mass",
  summary:
    "Two gravitating bodies circle their shared barycentre: radii split by mass, period set by total mass. Plus a stable n-body integrator for games.",
  level: "common",
  tags: ["gravity", "n-body", "barycentre", "orbits", "integration"],
  updated: "2026-11-01",
  prompt:
    "Implement a TypeScript n-body gravity simulator for a Three.js scene. Inputs: an array of bodies {mass, position: THREE.Vector3, velocity: THREE.Vector3}, gravitational constant G, softening ε and a fixed timestep dt. Use velocity Verlet (half-kick, drift, recompute accelerations, half-kick), compute each pair once and apply equal and opposite forces, and never allocate inside step(). Provide totalEnergy() and barycentre(). Edge cases: zero or one body, coincident bodies (softening). Tests: a two-body circular orbit with v = √(G(m₁+m₂)/d) keeps its separation within 0.5% over 100 orbits, and the barycentre stays fixed to 1e-9.",
  related: ["keplers-laws", "fixed-timestep", "projectile-motion"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Gravity is mutual: the star pulls the planet and the planet pulls the star with an equal and opposite force. With no outside forces the **centre of mass** (barycentre) never accelerates, so both bodies orbit that point, not each other's centres. The heavier body traces the smaller circle: `m₁·r₁ = m₂·r₂`.",
    "For a circular pair the separation `d` and total mass fix the angular rate through Kepler's third law: `ω² = G(m₁+m₂)/d³`. Make one body heavier and the whole system spins faster; make them equal and they chase each other around a point exactly halfway between.",
    "In a game with more than two bodies there is no closed form, so you integrate. Sum the pairwise forces, then advance with a symplectic integrator (leapfrog/velocity Verlet) at a [fixed timestep](/systems/simulation/fixed-timestep). Add a softening length so close passes do not fling bodies to infinity. For background planets that never interact, [Kepler rails](/physics/mechanics/keplers-laws) are cheaper and drift-free.",
  ],
  formulas: [
    {
      label: "Newton's law of gravitation",
      math: tex`\vec F_{ij} = G\,\dfrac{m_i m_j}{|\vec r_{ij}|^3}\,\vec r_{ij}`,
    },
    {
      label: "Barycentre",
      math: tex`\vec R_{cm} = \dfrac{\sum m_i \vec r_i}{\sum m_i}`,
    },
    {
      label: "Radii around the barycentre",
      math: tex`r_1 = \dfrac{m_2}{m_1+m_2}\,d,\quad r_2 = \dfrac{m_1}{m_1+m_2}\,d`,
    },
    {
      label: "Angular rate of a circular pair",
      math: tex`\omega = \sqrt{\dfrac{G(m_1+m_2)}{d^3}}`,
    },
    {
      label: "Circular orbit speed (light satellite)",
      math: tex`v_c = \sqrt{GM/r}`,
    },
  ],
  rules: [
    "Pick game units so `G = 1` and masses/distances are near 1–100; real SI values lose float precision fast.",
    "Softened gravity: use `|r|² + ε²` in the denominator with ε ≈ 1–5% of a typical separation.",
    "Leapfrog/velocity Verlet keeps orbits closed for thousands of revolutions; explicit Euler spirals out within a few.",
    "Start a stable circular orbit by giving the satellite `v = √(GM/r)` perpendicular to the radius, and give the star the opposite momentum so the barycentre stays put.",
    "Sun–Jupiter's barycentre lies just outside the Sun's surface: about 1.07 solar radii from its centre.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Velocity-Verlet n-body step with softening (Three.js vectors):",
      code: `import * as THREE from "three"

type Body = { m: number; p: THREE.Vector3; v: THREE.Vector3; a: THREE.Vector3 }
const d = new THREE.Vector3()

function accelerations(bodies: Body[], G = 1, eps2 = 0.01) {
  for (const b of bodies) b.a.set(0, 0, 0)
  for (let i = 0; i < bodies.length; i++)
    for (let j = i + 1; j < bodies.length; j++) {
      const bi = bodies[i], bj = bodies[j]
      d.subVectors(bj.p, bi.p)
      const r2 = d.lengthSq() + eps2
      const s = G / (r2 * Math.sqrt(r2))
      bi.a.addScaledVector(d, s * bj.m)
      bj.a.addScaledVector(d, -s * bi.m)
    }
}

/** Call accelerations(bodies) once before the first step. */
export function step(bodies: Body[], dt: number) {
  for (const b of bodies) {
    b.v.addScaledVector(b.a, dt / 2) // half kick
    b.p.addScaledVector(b.v, dt) // drift
  }
  accelerations(bodies)
  for (const b of bodies) b.v.addScaledVector(b.a, dt / 2)
}`,
    },
  ],
  mistakes: [
    "Pinning the star at the origin while the planet orbits it: momentum is not conserved and heavy moons look wrong.",
    "Updating each body's position before computing the others' forces, so the result depends on array order.",
    "Integrating with explicit Euler or a variable frame time: orbits gain energy and spiral outwards.",
    "No softening: a near collision gives a huge acceleration and slingshots bodies out of the system.",
  ],
  reading: [
    {
      title: "OpenStax University Physics — Center of Mass",
      url: "https://openstax.org/books/university-physics-volume-1/pages/9-6-center-of-mass",
    },
    {
      title: "OpenStax University Physics — Satellite Orbits and Energy",
      url: "https://openstax.org/books/university-physics-volume-1/pages/13-4-satellite-orbits-and-energy",
    },
  ],
  visual:
    "The cyan and orange bodies circle the yellow barycentre ring along their faint orbits; sphere size grows with mass at equal density. Raise the mass ratio and the orange body moves inward while the cyan one swings wide, and the whole pair speeds up.",
}

export default sheet
