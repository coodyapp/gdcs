import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "acceleration-and-friction",
  category: "game-feel",
  subcategory: "motion",
  title: "Acceleration and Friction",
  hook: "ramp velocity toward the input instead of snapping to it",
  summary:
    "Ramp velocity toward input × max speed with an acceleration, and back to zero with a separate deceleration, to give movement weight.",
  level: "core",
  tags: [
    "acceleration",
    "friction",
    "deceleration",
    "movement",
    "character controller",
    "velocity",
  ],
  updated: "2026-11-02",
  prompt:
    "Write a TypeScript movement controller for a Three.js character with separate ground acceleration (40 u/s²), deceleration (70 u/s²), max speed (6 u/s) and an air control factor (0.6). Each update: compute target = input * maxSpeed; use deceleration when input is zero or opposes current velocity, acceleration otherwise; approach the target with moveTowards(v, target, rate * dt). Also provide an exponential option v = target + (v - target) * Math.exp(-k * dt). Write Vitest tests: time to top speed equals maxSpeed / accel within one step, and positions after a 1.2 s input sequence match at 30 and 144 fps within 0.15 units.",
  related: [
    "delta-time",
    "squash-and-stretch",
    "steering-behaviors",
    "camera-deadzone",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Setting `velocity = input × maxSpeed` gives instant, weightless movement. Most games instead move the **current** velocity toward that target by at most `accel × dt` per frame, and use a separate, usually higher, `decel` when the stick is released or reversed. The two numbers describe a character: a tight platformer hero reaches top speed in ~0.1 s and stops in ~0.05 s; a heavy vehicle takes a second or more.",
    "`moveTowards(v, target, rate·dt)` gives linear ramps with exact, designer-friendly times: time to top speed is `maxSpeed / accel`. The alternative is exponential damping, `v = target + (v − target)·e^(−k·dt)`. It starts fast and eases in, never quite arriving, and is frame-rate independent when written with `exp` (see [delta time](/game-feel/timing/delta-time)).",
    "Use lower values in the air than on the ground (air control), a higher deceleration when turning around (skid), and surface-specific friction for ice or mud. Visual stretch while speeding up pairs well with [squash and stretch](/game-feel/motion/squash-and-stretch).",
  ],
  formulas: [
    {
      label: "Linear approach",
      math: tex`\textcolor{#f5d547}{v} \leftarrow \textcolor{#f5d547}{v} + \operatorname{clamp}(v_{target} - \textcolor{#f5d547}{v},\; -a\,\Delta t,\; a\,\Delta t)`,
    },
    {
      label: "Exponential damping",
      math: tex`\textcolor{#f5d547}{v} \leftarrow v_{target} + (\textcolor{#f5d547}{v} - v_{target})\,e^{-k\,\Delta t}`,
      note: "Choose k = a / v_max to match the linear version's initial slope.",
    },
    {
      label: "Time to top speed / stopping distance",
      math: tex`t_{up} = \frac{v_{max}}{a}, \qquad d_{stop} = \frac{v_{max}^2}{2\,a_{decel}}`,
    },
  ],
  rules: [
    "Snappy platformer: reach top speed in 0.05–0.15 s, stop in 0.03–0.1 s.",
    "Weighty character or vehicle: 0.3–1 s to top speed, deceleration 1.5–3× acceleration.",
    "Air control: 40–70% of ground acceleration.",
    "Turning around: use the deceleration (or a dedicated turn rate) until velocity crosses zero, then accelerate.",
  ],
  code: [
    {
      lang: "ts",
      caption:
        "Horizontal movement with separate acceleration and deceleration:",
      code: `function moveTowards(cur: number, target: number, maxDelta: number) {
  const d = target - cur
  return Math.abs(d) <= maxDelta ? target : cur + Math.sign(d) * maxDelta
}

const ACCEL = 40, DECEL = 70, MAX_SPEED = 6 // units/s², units/s
const AIR_FACTOR = 0.6

function updateMovement(dt: number, input: number /* -1..1 */) {
  const target = input * MAX_SPEED
  const braking = input === 0 || Math.sign(input) !== Math.sign(vel.x)
  let rate = braking ? DECEL : ACCEL
  if (!grounded) rate *= AIR_FACTOR
  vel.x = moveTowards(vel.x, target, rate * dt)
  player.position.x += vel.x * dt
}`,
    },
  ],
  mistakes: [
    "Applying friction as `v *= 0.9` per frame, which depends on frame rate. Use `moveTowards` with `dt` or `exp(−k·dt)`.",
    "Using the same value for speeding up and slowing down. Players expect to stop faster than they start.",
    "Clamping speed after adding input force, so diagonal input or external pushes exceed the max.",
    "Letting friction act on velocity from knockback or moving platforms the same way as input, which kills those effects instantly.",
  ],
  reading: [
    {
      title: "Gaffer On Games — Integration Basics",
      url: "https://gafferongames.com/post/integration_basics/",
    },
    {
      title: "GDC Vault — Math for Game Programmers: Building a Better Jump",
      url: "https://www.gdcvault.com/play/1023559/Math-for-Game-Programmers-Building",
    },
  ],
  visual:
    "The white box is driven by a repeating input: right, release, left, release. The plot scrolls with time: the thin grey trace is the target velocity the input asks for, the thicker yellow dotted trace is the actual velocity v, also shown as the dashed yellow arrow on the box. Raise acceleration for a snappier ramp, lower deceleration for a longer slide, or switch the model to compare linear, exponential and instant.",
}

export default sheet
