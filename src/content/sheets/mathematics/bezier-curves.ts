import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "bezier-curves",
  category: "mathematics",
  subcategory: "interpolation",
  title: "Bézier Curves",
  hook: "lerp between lerps until one point is left",
  summary:
    "A Bézier curve is nested lerps between control points. Learn quadratic and cubic forms, tangents, and arc-length tables for constant-speed motion.",
  level: "common",
  tags: ["bezier", "curve", "spline", "de casteljau", "arc length", "path"],
  updated: "2026-11-01",
  prompt:
    "Write `src/lib/bezier.ts` in TypeScript: `cubicPoint(p0, p1, p2, p3, t, out)` and `cubicTangent(...)` writing into a THREE.Vector3 without allocating; `buildArcTable(curve, samples = 128)` returning a Float32Array of cumulative chord lengths at evenly spaced t; and `tAtDistance(table, s)` that binary-searches the table and linearly interpolates, clamping s to [0, length]. Then add a `PathFollower` for Three.js that moves an Object3D along the curve at a constant `speed` (units/second) using the table, faces along the tangent with lookAt(position + tangent), and loops or ping-pongs. Write Vitest tests: de Casteljau equals the Bernstein form for 11 values of t; the table is strictly increasing; 20 equal-distance samples have chord lengths within 2% of each other while equal-t samples do not.",
  related: ["lerp-and-smoothstep", "easing", "vectors", "steering-behaviors"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A Bézier curve is defined by **control points**. It starts at the first, ends at the last, and is pulled toward the ones in between without usually touching them. A **quadratic** curve has three points (one handle); a **cubic** has four (two handles) and is the workhorse for camera rails, projectile arcs, UI motion paths, road splines and font outlines.",
    "**de Casteljau's construction** shows what is going on. For a parameter `t`, lerp each neighbouring pair of control points by `t`, then lerp those results, and repeat until one point is left. That point is on the curve. The last segment of the construction is the **tangent** at that point, so you get the direction for free. Expanding the nested lerps gives the Bernstein polynomial form, which is cheaper to evaluate in a tight loop.",
    "**`t` is not distance.** Equal steps in `t` bunch up where the control points are close and spread out where they are far apart, so an object moving with `t = time / duration` speeds up and slows down. For constant speed, sample the curve once into an **arc-length table** (cumulative chord lengths at evenly spaced `t`), then turn a distance travelled into `t` with a binary search. See also [easing](/mathematics/interpolation/easing) for deliberately non-uniform speed.",
    "To chain cubics into a longer path without a kink, make the handles on either side of a joint collinear with it (G1), or mirror them at equal length (C1, smooth velocity). Three.js ships `QuadraticBezierCurve3`, `CubicBezierCurve3` and `CurvePath`, with `getPointAt(u)` already doing the arc-length lookup.",
  ],
  formulas: [
    {
      label: "Quadratic",
      math: tex`B(t) = (1-t)^2 P_0 + 2(1-t)t\,P_1 + t^2 P_2`,
    },
    {
      label: "Cubic (Bernstein form)",
      math: tex`\textcolor{#fafafa}{B(t)} = (1-t)^3 P_0 + 3(1-t)^2 t\,P_1 + 3(1-t)t^2 P_2 + t^3 P_3`,
      note: "The white curve in the visual.",
    },
    {
      label: "de Casteljau step",
      math: tex`\textcolor{#a1a1aa}{P_i^{(k)}} = (1-t)\,P_i^{(k-1)} + t\,P_{i+1}^{(k-1)}`,
      note: "Each grey construction level has one point fewer; the last one is B(t).",
    },
    {
      label: "Cubic tangent",
      math: tex`\textcolor{#f5d547}{B'(t)} = 3(1-t)^2(P_1-P_0) + 6(1-t)t\,(P_2-P_1) + 3t^2(P_3-P_2)`,
    },
    {
      label: "Arc length",
      math: tex`s(t) = \int_0^t \lVert B'(u)\rVert\,du \;\approx\; \sum_{i} \lVert B(t_{i+1}) - B(t_i)\rVert`,
      note: "Store s at N evenly spaced t, then invert it with a binary search.",
    },
  ],
  rules: [
    "64–256 table samples is plenty for game paths; rebuild the table only when control points change.",
    "Constant speed: `distance += speed * dt`, then `t = tAtDistance(table, distance)`.",
    "A cubic's start tangent is `3·(P1 − P0)`: aim the first handle where the motion should leave from.",
    "Smooth joints: next curve's P1 = 2·P3 − P2 of the previous curve (C1).",
    "Keep handles to about ⅓ of the segment length for curves that look natural.",
  ],
  code: [
    {
      lang: "ts",
      caption:
        "Constant-speed follower with Three.js (it builds the arc-length table for you):",
      code: `const path = new THREE.CubicBezierCurve3(
  new THREE.Vector3(-4, 0, 1.5),
  new THREE.Vector3(-3.6, 0, -1.2),
  new THREE.Vector3(3.5, 0, -3),
  new THREE.Vector3(4, 0, 2),
)
path.arcLengthDivisions = 200 // table resolution
const length = path.getLength()
const pos = new THREE.Vector3()
const tangent = new THREE.Vector3()
let travelled = 0

function update(dt: number, speed = 3) {
  travelled = (travelled + speed * dt) % length
  const u = travelled / length    // fraction of the length, not t
  path.getPointAt(u, pos)         // getPoint(t) would be the naive version
  path.getTangentAt(u, tangent)
  ship.position.copy(pos)
  ship.lookAt(pos.add(tangent))
}

// After moving control points, rebuild the table:
path.needsUpdate = true`,
    },
  ],
  mistakes: [
    "Driving motion with raw `t` and getting a speed-up through the middle of the curve.",
    "Changing control points and forgetting `curve.needsUpdate = true`, so `getPointAt` uses a stale table.",
    "Building the arc-length table every frame for a static curve.",
    "Joining curves with handles that are not collinear, leaving a visible kink.",
    "Normalizing a tangent where it is zero (a handle placed exactly on its endpoint). Fall back to the next control point.",
  ],
  reading: [
    {
      title: "Pomax — A Primer on Bézier Curves",
      url: "https://pomax.github.io/bezierinfo/",
    },
    {
      title: "Three.js docs — CubicBezierCurve3",
      url: "https://threejs.org/docs/#api/en/extras/curves/CubicBezierCurve3",
    },
    {
      title: "Three.js docs — Curve (getPointAt, arc length)",
      url: "https://threejs.org/docs/#api/en/extras/core/Curve",
    },
  ],
  visual:
    "The white line is the cubic curve; its four white control points drift slowly and the grey dashed line is the control polygon. The grey lines are the de Casteljau construction for the current t, ending at the grey ring (naive t) with its yellow dashed tangent. The solid yellow ball moves at constant speed using the arc-length table. Tick marks show equal-t or equal-distance spacing.",
}

export default sheet
