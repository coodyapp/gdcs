import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "squash-and-stretch",
  category: "game-feel",
  subcategory: "motion",
  title: "Squash and Stretch",
  hook: "deform along the motion, keep the volume constant",
  summary:
    "Stretch an object along its velocity and squash it on impact, scaling the other axes so volume stays constant. Motion reads as fast and elastic.",
  level: "common",
  tags: [
    "squash and stretch",
    "animation",
    "juice",
    "procedural animation",
    "scale",
  ],
  updated: "2026-11-02",
  prompt:
    "Add procedural squash and stretch to a bouncing Three.js object in TypeScript. Keep physics on the root and deform only a child mesh. Each frame: if speed > 0.001, rotate the child so local +Y points along the velocity and scale it (1/sqrt(s), s, 1/sqrt(s)) with s = min(1.6, 1 + 0.05 * speed). On a ground impact, squash along the contact normal to s = 1 - 0.35 * impactSpeed / maxImpactSpeed (min 0.6) and recover to 1 over 0.12 s with an exponential ease, keeping the bottom on the floor. Write a Vitest test that the product of the three scale factors is always 1 within 1e-9.",
  related: ["acceleration-and-friction", "easing", "screen-shake", "hit-stop"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Squash and stretch is one of the classic principles of animation. A fast-moving object is drawn longer along its direction of travel, and it flattens when it hits something. The eye reads this as speed, weight and elasticity, even on a plain sphere or cube.",
    "In a game it can be fully procedural. Each frame, point the object's local up axis along its velocity and scale that axis by `s = 1 + k·|v|` (clamped). Scale the two perpendicular axes by `1/√s` so the product of the three scales stays 1. **Preserving volume** is what makes it look like rubber rather than an object that grows and shrinks.",
    "On landing, switch to a squash along the contact normal (`s < 1`) and spring back over ~0.1 s. Keep the bottom of the object on the ground by offsetting its position by the scaled radius. Apply the deformation to a visual child node only, never to the collider or the physics body.",
  ],
  formulas: [
    {
      label: "Stretch along velocity",
      math: tex`s_{\parallel} = \min\!\left(s_{max},\; 1 + k\,\lVert \textcolor{#f5d547}{\mathbf{v}} \rVert\right)`,
    },
    {
      label: "Volume preservation (3D)",
      math: tex`s_{\parallel}\, s_{\perp}^2 = 1 \;\Rightarrow\; s_{\perp} = \frac{1}{\sqrt{s_{\parallel}}}`,
      note: "For a 2D sprite use s⊥ = 1 / s∥ instead.",
    },
  ],
  rules: [
    "Keep stretch under ~1.5–1.8× and impact squash above ~0.6× unless the style is very cartoony.",
    "Pick `k` so the stretch reaches its limit at your fastest common speed (e.g. falling at terminal velocity).",
    "Recover from a squash in 0.08–0.15 s. Ease it with a spring or `1 − e^(−k·t)` for a slight overshoot.",
    "Deform a child mesh, not the root, so the collider and children such as weapons stay unscaled.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Volume-preserving stretch toward the velocity in Three.js:",
      code: `const UP = new THREE.Vector3(0, 1, 0)
const dir = new THREE.Vector3()
const K = 0.05, MAX_STRETCH = 1.6

function applyStretch(visual: THREE.Object3D, velocity: THREE.Vector3) {
  const speed = velocity.length()
  if (speed < 1e-3) {
    visual.quaternion.identity()
    visual.scale.set(1, 1, 1)
    return
  }
  const along = Math.min(MAX_STRETCH, 1 + K * speed)
  const across = 1 / Math.sqrt(along) // along * across² = 1
  dir.copy(velocity).divideScalar(speed)
  visual.quaternion.setFromUnitVectors(UP, dir) // local Y → velocity
  visual.scale.set(across, along, across)
}`,
    },
  ],
  mistakes: [
    "Scaling only one axis, so the object visibly gains and loses mass.",
    "Scaling the physics body or collider and getting tunneling or jitter at contacts.",
    "Stretching in world Y regardless of direction, so a ball moving sideways looks wrong.",
    "Snapping between stretch and squash with no recovery time, which reads as flicker rather than elasticity.",
  ],
  reading: [
    {
      title: "Wikipedia — Squash and stretch",
      url: "https://en.wikipedia.org/wiki/Squash_and_stretch",
    },
    {
      title: "Wikipedia — Twelve basic principles of animation",
      url: "https://en.wikipedia.org/wiki/Twelve_basic_principles_of_animation",
    },
  ],
  visual:
    "The solid yellow ball stretches along its velocity (the dashed yellow arrow, longer when faster) as it falls and rises, and squashes flat for a moment after each bounce. The white wireframe is the undeformed ball for comparison. Turn off volume preservation to see it bloat, or set the amount to 0 for a rigid ball.",
}

export default sheet
