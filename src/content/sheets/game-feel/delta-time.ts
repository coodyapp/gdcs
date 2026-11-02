import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "delta-time",
  category: "game-feel",
  subcategory: "timing",
  title: "Delta Time",
  hook: "scale every change by how long the last frame took",
  summary:
    "Delta time is the seconds since the last frame. Multiply speeds and rates by it so a game plays the same at 30, 60 or 144 fps.",
  level: "core",
  tags: [
    "delta time",
    "frame rate",
    "game loop",
    "frame-rate independence",
    "requestAnimationFrame",
  ],
  updated: "2026-11-02",
  prompt:
    "Write a TypeScript game loop for a Three.js scene using requestAnimationFrame. Compute dt in seconds from the rAF timestamp, clamp it to 0.1 s, and support a timeScale (0 = paused) while also passing an unscaled dt to UI code. Move a player at a speed in units/s, apply friction as v *= Math.pow(f, dt * 60), and smooth a camera with x += (target - x) * (1 - Math.exp(-k * dt)). Put the pure update in a function and write a Vitest test that runs it at 30 and 144 fps for 2 s and asserts positions match within 1%.",
  related: [
    "fixed-timestep",
    "frame-budget",
    "acceleration-and-friction",
    "hit-stop",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Frames do not arrive at a steady rate. A 144 Hz monitor runs the loop more than twice as often as a 60 Hz one, and a busy frame can take 40 ms instead of 16. If you move a player by `5` units **per frame**, their speed depends on the hardware. Delta time `dt` is the real time the previous frame took. Write speeds in units **per second** and multiply by `dt`, and motion becomes frame-rate independent.",
    "In the browser, `requestAnimationFrame` hands your callback a timestamp in milliseconds. `dt` is that timestamp minus the previous one, divided by 1000. In React Three Fiber the second argument of `useFrame` is already `dt` in seconds.",
    "Linear changes (`x += v·dt`) scale exactly. Anything that compounds per frame does not: `v *= 0.9` each frame is friction that is stronger at high fps. Use `Math.pow(0.9, dt·60)` or the exponential form `1 − e^(−k·dt)` instead. For physics or anything that must be deterministic, accumulate `dt` and step a [fixed timestep](/systems/simulation/fixed-timestep).",
  ],
  formulas: [
    {
      label: "Position update",
      math: tex`x_{t+\Delta t} = x_t + v\,\textcolor{#fafafa}{\Delta t}`,
    },
    {
      label: "Frame-rate independent decay",
      math: tex`v \leftarrow v \cdot f^{\,\Delta t \cdot 60} = v\,e^{-k\,\Delta t}`,
      note: "f is the per-frame factor you tuned at 60 fps; k = −60·ln f is the same decay per second.",
    },
    {
      label: "Exponential smoothing toward a target",
      math: tex`x \leftarrow x + (x_{target} - x)\,(1 - e^{-k\,\Delta t})`,
    },
  ],
  rules: [
    "Clamp `dt` to about 0.1 s (or 0.25 s). A tab that was in the background can report several seconds and teleport everything.",
    'Store speeds in units/s, accelerations in units/s², and rates as per-second constants. Never tune in "per frame" units.',
    "Pause by setting `dt = 0`; slow motion by `dt × timeScale`. Keep a separate unscaled `dt` for UI and menus.",
    "Gravity with semi-implicit Euler (`v += g·dt; x += v·dt`) is fine for gameplay. Use a fixed step if jump height must be identical everywhere.",
  ],
  code: [
    {
      lang: "ts",
      caption: "A minimal browser loop with clamped delta time:",
      code: `let last = performance.now()
const speed = 4 // units per second

function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.1) // seconds, clamped
  last = now

  player.position.x += speed * dt
  // per-frame friction 0.9 tuned at 60 fps, made fps-independent
  velocity *= Math.pow(0.9, dt * 60)

  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)`,
    },
  ],
  mistakes: [
    "Moving by a constant amount per frame. The game runs 2.4× faster on a 144 Hz display than on 60 Hz.",
    "Multiplying a per-frame damping factor without converting it: `v *= 0.98` is much stronger at high frame rates.",
    "Not clamping `dt` after a pause, breakpoint or hidden tab, so objects tunnel through walls on the next frame.",
    "Applying `dt` twice, e.g. to the velocity and again to an acceleration that was already integrated.",
    "Expecting variable `dt` to give deterministic physics. Replays and networking need a fixed step.",
  ],
  reading: [
    {
      title: "Gaffer On Games — Fix Your Timestep!",
      url: "https://gafferongames.com/post/fix_your_timestep/",
    },
    {
      title: "MDN — Window.requestAnimationFrame()",
      url: "https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame",
    },
    {
      title: "Game Programming Patterns — Game Loop",
      url: "https://gameprogrammingpatterns.com/game-loop.html",
    },
  ],
  visual:
    "Two runners race in separate lanes under a simulated frame rate toward the white finish wall. The white box in the back lane multiplies its speed by delta time; the red box in the front lane (the bug) moves a fixed amount per frame tuned for 60 fps. The thin tick marks in each lane are individual frames. Drop the FPS slider and red falls behind; raise it above 60 and red wins. Turn on uneven frames and white still arrives on time.",
}

export default sheet
