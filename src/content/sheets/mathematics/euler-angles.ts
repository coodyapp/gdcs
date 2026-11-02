import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "euler-angles",
  category: "mathematics",
  subcategory: "transforms",
  title: "Euler Angles and Gimbal Lock",
  hook: "three turns in a row, and the order is part of the answer",
  summary:
    "Euler angles describe orientation as yaw, pitch and roll applied in a fixed order. Easy to edit, but pitch ±90° makes two axes line up: gimbal lock.",
  level: "common",
  tags: [
    "euler",
    "yaw pitch roll",
    "gimbal lock",
    "rotation order",
    "rotation",
  ],
  updated: "2026-11-01",
  prompt:
    "Build a first-person camera controller in TypeScript with Three.js. Keep yaw and pitch as two numbers, not as the camera's Euler. On pointer move: yaw -= dx * sensitivity, pitch -= dy * sensitivity, clamp pitch to ±89° (in radians), wrap yaw into (-π, π]. Each frame write camera.rotation.set(pitch, yaw, 0, 'YXZ') so yaw is around world Y and pitch around the camera's own X, with no roll. Expose `forward(out)` that returns the horizontal walking direction (ignore pitch) without allocating. Write Vitest tests: pitch never exceeds ±89°; with yaw = 90° the forward vector is (-1, 0, 0); the camera's up vector keeps y > 0 for every input.",
  related: [
    "quaternions",
    "transforms-and-matrices",
    "local-vs-world-space",
    "trigonometry",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Euler angles store an orientation as three angles around fixed axes: **yaw** (turn left/right, around up), **pitch** (nod up/down, around the side axis) and **roll** (tilt, around forward). They are easy to read, easy to type into an inspector, and map directly onto mouse-look and flight controls.",
    "Three numbers are not enough on their own: you also need the **order**. In Three.js, order `'XYZ'` means the matrix is `Rx·Ry·Rz`. Think of three nested rings (gimbals): X is the outer ring, Y sits inside it, Z is innermost and carries the object. The same three angles in order `'YXZ'` give a different orientation. For characters and FPS cameras, `'YXZ'` is the useful one: yaw outermost around world up, then pitch, then roll.",
    "**Gimbal lock** happens when the middle ring turns ±90°. The inner ring's axis then lines up with the outer ring's axis, so the first and last angles spin the object around the same line. One degree of freedom is gone: in that pose, no small change of the three angles can produce a turn about the missing axis. Interpolating Euler angles near that pose produces wild swings.",
    "Use Euler angles at the edges, for input and editing, and store or blend orientation as [quaternions](/mathematics/rotations/quaternions). For an FPS camera, clamp pitch to about ±89° and the lock never happens.",
  ],
  formulas: [
    {
      label: "Order 'YXZ' (yaw, pitch, roll)",
      math: tex`R = R_y(\textcolor{#05df72}{\psi})\;R_x(\textcolor{#ff6467}{\theta})\;R_z(\textcolor{#fafafa}{\phi})`,
      note: "Outer ring yaw ψ (green, Y), middle ring pitch θ (red, X), inner ring roll φ (white, Z): the axis colours in the visual.",
    },
    {
      label: "Single-axis rotation",
      math: tex`R_y(\psi) = \begin{bmatrix} \cos\psi & 0 & \sin\psi \\ 0 & 1 & 0 \\ -\sin\psi & 0 & \cos\psi \end{bmatrix}`,
    },
    {
      label: "Gimbal lock (order 'XYZ', middle = Y)",
      math: tex`R_x(a)\,R_y(\tfrac{\pi}{2})\,R_z(c) = R_x(a + c)\,R_y(\tfrac{\pi}{2})`,
      note: "Only a + c matters: two angles, one effect.",
    },
  ],
  rules: [
    "Clamp FPS pitch to ±89° (≈ ±1.553 rad), never exactly ±90°.",
    "Mouse-look: keep yaw and pitch as your own two numbers and rebuild the rotation each frame with order `'YXZ'`.",
    "Wrap yaw into (-180°, 180°] when you store it, and blend angles along the shortest arc.",
    "Setting `object.rotation.order` after the fact reinterprets the same numbers as a different orientation.",
    "Converting a matrix or quaternion back to Euler is not unique; expect jumps such as (180°, 0, 180°) vs (0, 180°, 0).",
  ],
  code: [
    {
      lang: "ts",
      caption: "FPS look with yaw/pitch kept separately, order `'YXZ'`:",
      code: `let yaw = 0
let pitch = 0
const LIMIT = THREE.MathUtils.degToRad(89)

function onPointerMove(e: PointerEvent, sensitivity = 0.002) {
  yaw -= e.movementX * sensitivity
  pitch -= e.movementY * sensitivity
  pitch = THREE.MathUtils.clamp(pitch, -LIMIT, LIMIT)
  yaw = THREE.MathUtils.euclideanModulo(yaw + Math.PI, Math.PI * 2) - Math.PI
}

function update() {
  // Yaw around world Y first, then pitch around the camera's own X.
  camera.rotation.set(pitch, yaw, 0, "YXZ")
}

// Blending orientations: convert to quaternions, never lerp the angles.
const q = new THREE.Quaternion().setFromEuler(camera.rotation)`,
    },
  ],
  mistakes: [
    "Leaving the default order `'XYZ'` on an FPS camera: pitch then tilts the horizon as you turn.",
    "Lerping Euler angles between two poses; near gimbal lock or across ±180° it spins the long way.",
    "Letting pitch reach ±90° and wondering why yaw now rolls the view.",
    "Assuming another engine uses the same order or sign: check, and convert through a quaternion or matrix.",
  ],
  reading: [
    {
      title: "Three.js docs — Euler",
      url: "https://threejs.org/docs/#api/en/math/Euler",
    },
    {
      title: "Three.js docs — Object3D.rotation",
      url: "https://threejs.org/docs/#api/en/core/Object3D.rotation",
    },
  ],
  visual:
    "Three nested gimbal rings, each coloured by the axis it turns around (X red, Y green, Z white); the outer ring is the first letter of the order. The yellow ship rides the inner ring. The outer and inner rings wobble while the middle ring holds the slider angle. The solid line is the outer axis and the dashed line the inner axis; at 90° they merge into one line and both wobbles turn the ship the same way.",
}

export default sheet
