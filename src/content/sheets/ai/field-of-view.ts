import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "field-of-view",
  category: "ai",
  subcategory: "perception",
  title: "Field of View (Vision Cone)",
  hook: "close enough, in front enough, and nothing in the way",
  summary:
    "A guard sees a target when it is within the view radius, within half the view angle of its forward vector, and a line-of-sight ray reaches it.",
  level: "core",
  tags: [
    "vision cone",
    "line of sight",
    "stealth",
    "perception",
    "dot product",
  ],
  updated: "2026-11-02",
  prompt:
    "Write a TypeScript `canSee(guard, target, walls)` for a Three.js stealth game on the XZ plane. Guard has position, unit forward vector, viewRadius and viewAngle in degrees; precompute cosHalf = cos(viewAngle/2) whenever the angle changes. Test in this order: squared distance > viewRadius² → false; dot(forward, normalize(target − guard)) < cosHalf → false (no acos); then raycast from the guard's eye height toward the target with THREE.Raycaster, far = distance − 0.01, against an explicit `walls` array only, so the target's own mesh never blocks. Return { seen, blockedAt?: Vector3 }. Handle a target on the guard's position (seen) and viewAngle ≥ 360 (skip the angle test). Reuse vectors (no per-call allocation). Write Vitest tests: boundary angle and radius count as seen, 1° past the edge is not, behind is not, and a wall between them blocks.",
  related: [
    "field-of-view-visualization",
    "stencil-shader",
    "raycasting",
    "dot-and-cross-product",
    "steering-behaviors",
    "finite-state-machine",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A vision cone answers one question per target: **can this agent see it right now?** Three cheap tests, in order: is the target within the **view radius**, is it within **half the view angle** of the agent's forward direction, and does a **line-of-sight** ray reach it without hitting a wall. Fail any one and the target is unseen.",
    "The angle test does not need angles. Normalize the vector to the target and take its [dot product](/mathematics/vectors/dot-and-cross-product) with the unit forward vector: that is the cosine of the angle between them. Compare it with `cos(viewAngle / 2)`, computed once. Larger dot means more in front, so the test is `dot ≥ cosHalf`, with no `acos` per target.",
    "Run the [raycast](/threejs/rendering/raycasting) last because it is the expensive part, and only against occluders (walls, crates), never against the target or the guard. Cast from eye height, stop just short of the target, and treat any hit as blocked. The result usually feeds a [state machine](/ai/decision/finite-state-machine): patrol → suspicious → chase.",
  ],
  formulas: [
    {
      label: "In range",
      math: tex`\lVert T - P \rVert^2 \le \textcolor{#fafafa}{r}^2`,
      note: "Compare squared lengths to skip a square root.",
    },
    {
      label: "In the cone",
      math: tex`\hat{f}\cdot\frac{T-P}{\lVert T-P\rVert} \;\ge\; \cos\tfrac{\textcolor{#fafafa}{\theta}}{2}`,
      note: "θ is the full view angle. A 90° cone gives cos 45° ≈ 0.707.",
    },
    {
      label: "Seen",
      math: tex`\textcolor{#3ee09a}{\text{seen}} = \text{range} \land \text{cone} \land \lnot\,\textcolor{#f65a5a}{\text{blocked}}`,
    },
  ],
  rules: [
    "Typical guard: view angle 90–120°, radius 8–15 m; peripheral cones of 180° at a shorter radius catch movement.",
    "Cache `cosHalf` when the angle changes; for θ ≥ 360° skip the angle test entirely.",
    "Cast line of sight from eye height (≈ 1.6 m) to the target's chest, not feet to feet, or low props block everything.",
    "Check perception at 5–10 Hz per guard, staggered across frames; players cannot tell the difference from 60 Hz.",
    "Add a short memory (0.5–2 s) so a target briefly behind a pillar is not instantly forgotten.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Range → cone → line of sight, cheapest test first:",
      code: `const toTarget = new THREE.Vector3()
const ray = new THREE.Raycaster()

function canSee(guard: Guard, target: THREE.Vector3, walls: THREE.Object3D[]) {
  toTarget.subVectors(target, guard.eye)
  const d2 = toTarget.lengthSq()
  if (d2 > guard.viewRadius ** 2) return false          // too far
  if (d2 < 1e-8) return true                            // on top of us
  const dist = Math.sqrt(d2)
  toTarget.divideScalar(dist)                           // unit direction
  if (guard.forward.dot(toTarget) < guard.cosHalf) return false // outside cone

  ray.set(guard.eye, toTarget)
  ray.far = dist - 0.01                                 // stop before the target
  return ray.intersectObjects(walls, false).length === 0
}

// When the designer changes the angle:
guard.cosHalf = Math.cos(THREE.MathUtils.degToRad(guard.viewAngle) / 2)`,
    },
  ],
  mistakes: [
    "Comparing the dot product with the full angle's cosine instead of half of it, which doubles the cone.",
    "Forgetting to normalize the direction to the target, so the dot grows with distance and far targets look 'more in front'.",
    "Raycasting against everything, so the ray hits the target's own collider (or the guard's) and reports blocked.",
    "Running acos and degree conversions for every target every frame instead of one cached cosine.",
    "Testing from the guard's feet: a knee-high crate then hides a standing player.",
  ],
  reading: [
    {
      title: "Sebastian Lague — Field of View (Unity project)",
      url: "https://github.com/SebLague/Field-of-View",
    },
    {
      title: "Three.js docs — Raycaster",
      url: "https://threejs.org/docs/#api/en/core/Raycaster",
    },
    {
      title: "Three.js docs — Vector3.dot",
      url: "https://threejs.org/docs/#api/en/math/Vector3.dot",
    },
  ],
  visual:
    "Top-down: the white ball with the white arrow is the guard and the white outline is its cone. Solid green balls with a green line are seen; solid grey balls are inside the cone but hidden, with a solid red ray ending in a red dot on the blocking wall; dim grey wireframe balls are outside the cone. Change the view angle and radius, or turn obstacles off to see occlusion disappear.",
}

export default sheet
