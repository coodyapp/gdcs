import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "rigid-body-dynamics",
  category: "physics",
  subcategory: "mechanics",
  title: "Rigid Body Dynamics",
  hook: "push off-centre and it both moves and spins",
  summary:
    "A rigid body has mass and a moment of inertia. Forces and impulses at a point change both its linear and angular velocity; contacts bounce and slide.",
  level: "common",
  tags: ["physics", "torque", "impulse", "inertia", "restitution", "friction"],
  updated: "2026-11-01",
  prompt:
    "Write a minimal 2D rigid-body solver in TypeScript (no physics library) for oriented boxes, rendered with Three.js. Store position, angle, linear velocity, angular velocity ω, mass m and inertia I = m(w²+h²)/12. Implement applyImpulse(J, r) (v += J/m, ω += (r×J)/I with the 2D cross product), semi-implicit Euler integration at a fixed 120 Hz step, and floor/wall contacts: find penetrating corners, solve an accumulated non-negative normal impulse, then restitution (skip it below 0.4 m/s closing speed so boxes can rest), then Coulomb friction clamped to μ·jn, then push the box out of the plane. Write unit tests: an impulse through the centre of mass gives ω = 0, an impulse above the centre pushing right spins clockwise, and kinetic energy never increases in a contact with e ≤ 1.",
  related: [
    "balancing-torque",
    "fixed-timestep",
    "projectile-motion",
    "tunneling",
    "dot-and-cross-product",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A **rigid body** is an object that never deforms, so its state is just a position, an orientation and their rates of change: linear velocity `v` and angular velocity `ω`. **Mass** `m` resists changes to `v`; the **moment of inertia** `I` resists changes to `ω` and depends on how the mass is spread around the centre of mass (a long plank spins more slowly than a compact cube of the same mass).",
    "A force through the centre of mass only translates the body. Move the point of application sideways and part of it becomes **torque** `τ = r × F`, so the same push now also spins the body. Games mostly work with **impulses** `J = F·Δt` (an instant change of momentum), which is how hits, explosions and contacts are applied.",
    "Each step, a simulation integrates with **semi-implicit Euler** (update the velocities first, then move using the new velocities), then resolves contacts: find the touching points, apply a normal impulse so they stop approaching, add **restitution** `e` for bounce, and clamp a tangential **friction** impulse to `μ` times the normal impulse. Run it at a [fixed timestep](/systems/simulation/fixed-timestep) so results do not depend on frame rate.",
  ],
  formulas: [
    {
      label: "Linear and angular Newton's law",
      math: tex`\textcolor{#ff6467}{\vec F} = m\,\dot{\vec v}, \qquad \tau = \vec r \times \textcolor{#ff6467}{\vec F} = I\,\dot{\textcolor{#d4d4d4}{\omega}}`,
      note: "In 2D the cross product is a scalar: rx·Fy − ry·Fx.",
    },
    {
      label: "Impulse at a point",
      math: tex`\Delta \textcolor{#fdc700}{\vec v} = \frac{\textcolor{#ff6467}{\vec J}}{m}, \qquad \Delta \textcolor{#d4d4d4}{\omega} = \frac{\vec r \times \textcolor{#ff6467}{\vec J}}{I}`,
    },
    {
      label: "Moment of inertia of a box",
      math: tex`I = \tfrac{1}{12}\, m\,(w^2 + h^2)`,
    },
    {
      label: "Semi-implicit Euler",
      math: tex`\textcolor{#fdc700}{\vec v} \mathrel{+}= \vec a\,\Delta t,\quad \vec x \mathrel{+}= \textcolor{#fdc700}{\vec v}\,\Delta t,\quad \theta \mathrel{+}= \textcolor{#d4d4d4}{\omega}\,\Delta t`,
    },
    {
      label: "Contact normal impulse",
      math: tex`j_n = \dfrac{-(1+e)\, \vec v_{rel}\cdot\hat n}{\dfrac{1}{m} + \dfrac{(\vec r \times \hat n)^2}{I}}, \qquad |j_t| \le \mu\, j_n`,
      note: "v_rel = v + ω × r is the velocity of the touching point, n̂ the contact normal.",
    },
  ],
  rules: [
    "Step physics at 60–120 Hz with a fixed `dt`; never feed a raw, variable frame delta to the solver.",
    "Restitution `e`: 0 = clay, 0.3–0.5 = wood or crates, 0.8+ = rubber ball. Below a closing speed of ~0.5 m/s treat it as 0 so stacks can rest.",
    "Friction `μ`: 0.05 ice, 0.4–0.6 wood or stone, 0.9+ rubber on concrete.",
    "Iterate contacts 4–10 times per step (sequential impulses) and clamp the accumulated normal impulse to ≥ 0 rather than each partial one.",
    "Keep mass ratios between touching bodies under about 10:1, or stacks get soft and jittery.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Impulse at a point plus semi-implicit Euler (2D):",
      code: `interface Body { x: number; y: number; angle: number
  vx: number; vy: number; omega: number; mass: number; inertia: number }

const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx

// r = hit point − centre of mass (world space)
export function applyImpulse(b: Body, jx: number, jy: number, rx: number, ry: number) {
  b.vx += jx / b.mass
  b.vy += jy / b.mass
  b.omega += cross(rx, ry, jx, jy) / b.inertia
}

export function step(b: Body, dt: number, g = -9.81) {
  b.vy += g * dt          // velocity first...
  b.x += b.vx * dt        // ...then position with the new velocity
  b.y += b.vy * dt
  b.angle += b.omega * dt
}`,
    },
    {
      lang: "pseudo",
      caption: "One contact point against a static floor:",
      code: `r      = contactPoint - body.centre
vRel   = body.v + cross(body.omega, r)        // velocity of the touching point
vn     = dot(vRel, n)
if vn < 0:                                    // approaching
    e   = (vn < -0.5) ? restitution : 0
    jn  = -(1 + e) * vn / (1/m + cross(r, n)^2 / I)
    applyImpulse(body, jn * n, r)
    vt  = dot(body.v + cross(body.omega, r), tangent)
    jt  = clamp(-vt / (1/m + cross(r, tangent)^2 / I), -mu*jn, mu*jn)
    applyImpulse(body, jt * tangent, r)
body.position += n * penetration              // positional correction`,
    },
  ],
  mistakes: [
    "Applying a hit at the centre of mass. It looks floaty because nothing ever spins; use the actual hit point.",
    "Using a sphere's inertia for every shape. A wrong `I` makes boxes spin too easily or barely at all.",
    "Updating position before velocity (explicit Euler). Orbits and bounces gain energy and blow up.",
    "Restitution of 1 with friction and multiple contacts, then wondering why boxes never settle. Add a bounce threshold and let resting contacts use `e = 0`.",
    "Mixing world-space and local-space `r` vectors when computing torque.",
  ],
  reading: [
    {
      title: "Box2D — Erin Catto's GDC physics presentations",
      url: "https://box2d.org/publications/",
    },
    {
      title: "Gaffer On Games — Physics in 3D",
      url: "https://gafferongames.com/post/physics_in_3d/",
    },
    {
      title: "OpenStax University Physics — Rotational dynamics",
      url: "https://openstax.org/books/university-physics-volume-1/pages/10-7-newtons-second-law-for-rotation",
    },
  ],
  visual:
    "The red solid arrow is the strike impulse hitting the white box off-centre; short red arrows flash at contact points with the floor and walls. The yellow dashed line is velocity and the light-grey arc with an arrowhead is angular velocity (longer sweep = faster spin). Slide the impulse offset to 0 for pure translation, and change restitution and friction.",
}

export default sheet
