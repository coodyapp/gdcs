import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "trigonometry",
  category: "mathematics",
  subcategory: "trigonometry",
  title: "Trigonometry for Games",
  hook: "angles in, directions out, and back again with atan2",
  summary:
    "Sine and cosine turn an angle into a direction on the unit circle; atan2 turns a direction back into an angle for aiming and turning.",
  level: "core",
  tags: [
    "sin",
    "cos",
    "atan2",
    "unit circle",
    "radians",
    "angle wrapping",
    "aiming",
  ],
  updated: "2026-11-01",
  prompt:
    "Write `src/lib/angles.ts` in TypeScript with: `degToRad`, `radToDeg`, `wrapAngle(a)` mapping any radian value into (-π, π] without loops, `angleDelta(from, to)` = shortest signed turn, `dirFromAngle(theta, out)` returning (cos θ, sin θ), `aimAngle(from, to)` using Math.atan2(dy, dx), and `rotateTowards(current, target, maxStep)` that turns by at most maxStep along the short way and lands exactly on the target. Then use them in a Three.js top-down turret on the XZ plane: each frame compute the yaw to the mouse point with atan2 (mind the axis order and sign for -Z forward), rotate towards it at 180°/s using dt, and only fire when |angleDelta| < 5°. Write Vitest tests: atan2 returns the right angle in all four quadrants and on the axes; wrapAngle(3π) = π and wrapAngle(-190°) = 170°; rotateTowards crosses the ±180° seam the short way.",
  related: ["vectors", "dot-and-cross-product", "euler-angles", "quaternions"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Put a point on a circle of radius 1 at angle θ, measured counter-clockwise from +x. Its x coordinate is `cos θ` and its y coordinate is `sin θ`. That is the whole idea: **cos and sin turn an angle into a unit direction**. Multiply by a radius to get a point on any circle, add a centre to move it, and animate θ to orbit. Because the point is on the unit circle, `cos²θ + sin²θ = 1` always.",
    "Going the other way, from a direction to an angle, use **`Math.atan2(y, x)`**. Plain `atan(y / x)` loses the quadrant (both (1, 1) and (−1, −1) give 45°) and divides by zero straight up; `atan2` looks at both signs and returns the full range (−π, π]. Note the argument order: **y first**. Aiming a turret, rotating a sprite to face its velocity and computing a heading for [vectors](/mathematics/vectors/vectors) all go through `atan2`.",
    "Every JavaScript and Three.js angle is in **radians**: a full turn is 2π ≈ 6.283, so 1 rad ≈ 57.3°. Keep degrees for UI and config, convert at the edges with `THREE.MathUtils.degToRad`, and do the maths in radians.",
    "Angles wrap: 350° and −10° are the same heading. Before subtracting two headings, **wrap** the difference into (−π, π] so a turret at 170° turning to −170° goes 20° the short way instead of 340° the long way. For 3D orientation, angles alone hit their limits; see [quaternions](/mathematics/rotations/quaternions).",
  ],
  formulas: [
    {
      label: "Unit circle",
      math: tex`\textcolor{#fafafa}{P(\theta)} = (\textcolor{#f5d547}{\cos\theta},\; \textcolor{#a1a1aa}{\sin\theta}), \qquad \cos^2\theta + \sin^2\theta = 1`,
    },
    {
      label: "Aim angle",
      math: tex`\theta = \operatorname{atan2}(\Delta y,\, \Delta x) \in (-\pi, \pi]`,
      note: "Δ = target − origin. Arguments are (y, x), not (x, y).",
    },
    {
      label: "Degrees and radians",
      math: tex`\theta_{rad} = \theta_{deg} \cdot \frac{\pi}{180}, \qquad 2\pi\ \text{rad} = 360^\circ`,
    },
    {
      label: "Wrap into (−π, π]",
      math: tex`\operatorname{wrap}(\theta) = \theta - 2\pi \left\lfloor \frac{\theta + \pi}{2\pi} \right\rfloor`,
    },
  ],
  rules: [
    "Orbit or circle motion: `x = cx + r·cos(ω·t)`, `y = cy + r·sin(ω·t)`; ω = 2π / period, so a 4 s orbit uses ω ≈ 1.571 rad/s.",
    "Turn rate limits: 180–360°/s feels snappy for turrets, 90–120°/s feels heavy. Multiply by dt and clamp the step to the wrapped difference.",
    "Bob and pulse: `offset = amplitude · sin(2π · frequency · t)`; 0.05–0.15 units at 1–2 Hz reads as idle breathing.",
    "If you only need to know whether something is in front or to the left, a dot or cross product is cheaper and avoids wrapping entirely.",
    "Three.js cameras and models face −Z: a yaw from atan2 on the XZ plane is usually `Math.atan2(dx, dz)` plus π or with a negated axis. Test one known direction before trusting it.",
  ],
  code: [
    {
      lang: "ts",
      caption:
        "Turret that turns the short way towards a target at a capped rate:",
      code: `const TAU = Math.PI * 2
const wrap = (a: number) => a - TAU * Math.floor((a + Math.PI) / TAU)

function aimTurret(turret: THREE.Object3D, target: THREE.Vector3, dt: number) {
  const dx = target.x - turret.position.x
  const dz = target.z - turret.position.z
  const desired = Math.atan2(dx, dz)        // yaw about +Y; 0 faces +Z
  const diff = wrap(desired - turret.rotation.y)
  const maxStep = THREE.MathUtils.degToRad(240) * dt
  turret.rotation.y = wrap(
    turret.rotation.y + THREE.MathUtils.clamp(diff, -maxStep, maxStep)
  )
  return Math.abs(diff) < THREE.MathUtils.degToRad(5) // on target: fire
}`,
    },
    {
      lang: "ts",
      caption: "Spawn n enemies evenly around a ring:",
      code: `for (let i = 0; i < n; i++) {
  const theta = (i / n) * Math.PI * 2
  enemies[i].position.set(
    center.x + radius * Math.cos(theta),
    0,
    center.z + radius * Math.sin(theta)
  )
}`,
    },
  ],
  mistakes: [
    "Passing degrees to `Math.sin`/`Math.cos`. `Math.sin(90)` is 0.894, not 1.",
    "Writing `Math.atan2(x, y)` by habit. The order is (y, x); swapping it mirrors the angle across the diagonal.",
    "Using `atan(dy / dx)`: it loses the quadrant and blows up when dx is 0.",
    "Lerping raw angles across the ±180° seam, so the object spins the long way round. Wrap the difference first.",
    "Letting an accumulated angle grow forever; after hours of play precision drops. Wrap it each frame.",
  ],
  reading: [
    {
      title: "MDN — Math.atan2()",
      url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/atan2",
    },
    {
      title: "Three.js docs — MathUtils",
      url: "https://threejs.org/docs/#api/en/math/MathUtils",
    },
    {
      title: "MDN — Math.sin()",
      url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/sin",
    },
  ],
  visual:
    "The green diamond is a target. The thin white arrow is the unit direction θ = atan2(dy, dx) towards it, ending at the white dot on the grey unit circle, and the white dashed line continues to the target. The thick yellow bar along the axis is cos θ and the thick grey upright bar is sin θ; the white arc is θ itself. Turn the target off and drag the angle past ±180° to see it wrap.",
}

export default sheet
