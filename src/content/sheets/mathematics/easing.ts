import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "easing",
  category: "mathematics",
  subcategory: "interpolation",
  title: "Easing Functions",
  hook: "bend linear progress into motion with weight",
  summary:
    "An easing function remaps progress t from 0..1 so motion accelerates, decelerates, overshoots or bounces instead of moving at a robotic constant speed.",
  level: "core",
  tags: ["easing", "tween", "interpolation", "animation", "lerp"],
  updated: "2026-11-01",
  prompt:
    "Create `src/lib/easing.ts` in TypeScript with pure functions `(t: number) => number` for linear, in/out/inOut quad and cubic, inOutSine, outExpo, outBack (s = 1.70158), outElastic, outBounce and smoothstep, plus `reverse(f)` returning 1 - f(1 - t) and `ease(f, a, b, t)` that clamps t to [0, 1]. Then write a `Tween` class for Three.js that interpolates a Vector3 over a duration with a chosen easing, supports interruption by restarting from the current value, and never allocates in update(dt). Write Vitest tests: every easing has f(0) = 0 and f(1) = 1; in-out curves pass through 0.5 at t = 0.5; quad curves are monotonic; outBack exceeds 1 somewhere.",
  related: ["quaternions", "squash-and-stretch", "acceleration-and-friction"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A tween moves a value from `a` to `b` over a duration. Linear progress `t = elapsed / duration` gives constant speed, which reads as mechanical. An **easing function** `f(t)` reshapes that progress before the lerp: `value = a + (b - a) · f(t)`. Every easing satisfies `f(0) = 0` and `f(1) = 1`; what happens in between is the personality.",
    "**Ease-in** (`t²`, `t³`) starts slow and ends fast, like something gathering speed: good for objects leaving the screen. **Ease-out** (`1 - (1 - t)²`) starts fast and settles, like something with friction arriving: the default for UI and cameras. **Ease-in-out** does both and suits moves that start and end at rest. **Back** overshoots and returns, **elastic** wobbles, **bounce** imitates a dropped ball.",
    "The slope of the curve is the speed. Zero slope at an end means a soft start or stop; a vertical jump in slope is a visible jolt. Any ease-in turns into its ease-out mirror with `out(t) = 1 - in(1 - t)`.",
    "Easing is for **scripted** motion with a known duration: menus, pickups, camera cuts, [squash and stretch](/game-feel/motion/squash-and-stretch). For motion that chases a moving target, use a damped approach (`lerp` with `1 - exp(-k·dt)`) or a spring instead, so it stays frame-rate independent.",
  ],
  formulas: [
    {
      label: "Eased lerp",
      math: tex`x(t) = a + (b - a)\,f\!\left(\tfrac{t_{now} - t_0}{T}\right)`,
    },
    {
      label: "Common curves",
      math: tex`\text{in}_2 = t^2,\quad \text{out}_2 = 1-(1-t)^2,\quad \text{smoothstep} = 3t^2 - 2t^3`,
    },
    {
      label: "Mirror",
      math: tex`f_{out}(t) = 1 - f_{in}(1 - t)`,
    },
    {
      label: "Back (overshoot)",
      math: tex`f(t) = 1 + (s+1)(t-1)^3 + s(t-1)^2,\quad s \approx 1.70158`,
      note: "s = 1.70158 overshoots by about 10%. Bigger s, bigger overshoot.",
    },
  ],
  rules: [
    "UI pops in: ease-out cubic, 150–250 ms. Out of the screen: ease-in, slightly faster.",
    "Camera moves between points: ease-in-out, 0.4–1.0 s.",
    "Pickup / reward: ease-out-back for a satisfying overshoot.",
    "Clamp t to [0, 1] before easing; back and elastic already go outside [0, 1] on their own.",
    "Keep easing functions pure `(t) => number` so they can be swapped and unit tested.",
  ],
  code: [
    {
      lang: "ts",
      caption: "A tiny tween with pluggable easing:",
      code: `type Easing = (t: number) => number
const outCubic: Easing = (t) => 1 - (1 - t) ** 3
const inOutQuad: Easing = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
const outBack: Easing = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2

function tween(from: THREE.Vector3, to: THREE.Vector3, seconds: number, ease: Easing) {
  let elapsed = 0
  const out = new THREE.Vector3()
  return (dt: number) => {
    elapsed = Math.min(elapsed + dt, seconds)
    out.lerpVectors(from, to, ease(elapsed / seconds))
    return { value: out, done: elapsed >= seconds }
  }
}

const step = tween(card.position.clone(), new THREE.Vector3(0, 2, 0), 0.25, outBack)
// in the frame loop: card.position.copy(step(dt).value)`,
    },
  ],
  mistakes: [
    "Easing a value toward a moving target every frame; it never arrives and changes speed with frame rate.",
    "Applying the easing to elapsed time instead of normalized progress (forgetting to divide by duration).",
    "Not clamping t, so a long frame pushes the value past the end (especially with ease-in curves).",
    "Using bounce or elastic for everything; they are seasoning, not the base.",
    "Restarting a tween from its original start instead of the current value when interrupted, causing a snap.",
  ],
  reading: [
    {
      title: "Three.js docs — MathUtils (lerp, damp, smoothstep)",
      url: "https://threejs.org/docs/#api/en/math/MathUtils",
    },
    {
      title: "MDN — CSS easing functions",
      url: "https://developer.mozilla.org/en-US/docs/Web/CSS/easing-function",
    },
  ],
  visual:
    "The cyan curve is the chosen easing plotted as progress (left to right) against value (up), with linear as the grey diagonal. The orange dot rides the curve, and the orange ball on the track below moves by that value while the grey ball moves linearly. Switch curves to compare how they start, stop and overshoot.",
}

export default sheet
