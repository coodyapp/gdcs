import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "tunneling",
  category: "systems",
  subcategory: "collision",
  title: "Tunneling & Continuous Collision",
  hook: "fast objects skip over thin walls between two ticks",
  summary:
    "A fast object can be on one side of a thin wall at one tick and past it at the next. Swept tests (CCD) check the whole path between positions.",
  level: "core",
  tags: ["ccd", "swept", "collision", "bullets", "physics"],
  updated: "2026-11-02",
  prompt:
    "Add continuous collision for fast projectiles in a TypeScript Three.js game. Write `sweptSphereAabb(p0, p1, r, min, max): number | null` (slab method, box expanded by r, returns entry t in [0,1], 0 if starting inside) and `sweptSphereSphere(p0, p1, r, c, R)` (quadratic, earliest root, null if moving away). In the fixed-step bullet update, compute next = pos + vel*dt, find the earliest t across nearby colliders, place the bullet at the contact point minus a 0.005 skin and fire onHit. Write Vitest tests: a 0.05-radius bullet at 60 u/s with 1/60 s ticks against a 0.1-thick wall is missed by a discrete overlap test but caught by the swept test at the correct x; parallel segments outside the slab return null.",
  related: [
    "raycasting",
    "hitbox-hurtbox",
    "fixed-timestep",
    "collision-detection",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Discrete collision checks for overlap only at the positions where objects end each tick. If an object moves farther per tick than the wall is thick plus its own size, both samples can miss the wall and the object **tunnels** through. Bullets, fast balls, dashing characters and thin floors are the classic cases.",
    "**Continuous collision detection (CCD)** checks the motion between ticks instead. For a sphere moving from `p0` to `p1`, a swept test returns the earliest time of impact `t ∈ [0, 1]`: cast the segment against the obstacle grown by the radius (a Minkowski sum). Against a box, that is a [raycast](/threejs/rendering/raycasting) against a box expanded by `r`, solved with the slab method.",
    "Engines offer CCD per body (Box2D's `bullet` flag, Rapier's `ccdEnabled`, Unity's continuous mode) because it costs more. Turn it on only for small, fast bodies. Cheaper alternatives are **substepping** (several smaller steps per tick), thicker colliders, a maximum speed, or treating bullets as **hitscan** rays when travel time doesn't matter.",
  ],
  formulas: [
    {
      label: "Tunneling risk",
      math: tex`\textcolor{#fdc700}{v\,\Delta t} > w + 2r`,
      note: "Distance per tick exceeds wall thickness w plus the object's diameter. 60 u/s at 60 Hz moves 1 u per tick.",
    },
    {
      label: "Swept segment vs slab (one axis)",
      math: tex`t_{0,1} = \frac{(\text{min}-r) - p_0}{d},\ \frac{(\text{max}+r) - p_0}{d}, \quad t_{\text{hit}} = \max_{\text{axes}} t_{\text{enter}}`,
      note: "Hit if max(enter) ≤ min(exit) and 0 ≤ t_hit ≤ 1.",
    },
    {
      label: "Substeps needed",
      math: tex`n = \left\lceil \frac{\textcolor{#fdc700}{v\,\Delta t}}{\tfrac12 (w + 2r)} \right\rceil`,
    },
  ],
  rules: [
    "Keep per-tick travel below about half the thinnest collider's thickness, or enable CCD for that body.",
    "Hitscan anything faster than about 100 u/s with a short flight time, and simulate the slower projectiles (rockets, arrows).",
    "Make walls at least about 0.2 u thick even when they look thin. Collider thickness doesn't have to match the visible mesh.",
    "After a swept hit, move the body to `p0 + t·(p1 − p0)` minus a small skin (about 0.001–0.01 u) so it doesn't start the next tick inside the wall.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Swept sphere vs box via the slab method:",
      code: `// Returns entry time t in [0,1] or null. Box grown by radius r.
function sweptSphereAabb(p0: V3, p1: V3, r: number, min: V3, max: V3) {
  let tIn = 0, tOut = 1
  for (const k of ["x", "y", "z"] as const) {
    const d = p1[k] - p0[k]
    const lo = min[k] - r, hi = max[k] + r
    if (Math.abs(d) < 1e-12) {
      if (p0[k] < lo || p0[k] > hi) return null
      continue
    }
    let t0 = (lo - p0[k]) / d, t1 = (hi - p0[k]) / d
    if (t0 > t1) [t0, t1] = [t1, t0]
    tIn = Math.max(tIn, t0)
    tOut = Math.min(tOut, t1)
    if (tIn > tOut) return null
  }
  return tIn
}`,
    },
    {
      lang: "pseudo",
      caption: "Per-tick bullet update:",
      code: `next = pos + vel * dt
t = sweptTest(pos, next, radius, world)
if t != null: pos = lerp(pos, next, t); onHit()
else:         pos = next`,
    },
  ],
  mistakes: [
    "Testing only `overlap(next)`. It works at walking speed and fails silently once speed upgrades land.",
    "Using a bigger timestep on low-end devices without adjusting CCD, so tunneling appears only on slow machines.",
    "Ignoring the radius: casting the centre as a thin ray lets grazing shots slip past corners.",
    "Turning CCD on for every body and then wondering where the frame time went.",
  ],
  reading: [
    {
      title: "Box2D documentation — Simulation (continuous collision)",
      url: "https://box2d.org/documentation/md_simulation.html",
    },
    {
      title: "Three.js docs — Ray.intersectBox",
      url: "https://threejs.org/docs/#api/en/math/Ray",
    },
  ],
  visual:
    "Two yellow bullets fire at the same speed at a thin wall. The gray dots behind each one are the positions it was actually tested at, one per physics tick. The top lane tests only those dots, so it lands on both sides of the wall and passes through, turning red with no spark. The bottom lane also tests the solid yellow line between them and stops at the wall, turning green with a wireframe spark. Lower the speed or raise the tick rate until both lanes hit.",
}

export default sheet
