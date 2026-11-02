import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "impulse-and-momentum",
  category: "physics",
  subcategory: "mechanics",
  title: "Impulse and Momentum",
  hook: "forces act over time, impulses act right now",
  summary:
    "A force changes velocity over time; an impulse changes it at once. The collision impulse conserves momentum and sets how much energy a hit loses.",
  level: "core",
  tags: ["collision", "momentum", "impulse", "restitution", "physics"],
  updated: "2026-11-02",
  prompt:
    "Implement collision response for two bodies in TypeScript with Three.js. Each body has a THREE.Vector3 velocity and an invMass number, where invMass 0 means static. Write resolveContact(a, b, n, e), with n the unit contact normal pointing from a to b and e the restitution in [0, 1]. Compute vn = (b.velocity − a.velocity)·n. Return 0 without changing anything if vn ≥ 0 or if both inverse masses are 0. Otherwise compute j = −(1 + e)·vn / (a.invMass + b.invMass), subtract j·a.invMass·n from a.velocity, add j·b.invMass·n to b.velocity, and return j. Do not allocate per call, and do not handle rotation or friction. Write unit tests with random masses checking that momentum is conserved, that e = 1 conserves kinetic energy, that e = 0 gives equal normal velocities, that a static body never moves, and that a second call on the same contact returns 0.",
  related: [
    "rigid-body-dynamics",
    "acceleration-and-friction",
    "tunneling",
    "projectile-motion",
    "moment-of-inertia",
    "collision-detection",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "**Momentum** is mass times velocity, `p = mv`: how much it takes to stop something. A **force** changes momentum gradually, so you apply it every physics step and scale it by `dt`. An **impulse** is that same change delivered all at once, `J = FΔt = Δp`, so you apply it once and the velocity jumps by `J/m` with no `dt` involved.",
    "Use a force for anything sustained: thrust, wind, gravity, drag. Use an impulse for anything that is over within a step: jumps, explosions, weapon hits, collisions. A real collision does involve a huge force over a few milliseconds, but a game step is far longer than that, so only the resulting `FΔt` is worth modelling.",
    "In a collision, each body gets the same impulse in opposite directions along the contact normal, so total momentum cannot change. The size of that impulse comes from **restitution** `e`, the fraction of closing speed that returns as separating speed: 0 means the bodies move together afterwards, 1 means no kinetic energy is lost.",
    "Static objects fit the same formula with an inverse mass of 0, which is why engines store `1/m` rather than `m`: the wall takes none of the impulse, and no special case is needed. Hit a body off-centre and that impulse also spins it, which is covered in [rigid-body dynamics](/physics/mechanics/rigid-body-dynamics).",
  ],
  formulas: [
    {
      label: "Momentum",
      math: tex`p = m \textcolor{#fdc700}{v}`,
    },
    {
      label: "Impulse",
      math: tex`\textcolor{#ff6467}{J} = F \Delta t = \Delta p = m \Delta \textcolor{#fdc700}{v}`,
      note: "With no contact or thrust, p stays constant.",
    },
    {
      label: "Conservation in a collision",
      math: tex`m_1 v_1 + m_2 v_2 = m_1 v_1' + m_2 v_2'`,
    },
    {
      label: "Restitution, along the normal",
      math: tex`(v_2' - v_1') \cdot n = -e \, (v_2 - v_1) \cdot n`,
    },
    {
      label: "Collision impulse",
      math: tex`\textcolor{#ff6467}{j} = \frac{-(1 + e)\, (\textcolor{#fdc700}{v_{rel}} \cdot n)}{\frac{1}{m_1} + \frac{1}{m_2}}`,
      note: "n points from body 1 to body 2 and v_rel = v2 − v1. Negative v_rel · n means closing. For a static body, use 1/m = 0.",
    },
    {
      label: "Apply it along the normal",
      math: tex`v_1' = v_1 - \frac{\textcolor{#ff6467}{j}}{m_1} n \qquad v_2' = v_2 + \frac{\textcolor{#ff6467}{j}}{m_2} n`,
    },
    {
      label: "Kinetic energy lost",
      math: tex`\Delta K = \tfrac{1}{2} \frac{m_1 m_2}{m_1 + m_2} (1 - e^2) (v_{rel} \cdot n)^2`,
      note: "Zero at e = 1, largest at e = 0.",
    },
  ],
  rules: [
    "Starting restitution: `0` for characters and mud, `0.1–0.3` for crates, `0.4–0.6` for wood or hard balls, `0.8–0.9` for rubber balls.",
    "Set `e` to 0 when the closing speed is below about `0.5–1 m/s`, or resting objects will jitter instead of settling.",
    "Jump impulse for a target height: `J = m·sqrt(2gh)`. At `m = 70`, `g = 9.81`, `h = 1.2` that is about `340 N·s`.",
    "Explosion: push each body along the direction away from the blast, with `J` falling off to 0 at the radius. Linear falloff is a fine start.",
    "Two bodies with the same `e` are easy. When they differ, taking `max(e1, e2)` keeps a bouncy ball bouncy on any floor.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Resolve one contact. Static bodies use invMass = 0.",
      code: `import * as THREE from "three"

export interface Body {
  velocity: THREE.Vector3
  invMass: number // 1 / mass, or 0 for static
}

const rel = new THREE.Vector3()

/** n is the unit contact normal from a to b. Returns the impulse j. */
export function resolveContact(a: Body, b: Body, n: THREE.Vector3, e: number) {
  const invSum = a.invMass + b.invMass
  if (invSum === 0) return 0
  const vn = rel.subVectors(b.velocity, a.velocity).dot(n)
  if (vn >= 0) return 0 // already separating
  const j = (-(1 + e) * vn) / invSum
  a.velocity.addScaledVector(n, -j * a.invMass)
  b.velocity.addScaledVector(n, j * b.invMass)
  return j
}`,
    },
    {
      lang: "ts",
      caption:
        "A force is scaled by dt every step; an impulse is applied once with no dt.",
      code: `import type { Vector3 } from "three"
import type { Body } from "./resolve-contact"

// Each fixed step while the thrust or wind lasts.
export function applyForce(b: Body, force: Vector3, dt: number) {
  b.velocity.addScaledVector(force, b.invMass * dt)
}

// Once, on the frame of the jump, hit or blast.
export function applyImpulse(b: Body, impulse: Vector3) {
  b.velocity.addScaledVector(impulse, b.invMass)
}`,
    },
  ],
  mistakes: [
    "Multiplying an impulse by `dt`, or applying a force once without it. A jump tuned this way changes with the frame rate, or barely moves at all.",
    "Resolving contacts that are already separating. Without the `vn >= 0` check, overlapping bodies that are moving apart get pulled back together.",
    "Flipping the normal. With `n` from a to b, `a` loses `j·n` and `b` gains it; swap either one and objects accelerate into each other.",
    "Dividing by mass on static objects. Store inverse mass, so a wall is `0` and two walls can be skipped instead of dividing by zero.",
    "Expecting this to stop overlap. An impulse only changes velocity, so positions still need separate correction, and fast bodies can skip contact entirely: see [tunneling](/systems/collision/tunneling).",
  ],
  reading: [
    {
      title: "OpenStax University Physics — Impulse and Collisions",
      url: "https://openstax.org/books/university-physics-volume-1/pages/9-2-impulse-and-collisions",
    },
    {
      title: "OpenStax University Physics — Types of Collisions",
      url: "https://openstax.org/books/university-physics-volume-1/pages/9-4-types-of-collisions",
    },
    {
      title: "Chris Hecker — Rigid Body Dynamics articles",
      url: "https://www.chrishecker.com/Rigid_Body_Dynamics",
    },
  ],
  visual:
    "Two blocks collide head-on, with face area proportional to mass: A is white and B is grey with a light outline. Dashed yellow arrows are velocities, and the brief solid red arrows are the equal and opposite impulse at contact. Under the track, A's white bar and B's grey bar are their momenta, chained end to end, so the green tick marks the total and stays still through the hit. Change the masses, restitution and speed; the readout compares momentum before and after and shows the kinetic energy lost.",
}

export default sheet
