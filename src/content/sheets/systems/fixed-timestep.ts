import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "fixed-timestep",
  category: "systems",
  subcategory: "simulation",
  title: "Fixed Timestep",
  hook: "physics ticks at a steady rate, rendering just blends between ticks",
  summary:
    "Run physics in constant dt slices from an accumulator, clamp long frames, and interpolate between the last two states for smooth, repeatable motion.",
  level: "core",
  tags: ["timestep", "accumulator", "interpolation", "determinism", "physics"],
  updated: "2026-11-02",
  prompt:
    "Implement a fixed-timestep game loop in TypeScript for a Three.js app. A `FixedStepper` class takes a step (default 1/60) and a max frame time (0.25 s); `advance(frameTime, step)` accumulates the clamped time, calls step(dt) as many times as fits and returns the count; an `alpha` getter returns accumulator/dt. Each physics body stores prev and curr position + quaternion; before stepping copy curr→prev; render with lerpVectors/slerpQuaternions using alpha; provide `teleport()` that sets both. Write Vitest tests with power-of-two steps: 30 fps rendering at 60 Hz physics gives 2 steps per frame, step totals over 1 s don't depend on frame pattern, a 5 s frame is clamped, and alpha equals the leftover fraction.",
  related: [
    "tunneling",
    "particle-system",
    "steering-behaviors",
    "client-side-prediction",
    "rollback-netcode",
    "deterministic-lockstep",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Integrating physics with the raw frame delta makes the simulation depend on frame rate. Jumps reach different heights at 30 and 144 fps, springs explode after a hitch, and replays drift. A **fixed timestep** always advances the simulation by the same `dt` (for example 1/60 s) no matter how long the frame took.",
    "Each frame adds the real elapsed time to an **accumulator**, then runs as many fixed steps as fit, keeping the remainder. Clamp the frame time first (e.g. to 0.25 s). Without that clamp a slow frame queues many steps, those steps make the next frame slow too, and the game falls into the **spiral of death**.",
    "The leftover time means rendering is up to one step behind. Keep the previous and current physics states and draw `lerp(prev, curr, alpha)` with `alpha = accumulator / dt`. Motion then looks smooth even when the physics rate is lower than the display's, or doesn't divide evenly into it (60 Hz physics on a 144 Hz monitor).",
  ],
  formulas: [
    {
      label: "Accumulator",
      math: tex`A \leftarrow A + \min(\Delta t_{\text{frame}},\ \Delta t_{\max}); \quad \text{while } A \ge h:\ \text{step}(h),\ A \leftarrow A - h`,
    },
    {
      label: "Render interpolation",
      math: tex`\alpha = \frac{A}{h}, \qquad \textcolor{#fafafa}{x_{\text{draw}}} = x_{\text{prev}} + \alpha\,(x_{\text{curr}} - x_{\text{prev}})`,
      note: "For rotations, slerp quaternions with the same α.",
    },
  ],
  rules: [
    "Common rates: 50 or 60 Hz for gameplay physics, 120–240 Hz for stiff springs, vehicles and ragdolls.",
    "Clamp frame time to 0.1–0.25 s and/or cap steps per frame at about 5–8.",
    "Read input once per frame, but apply forces inside each fixed step.",
    "Don't interpolate teleports. Copy curr into prev when you snap an object so it doesn't streak across the map.",
    "Cameras that follow an interpolated object must read the interpolated position, or they jitter against it.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Fixed update with interpolation:",
      code: `const STEP = 1 / 60
let acc = 0
let last = performance.now() / 1000

function frame(nowMs: number) {
  const now = nowMs / 1000
  acc += Math.min(now - last, 0.25)   // avoid the spiral of death
  last = now
  while (acc >= STEP) {
    prev.copy(curr)                   // keep the state we step from
    physicsStep(curr, STEP)
    acc -= STEP
  }
  const alpha = acc / STEP
  mesh.position.lerpVectors(prev.position, curr.position, alpha)
  mesh.quaternion.slerpQuaternions(prev.rotation, curr.rotation, alpha)
  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}`,
    },
  ],
  mistakes: [
    "Clamping `dt` and calling it a fixed step: the simulation still depends on frame rate whenever frames are faster than the clamp.",
    "No upper bound on frame time, so after a tab switch or breakpoint the game runs thousands of steps and freezes.",
    "Rendering the current state without interpolation: at 30 Hz physics on a 60 Hz screen, motion stutters in steps.",
    "Applying a one-off impulse (jump) once per frame instead of in the next fixed step, so it fires zero or two times.",
    "Assuming fixed steps alone make a game deterministic. Iteration order, float math across platforms and unseeded randomness also matter.",
  ],
  reading: [
    {
      title: "Gaffer On Games — Fix Your Timestep!",
      url: "https://gafferongames.com/post/fix_your_timestep/",
    },
    {
      title: "MDN — Anatomy of a video game (main loop)",
      url: "https://developer.mozilla.org/en-US/docs/Games/Anatomy",
    },
  ],
  visual:
    "Two balls bounce from the same height. The yellow faceted ball integrates with jittery frame times, so its bounces drift off the gray dashed line. The smooth white sphere runs fixed physics steps and keeps hitting the line. The small faint gray ball beside it is the raw physics state: turn interpolation off to see the white ball snap between ticks, and lower physics Hz to exaggerate it.",
}

export default sheet
