import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "quaternions",
  category: "mathematics",
  subcategory: "rotations",
  title: "Quaternions",
  hook: "four numbers that rotate without gimbal lock",
  summary:
    "A unit quaternion stores a 3D rotation as an axis and half-angle. It composes cheaply, never gimbal-locks and slerps along the shortest arc.",
  level: "core",
  tags: ["quaternion", "slerp", "rotation", "euler angles", "gimbal lock"],
  updated: "2026-11-02",
  prompt:
    "Write a TypeScript module of quaternion helpers on plain [x, y, z, w] tuples (no Three.js dependency): fromAxisAngle, fromEuler (XYZ order, matching Three.js), multiply, conjugate, rotateVector, normalize, angleBetween (2·acos|a·b|), slerp(a, b, t, shortest = true) that flips b when a·b < 0 and falls back to normalized lerp when a·b > 0.9995, and rotateTowards(a, b, maxAngle). Add Vitest tests: fromEuler equals THREE.Quaternion.setFromEuler for random angles; slerp returns unit quaternions and hits both endpoints; slerp at t = 0.5 is half the angle; slerping yaw 170° → -170° sweeps 20° while lerping the Euler angles sweeps 340°.",
  related: ["easing", "billboarding", "steering-behaviors", "quantization"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A rotation by angle `θ` around unit axis `â` is the quaternion `q = (â·sin(θ/2), cos(θ/2))`, four numbers `x, y, z, w` with length 1. Rotating a vector is `q v q⁻¹`, and applying rotation `a` then `b` is the product `b * a`. That's it: no trigonometry per frame, no matrix orthonormalization, no singular poses.",
    "**Euler angles** (pitch, yaw, roll) are fine for editing and for a first-person camera, but they are three rotations in a fixed order. When the middle one hits ±90° two axes line up and you lose a degree of freedom (**gimbal lock**). Interpolating them component-wise also goes the wrong way across the ±180° seam and wobbles through odd intermediate poses.",
    "**Slerp** (spherical linear interpolation) moves along the shortest great-circle arc between two orientations at constant angular speed, which is what turrets, cameras and animation blending want. `q` and `-q` describe the same rotation, so a correct slerp flips the sign of one input when their dot product is negative; otherwise it takes the 360°-minus-angle long way.",
    "In Three.js every `Object3D` keeps `quaternion` and `rotation` (Euler) in sync. Use `quaternion.slerp`, `rotateTowards` or `setFromUnitVectors` for gameplay, and keep Euler for UI sliders. See [easing](/mathematics/interpolation/easing) to shape the `t` you feed slerp.",
  ],
  formulas: [
    {
      label: "Axis–angle",
      math: tex`q = \left(\hat{a}\sin\tfrac{\theta}{2},\; \cos\tfrac{\theta}{2}\right), \quad \lVert q\rVert = 1`,
    },
    {
      label: "Rotate a vector",
      math: tex`v' = q\,v\,q^{*}, \quad q^{*} = (-x, -y, -z, w)`,
    },
    {
      label: "Slerp",
      math: tex`\textcolor{#fafafa}{\operatorname{slerp}(a, b, t)} = \frac{\sin((1-t)\Omega)}{\sin\Omega}a + \frac{\sin(t\Omega)}{\sin\Omega}\textcolor{#05df72}{b},\quad \cos\Omega = a\cdot b`,
      note: "If a·b < 0, negate b first. If Ω ≈ 0, normalized lerp is accurate and cheaper.",
    },
    {
      label: "Angle between orientations",
      math: tex`\theta = 2\arccos\lvert a \cdot b\rvert`,
    },
  ],
  rules: [
    "Order matters: `parent * child`, and `q2 * q1` means q1 first, then q2.",
    "Re-normalize after many multiplications (every frame for integrated rotations is cheap).",
    "Smooth follow: `q.slerp(target, 1 - Math.exp(-k * dt))` with k ≈ 5–15 is frame-rate independent.",
    "Max turn rate: `q.rotateTowards(target, maxRadPerSec * dt)`.",
    "Use nlerp (lerp + normalize) for small angles or many blends; it is close to slerp under ~30°.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Turret that turns toward a target at a capped speed:",
      code: `const look = new THREE.Matrix4()
const targetQ = new THREE.Quaternion()
const UP = new THREE.Vector3(0, 1, 0)

function aimTurret(turret: THREE.Object3D, targetPos: THREE.Vector3, dt: number) {
  // Orientation that faces the target (Object3D looks down +Z here).
  look.lookAt(targetPos, turret.position, UP)
  targetQ.setFromRotationMatrix(look)
  turret.quaternion.rotateTowards(targetQ, THREE.MathUtils.degToRad(120) * dt)
}

// Blend two poses halfway; slerp already takes the shortest arc.
const mid = new THREE.Quaternion().slerpQuaternions(poseA, poseB, 0.5)

// Rotate a vector by 90° around Y.
const q = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI / 2)
const v = new THREE.Vector3(1, 0, 0).applyQuaternion(q) // ≈ (0, 0, -1)`,
    },
  ],
  mistakes: [
    "Lerping Euler angles between 170° and -170°: the object spins 340° the wrong way.",
    "Writing your own slerp without the `dot < 0` sign flip.",
    "Editing `x, y, z, w` by hand as if they were angles; they are sines and cosines of half-angles.",
    "Multiplying in the wrong order and rotating around world axes instead of local ones.",
    "Letting a quaternion drift away from unit length after thousands of incremental updates.",
  ],
  reading: [
    {
      title: "Three.js docs — Quaternion",
      url: "https://threejs.org/docs/#api/en/math/Quaternion",
    },
    {
      title: "Scratchapixel — Geometry: rotations and transforms",
      url: "https://www.scratchapixel.com/lessons/mathematics-physics-for-computer-graphics/geometry/how-does-matrix-work-part-1.html",
    },
  ],
  visual:
    "Two arrows turn from the same start (white dot) to the same end b (green dot). The left yellow arrow lerps Euler angles and leaves a dashed trail; the right white arrow slerps quaternions and leaves a solid trail of where its nose went. The default crosses the ±180° yaw seam, so Euler takes the long way. Untick shortest arc to make slerp do the same.",
}

export default sheet
