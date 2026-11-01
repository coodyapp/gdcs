import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "balancing-torque",
  category: "physics",
  subcategory: "mechanics",
  title: "Balancing Act: Torque and Levers",
  hook: "force times lever arm decides which way it turns",
  summary:
    "A lever balances when m₁r₁ = m₂r₂. Torque is force times lever arm, and net torque over moment of inertia gives angular acceleration.",
  level: "core",
  tags: ["torque", "levers", "statics", "rotation", "moment-of-inertia"],
  updated: "2026-11-01",
  prompt:
    "Write a TypeScript see-saw puzzle module for a Three.js game. Inputs: plank length and mass, a list of loads {mass, x} where x is signed distance from the fulcrum, and a fixed timestep. Compute net torque Σ(−m·g·x·cos θ), moment of inertia ML²/12 + Σ m x², integrate angle with semi-implicit Euler plus light damping, and clamp at ±25° ground stops. Expose isBalanced(tolerance) and counterweightPosition(mass). Unit tests: 3 kg at −2 m and 2 kg at +3 m is balanced; moving the 2 kg load to +3.5 m makes the plank rotate clockwise.",
  related: ["buoyancy", "spring-mass-oscillator", "fixed-timestep"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "**Torque** is the turning effect of a force: its size times its perpendicular distance from the pivot, `τ = r·F·sin φ`. A 2 kg box 3 m from a fulcrum turns a plank exactly as hard as a 3 kg box 2 m away on the other side, so the plank stays level. That is the law of the lever, `m₁r₁ = m₂r₂`.",
    "When the torques do not cancel, the plank gains angular velocity in the direction of the stronger side: `Στ = I·α`. The **moment of inertia** `I = Σ m r²` grows with the square of distance, so the same loads placed far out make the plank turn more sluggishly even when the net torque is the same.",
    "Games meet torque in see-saw puzzles, physics-based cranes, ragdolls and vehicles. In a rigid-body engine you rarely compute it yourself: call `applyForceAtPoint` and the engine adds `r × F` to the body's torque. Understanding it tells you why a heavy object placed off-centre tips a platform, why long arms feel slow to swing, and how far to put a counterweight.",
  ],
  formulas: [
    {
      label: "Torque (vector form)",
      math: tex`\vec\tau = \vec r \times \vec F`,
    },
    {
      label: "Lever balance",
      math: tex`m_1 g\, r_1 = m_2 g\, r_2 \;\Rightarrow\; m_1 r_1 = m_2 r_2`,
    },
    { label: "Rotational Newton's law", math: tex`\sum \tau = I\alpha` },
    {
      label: "Moment of inertia (plank + point loads)",
      math: tex`I = \tfrac{1}{12} M L^2 + \sum m_i r_i^2`,
    },
  ],
  rules: [
    "Static equilibrium needs both ΣF = 0 and Στ = 0 about any point; pick the pivot as that point so the support force drops out.",
    "Only the component of the force perpendicular to the arm counts: a weight on a plank tilted by θ has lever arm `r·cos θ`.",
    "Doubling a load's distance doubles its torque but quadruples its contribution to inertia.",
    "To balance a load W at distance r with a counterweight C, place C at `W·r / C` on the other side.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Net torque and angular step for a see-saw (fixed timestep):",
      code: `type Load = { mass: number; x: number } // x: signed distance from pivot (m)

export function stepSeesaw(
  s: { angle: number; omega: number },
  loads: Load[],
  plankMass: number,
  plankLength: number,
  dt: number,
  g = 9.81,
  damping = 1.5
) {
  let torque = 0
  let inertia = (plankMass * plankLength ** 2) / 12
  for (const l of loads) {
    torque -= l.mass * g * l.x * Math.cos(s.angle) // CCW positive; right side pushes CW
    inertia += l.mass * l.x * l.x
  }
  s.omega += (torque / inertia - damping * s.omega) * dt
  s.angle += s.omega * dt
  s.angle = Math.max(-0.45, Math.min(0.45, s.angle)) // ground stops
}`,
    },
  ],
  mistakes: [
    "Comparing masses instead of torques: a light load far out can beat a heavy one close in.",
    "Using the distance along the tilted plank without the `cos θ` factor once it rotates.",
    "Forgetting the plank's own inertia, which makes an empty see-saw spin unrealistically fast.",
    "Applying a force at the centre of mass in the engine and wondering why the object never rotates; use the force-at-point call.",
  ],
  reading: [
    {
      title: "OpenStax University Physics — Torque",
      url: "https://openstax.org/books/university-physics-volume-1/pages/10-6-torque",
    },
    {
      title: "OpenStax University Physics — Conditions for Static Equilibrium",
      url: "https://openstax.org/books/university-physics-volume-1/pages/12-1-conditions-for-static-equilibrium",
    },
  ],
  visual:
    "The cyan (left) and orange (right) loads sit on a grey plank with 1 m ticks; yellow arrows are their weights. The defaults balance (3 kg × 2 m = 2 kg × 3 m), so the plank stays level. Change any mass or distance and it tips toward the larger torque.",
}

export default sheet
