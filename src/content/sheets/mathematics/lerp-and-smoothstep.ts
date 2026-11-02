import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "lerp-and-smoothstep",
  category: "mathematics",
  subcategory: "interpolation",
  title: "Lerp and Smoothstep",
  hook: "blend between two values, then make the blend feel good",
  summary:
    "Lerp blends two values by t, inverse lerp finds t, remap chains both. Smoothstep softens the ends, and exponential damping chases a target at any frame rate.",
  level: "core",
  tags: [
    "lerp",
    "inverse lerp",
    "remap",
    "clamp",
    "smoothstep",
    "damping",
    "interpolation",
  ],
  updated: "2026-11-01",
  prompt:
    "Write `src/lib/interp.ts` in TypeScript with pure functions: `clamp(x, min, max)`, `lerp(a, b, t)` (unclamped), `inverseLerp(a, b, v)` returning 0 when a === b, `remap(v, inMin, inMax, outMin, outMax)`, `smoothstep(edge0, edge1, x)` and `smootherstep(edge0, edge1, x)` (both clamp t to [0, 1]), and `damp(current, target, lambda, dt)` = lerp(current, target, 1 - Math.exp(-lambda * dt)) plus `lambdaFor(fraction, seconds)`. Use them in a Three.js camera follow that damps position towards the player with lambda = lambdaFor(0.99, 0.4) using reused vectors, and a fog density that remaps the camera height from [2, 40] to [0.05, 0.005] with clamping. Write Vitest tests: lerp hits both endpoints; inverseLerp undoes lerp; remap is reversible; smoothstep is 0 and 1 at the edges, 0.5 in the middle and monotonic; damp gives the same result stepping 30 or 144 times over one second.",
  related: ["easing", "bezier-curves", "delta-time", "camera-deadzone"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "**Lerp** (linear interpolation) blends from `a` to `b` by a fraction `t`: `a + (b − a)·t`. At `t = 0` you get `a`, at `t = 1` you get `b`, and anything outside [0, 1] extrapolates. It works on numbers, colours, and component-wise on vectors (`Vector3.lerp`). **Inverse lerp** answers the opposite question: where does `v` sit between `a` and `b`, as a 0..1 fraction? Chain the two and you get **remap**, which converts any range to any other: health 0..100 to a bar width, speed to engine pitch, height to fog density. **Clamp** the fraction when the output must stay in range.",
    "Linear blends start and stop abruptly. **Smoothstep** runs `t` through `3t² − 2t³`, which has zero slope at both ends, so a fade or move eases in and out. **Smootherstep** (`6t⁵ − 15t⁴ + 10t³`) also has zero curvature at the ends, which matters for camera moves and noise. Both take two edges and clamp, which makes them handy soft thresholds in shaders: `smoothstep(0.4, 0.6, d)` is a step with a soft border. For more curve shapes see [easing functions](/mathematics/interpolation/easing).",
    "A common trap is `pos = lerp(pos, target, 0.1)` every frame. It does smooth out motion, but it closes 10% of the gap **per frame**, so the game is twice as snappy at 120 fps as at 60. The fix is **exponential damping**: use `t = 1 − e^(−λ·dt)` with the frame's [delta time](/game-feel/timing/delta-time). Now the same fraction of the gap closes per **second** at any frame rate. It never quite arrives, so snap when close enough.",
  ],
  formulas: [
    {
      label: "Lerp and inverse lerp",
      math: tex`\textcolor{#fafafa}{\operatorname{lerp}(a, b, t)} = a + (b - a)\,t, \qquad \operatorname{invlerp}(a, b, v) = \frac{v - a}{b - a}`,
    },
    {
      label: "Remap",
      math: tex`\operatorname{remap}(v) = \operatorname{lerp}\!\big(c,\, d,\, \operatorname{invlerp}(a, b, v)\big)`,
      note: "Maps [a, b] onto [c, d]; clamp the inner fraction to keep the output in range.",
    },
    {
      label: "Smoothstep and smootherstep",
      math: tex`\textcolor{#fdc700}{S_1(t)} = 3t^2 - 2t^3, \qquad S_2(t) = 6t^5 - 15t^4 + 10t^3`,
    },
    {
      label: "Frame-rate-independent damping",
      math: tex`\textcolor{#a3a3a3}{x} \leftarrow \operatorname{lerp}\!\big(\textcolor{#a3a3a3}{x},\, x_{target},\, 1 - e^{-\lambda\,\Delta t}\big)`,
      note: "λ = −ln(1 − fraction) / seconds: λ ≈ 4.6 closes 99% of the gap in 1 s.",
    },
  ],
  rules: [
    "Camera follow: λ ≈ 5–10 /s feels tight, 2–4 /s feels floaty. λ = 4.6 closes 99% of the gap in one second.",
    "Snap when within a small epsilon (e.g. 0.001 units or 0.1°) so damped values actually reach their target and stop dirtying state.",
    "Fixed-duration moves (a door opening in 0.4 s) use lerp + smoothstep of `elapsed / duration`. Moving or unknown targets use damping.",
    "Clamp t before `lerp` when overshoot would be a bug (health bars, alpha). Leave it unclamped when extrapolation is wanted.",
    "In GLSL, `mix` is lerp and `smoothstep` is built in, with the same argument order: `smoothstep(edge0, edge1, x)`.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Remap, smoothstep and frame-rate-independent follow:",
      code: `const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const invLerp = (a: number, b: number, v: number) => (a === b ? 0 : (v - a) / (b - a))
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const remap = (v: number, a: number, b: number, c: number, d: number) =>
  lerp(c, d, clamp01(invLerp(a, b, v)))
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01(invLerp(e0, e1, x))
  return t * t * (3 - 2 * t)
}

// Fog thins with altitude; vignette fades in between 30% and 10% health.
scene.fog.density = remap(camera.position.y, 2, 40, 0.05, 0.005)
vignette.opacity = 1 - smoothstep(0.1, 0.3, hp / maxHp)

// Camera chases the player at the same speed at 30, 60 or 144 fps.
const LAMBDA = 6
function follow(dt: number) {
  camera.position.lerp(goal, 1 - Math.exp(-LAMBDA * dt))
}`,
    },
  ],
  mistakes: [
    "`x = lerp(x, target, 0.1)` per frame without dt: speed depends on frame rate.",
    "Lerping from the **current** value while also stepping `t` from 0 to 1 over time. That double-eases and finishes early; lerp from the stored start value instead.",
    "Swapping smoothstep's argument order, or passing equal edges, which divides by zero (guard it).",
    "Lerping angles or rotations component-wise. Wrap angles first, and use slerp for quaternions.",
  ],
  reading: [
    {
      title:
        "Three.js docs — MathUtils (lerp, inverseLerp, mapLinear, smoothstep, damp)",
      url: "https://threejs.org/docs/#api/en/math/MathUtils",
    },
    {
      title: "Khronos — GLSL smoothstep",
      url: "https://registry.khronos.org/OpenGL-Refpages/gl4/html/smoothstep.xhtml",
    },
  ],
  visual:
    "Three markers travel from the grey post A to the green post B. The white sphere lerps at constant speed; the yellow cube follows smoothstep and eases in and out; the grey diamond uses exponential damping, rushing off and then crawling, and never quite arriving. The plot above shows the same three curves: thin white straight line, thick yellow S-curve, grey dashed curve. Raise λ to make damping snappier, or switch to smootherstep.",
}

export default sheet
