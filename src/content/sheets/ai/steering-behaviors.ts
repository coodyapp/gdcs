import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "steering-behaviors",
  category: "ai",
  subcategory: "steering",
  title: "Steering Behaviors",
  hook: "steer toward a desired velocity, a little each frame",
  summary:
    "Seek, arrive and separation each compute a desired velocity; steering is desired minus current velocity, capped and summed. Simple rules, lifelike motion.",
  level: "core",
  tags: ["steering", "seek", "arrive", "separation", "flocking", "movement"],
  updated: "2026-11-02",
  prompt:
    "Implement Reynolds steering behaviors in TypeScript for a Three.js crowd on the XZ plane. Agents have pos/vel (THREE.Vector2), maxSpeed, maxForce. Write seek, arrive (linear slow-down inside slowRadius), flee and separation (1/d weighting within a radius), each writing into an output vector with no allocation; steering = (desired − vel) / reactionTime, truncated to maxForce; combine with weights. Integrate at a fixed 60 Hz, orient each instanced cone along its velocity, and guard zero-length vectors. Write Vitest tests: arrive ends within 0.05 u of a static target with near-zero speed; seek passes the target at near max speed; separation between two agents 0.5 u apart points away from the neighbor with magnitude 2.",
  related: [
    "a-star-pathfinding",
    "finite-state-machine",
    "fixed-timestep",
    "behavior-trees",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Craig Reynolds' steering behaviors treat an agent as a point with a velocity, a maximum speed and a maximum force. Each behavior answers one question: *what velocity would I like right now?* The steering force is that **desired velocity minus the current velocity**, capped at `maxForce`. Because the change per step is limited, the agent turns and accelerates smoothly instead of snapping.",
    "**Seek** wants full speed straight at the target. It gets there fast but overshoots and oscillates. **Arrive** is seek with a brake: inside a slowing radius the desired speed falls linearly to zero, so the agent comes to rest on the target. **Flee** is seek reversed. **Separation** pushes away from neighbors inside a radius, weighted by 1/distance, so a crowd heading for the same point spreads out instead of stacking.",
    "Combine behaviors with a weighted sum (e.g. arrive × 1 + separation × 1.5), or with a priority list where the most urgent behavior that returns a non-zero force wins. Steering is the layer below planning: [A*](/ai/navigation/a-star-pathfinding) chooses the route, a [state machine](/ai/decision/finite-state-machine) chooses the goal, and steering moves the body.",
  ],
  formulas: [
    {
      label: "Steering",
      math: tex`\vec F = \operatorname{trunc}\!\left(\frac{\vec v_{\text{desired}} - \textcolor{#fdc700}{\vec v}}{\tau},\ F_{\max}\right)`,
      note: "τ = reaction time (e.g. 0.25 s); smaller values react faster.",
    },
    {
      label: "Arrive desired speed",
      math: tex`|\vec v_{\text{desired}}| = v_{\max} \cdot \min\!\left(1, \frac{d}{R_{\text{slow}}}\right)`,
    },
    {
      label: "Separation",
      math: tex`\vec F_{\text{sep}} = \sum_{d_j < R} \frac{\vec p - \vec p_j}{\lVert \vec p - \vec p_j \rVert^{2}}`,
    },
  ],
  rules: [
    "Start with maxSpeed 3–6 u/s, maxForce 2–4× maxSpeed per second, a slowing radius of 2–3 body lengths, and a separation radius of about 2 body radii.",
    "Integrate in a [fixed timestep](/systems/simulation/fixed-timestep). Steering with large dt overshoots and jitters.",
    "Use a spatial grid for neighbor queries once you pass about 50 agents. The naive separation loop is O(n²).",
    "Face the velocity direction, smoothed, rather than the force. Forces flicker frame to frame.",
    "Add a small arrival tolerance (e.g. 0.05 u) and zero the velocity inside it to avoid micro-jitter.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Arrive + separation, allocation-free:",
      code: `function steer(a: Agent, i: number, all: Agent[], target: THREE.Vector2, dt: number) {
  // Arrive
  tmp.subVectors(target, a.pos)
  const d = tmp.length()
  const speed = MAX_SPEED * Math.min(1, d / SLOW_RADIUS)
  if (d > 1e-6) tmp.multiplyScalar(speed / d)
  force.subVectors(tmp, a.vel).divideScalar(REACTION)

  // Separation
  for (let j = 0; j < all.length; j++) {
    if (j === i) continue
    tmp.subVectors(a.pos, all[j].pos)
    const d2 = tmp.lengthSq()
    if (d2 > 0 && d2 < SEP_R * SEP_R) force.addScaledVector(tmp, SEP_W / d2)
  }

  force.clampLength(0, MAX_FORCE)
  a.vel.addScaledVector(force, dt).clampLength(0, MAX_SPEED)
  a.pos.addScaledVector(a.vel, dt)
}`,
    },
  ],
  mistakes: [
    "Setting velocity to the desired velocity directly: that's teleport-steering, with no inertia and instant 180° turns.",
    "Using seek for the final approach. It never settles; switch to arrive near the goal.",
    "Summing many behaviors with equal weights, so they cancel and agents freeze. Prioritize, or tune the weights.",
    "Normalizing a zero-length vector when the agent is exactly on the target, which gives NaN positions.",
  ],
  reading: [
    {
      title: "Craig Reynolds — Steering Behaviors For Autonomous Characters",
      url: "https://www.red3d.com/cwr/steer/",
    },
    {
      title: "Craig Reynolds — Boids",
      url: "https://www.red3d.com/cwr/boids/",
    },
  ],
  visual:
    "White cones are agents chasing the green target ball as it hops between spots. Yellow dashed lines are their velocities, and the gray ring is the arrive slowing radius. Switch to seek to see them overshoot and buzz around the target, and set separation to 0 to watch them pile into one spot.",
}

export default sheet
