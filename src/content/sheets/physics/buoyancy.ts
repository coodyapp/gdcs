import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "buoyancy",
  category: "physics",
  subcategory: "mechanics",
  title: "Buoyancy",
  hook: "the water pushes up with the weight of what you displace",
  summary:
    "Archimedes: a body is pushed up by the weight of fluid it displaces, so it floats with ρ_object/ρ_fluid of its volume under. Boats and crates in games.",
  level: "core",
  tags: ["fluids", "archimedes", "density", "floating", "water"],
  updated: "2026-11-02",
  prompt:
    "Implement buoyancy for floating crates in a TypeScript Three.js game with a fixed 1/120 s step. Inputs: crate size, density, fluid density, a waterHeight(x, z) function, gravity and water drag. Compute the submerged fraction of the box, apply F = ρ_fluid·g·V·f upward and drag proportional to f·velocity, integrate with semi-implicit Euler, and stop on the tank floor. Then extend it to 4 corner probes so the crate tilts on waves. Unit tests: a 650 kg/m³ crate in water settles with 65% of its height submerged; a 1500 kg/m³ crate ends on the floor; equal densities produce no net force when fully submerged.",
  related: ["balancing-torque", "spring-mass-oscillator", "fixed-timestep"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Water pressure grows with depth, so the bottom of a submerged object is pushed up harder than its top is pushed down. The net upward push, the **buoyant force**, equals the weight of the fluid the object displaces: `F_b = ρ_fluid · g · V_submerged`. That is Archimedes' principle.",
    "Compare it with the weight `ρ_object · g · V`. If the object is less dense than the fluid it sinks only until the displaced fluid weighs as much as it does, so it floats with a fraction `ρ_object/ρ_fluid` of its volume under the surface (ice: about 90%). Denser objects keep sinking until the floor supplies the missing force. Equal densities are **neutrally buoyant** and hover wherever they are.",
    "Game water uses the same idea per sample point: split a hull into a few probe points, measure how deep each one is below the wave height, and push up at that point in proportion to depth. Off-centre buoyancy creates [torque](/physics/mechanics/balancing-torque), which is what makes boats roll, pitch and right themselves. Add drag that scales with the submerged fraction or the object bobs forever.",
  ],
  formulas: [
    {
      label: "Buoyant force",
      math: tex`\textcolor{#f65a5a}{F_b} = \rho_{\text{fluid}}\, g\, V_{\text{sub}}`,
    },
    {
      label: "Weight",
      math: tex`\textcolor{#f65a5a}{F_g} = \rho_{\text{obj}}\, g\, V`,
    },
    {
      label: "Floating fraction",
      math: tex`\dfrac{V_{\text{sub}}}{V} = \dfrac{\rho_{\text{obj}}}{\rho_{\text{fluid}}}`,
    },
    {
      label: "Vertical motion (simulated here)",
      math: tex`\ddot y = g\left(\dfrac{\rho_{\text{fluid}}}{\rho_{\text{obj}}}\,f(y) - 1\right) - c\,f(y)\,\dot y`,
      note: "f(y) is the submerged fraction (0–1); c is water drag.",
    },
  ],
  rules: [
    "Densities (kg/m³): fresh water 1000, sea water ~1025, oak ~700, pine ~500, ice ~917, steel ~7850, human ~985.",
    "Use 4–8 probe points on a boat hull; one point floats but never tilts.",
    "Linear water drag of 1–3 s⁻¹ times the submerged fraction settles bobbing in a couple of seconds without looking syrupy.",
    "Clamp per-point depth to the hull height so a deep dive does not produce unbounded lift.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Probe-point buoyancy for a rigid body (engine-neutral):",
      code: `type Vec3 = { x: number; y: number; z: number }

export function applyBuoyancy(
  body: { applyForceAtPoint(f: Vec3, p: Vec3): void; velocityAt(p: Vec3): Vec3 },
  probes: Vec3[], // world-space hull points
  waterHeight: (x: number, z: number) => number,
  volume: number, // body volume (m³)
  probeHeight: number, // vertical extent each probe represents (m)
  rhoFluid = 1000,
  g = 9.81,
  drag = 2
) {
  const share = volume / probes.length
  for (const p of probes) {
    const depth = waterHeight(p.x, p.z) - p.y
    if (depth <= 0) continue
    const f = Math.min(1, depth / probeHeight) // submerged fraction for this probe
    const v = body.velocityAt(p)
    const lift = rhoFluid * g * share * f
    const damp = rhoFluid * share * f * drag
    body.applyForceAtPoint({ x: -damp * v.x, y: lift - damp * v.y, z: -damp * v.z }, p)
  }
}`,
    },
  ],
  mistakes: [
    "Applying the full buoyant force as soon as an object touches the surface instead of scaling it by the submerged fraction: objects pop out of the water.",
    "Pushing at the centre of mass only, so boats never roll or self-right.",
    "No drag in the water, so a dropped crate bobs up and down forever.",
    "Using real densities with a game mass that does not match the mesh volume: the float line ends up wrong.",
  ],
  reading: [
    {
      title: "OpenStax University Physics — Archimedes' Principle and Buoyancy",
      url: "https://openstax.org/books/university-physics-volume-1/pages/14-4-archimedes-principle-and-buoyancy",
    },
  ],
  visual:
    "The yellow block drops into the translucent white water and settles. Both solid red arrows are forces: the one pointing up (left) is buoyancy, which grows with how much is under water, and the one pointing down (right) is the weight. A solid green up-arrow under the block is the floor's normal force when it sinks. Raise the object density above the fluid density to sink it.",
}

export default sheet
