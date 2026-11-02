import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "inverse-kinematics",
  category: "animation",
  subcategory: "kinematics",
  title: "Inverse Kinematics",
  hook: "say where the hand goes; solve for the joint angles",
  summary:
    "Forward kinematics turns joint angles into a hand position; IK does the reverse. Solve two bones exactly with the law of cosines, longer chains with FABRIK.",
  level: "common",
  tags: ["ik", "fabrik", "skeleton", "two-bone", "pole vector", "animation"],
  updated: "2026-11-01",
  prompt:
    "Implement inverse kinematics in TypeScript for a Three.js skeleton. 1) twoBoneIK(root, mid, end, target, pole): bone lengths a, b come from the bind pose; clamp the target distance to [|a−b|+ε, a+b−ε]; get the root and mid joint angles from the law of cosines; orient the bend plane with the pole vector (root→target is one axis, the pole projected off it is the other); write world rotations back as local quaternions. 2) fabrik(joints, target, tolerance=1e-3, maxIterations=10): if the target is out of reach, straighten the chain toward it; otherwise alternate backward (tip→root) and forward (root→tip) passes that keep bone lengths, warm-starting from last frame's pose. Add per-joint hinge limits as an optional clamp after each pass. Tests: reachable targets are hit within 1e-6 by two-bone IK, unreachable ones give a straight arm, FABRIK preserves bone lengths and its error never grows between iterations.",
  related: [
    "trigonometry",
    "local-vs-world-space",
    "quaternions",
    "transforms-and-matrices",
    "vectors",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "**Forward kinematics (FK)** walks down a joint chain: each joint's rotation is applied on top of its parent's, and you read off where the hand ends up. It is what plays back authored animation. **Inverse kinematics (IK)** runs the other way: given where the hand (the **end effector**) should be, find joint rotations that put it there. Typical uses are feet planted on uneven ground, hands on ledges and weapons, heads looking at targets and procedural creature legs.",
    "For **two bones** (upper arm + forearm, thigh + shin) there is an exact solution. The base, elbow and target form a triangle with known sides `a`, `b` and the target distance `d`, so the **law of cosines** gives the elbow angle directly. A triangle can fold either way, so you also give a **pole vector**: a point the elbow (or knee) should bend toward.",
    "For **longer chains**, FABRIK (Forward And Backward Reaching IK) is the simplest robust solver. The backward pass pins the tip on the target and drags each joint toward its child, keeping bone lengths. The forward pass pins the root back on its base and drags back out. A handful of iterations usually lands within a millimetre, and you warm-start from last frame's pose.",
    "Plan for the edge cases. If the target is beyond the total length, straighten the chain toward it. If it is closer than `|a − b|`, the arm cannot fold that tight. Add **joint limits** (a knee only bends one way) by clamping each joint after a pass, and blend the IK result with the animated pose instead of snapping to it.",
  ],
  formulas: [
    {
      label: "Forward kinematics (2D chain)",
      math: tex`\vec p_{k} = \vec p_0 + \sum_{i=1}^{k} \ell_i \begin{pmatrix}\cos \Theta_i \\ \sin \Theta_i\end{pmatrix}, \quad \Theta_i = \sum_{j\le i}\theta_j`,
    },
    {
      label: "Two-bone elbow angle (law of cosines)",
      math: tex`\cos \theta_2 = \frac{d^2 - a^2 - b^2}{2ab}, \qquad d = \lvert \textcolor{#3ee09a}{\vec t} - \vec p_0 \rvert`,
      note: "Clamp d to [|a − b|, a + b] first, or acos receives a value outside [−1, 1].",
    },
    {
      label: "Two-bone shoulder angle",
      math: tex`\theta_1 = \operatorname{atan2}(t_y, t_x) - \operatorname{atan2}(b\sin\theta_2,\; a + b\cos\theta_2)`,
      note: "Negate θ₂ to bend the elbow to the other side; in 3D a pole vector chooses the bend plane.",
    },
    {
      label: "FABRIK joint update",
      math: tex`\vec p_i \leftarrow \vec p_{i+1} + \ell_i \,\frac{\vec p_i - \vec p_{i+1}}{\lvert \vec p_i - \vec p_{i+1}\rvert}`,
      note: "Backward pass shown (tip to root); the forward pass is the same with indices reversed.",
    },
  ],
  rules: [
    "Use two-bone IK for arms and legs: it is exact, needs no iterations and never drifts.",
    "FABRIK: tolerance about 1 mm (0.001 m) and 5–10 iterations per frame are enough when warm-started.",
    "Keep the target a little inside full reach (e.g. 99.9%). A perfectly straight limb makes the bend direction unstable.",
    "Place the pole vector well away from the root→target line (about one limb length), in front of knees and behind elbows.",
    "Blend IK with a 0–1 weight and ease it in over 0.1–0.2 s when a foot plants or a hand grabs.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Analytic two-bone IK in a plane (angles in radians):",
      code: `export function twoBoneIK(a: number, b: number, tx: number, ty: number, bend: 1 | -1 = 1) {
  const raw = Math.hypot(tx, ty)
  const d = Math.min(Math.max(raw, Math.abs(a - b) + 1e-6), a + b - 1e-6)
  const cosElbow = (d * d - a * a - b * b) / (2 * a * b)
  const elbow = bend * Math.acos(Math.min(1, Math.max(-1, cosElbow)))
  const shoulder =
    Math.atan2(ty, tx) - Math.atan2(b * Math.sin(elbow), a + b * Math.cos(elbow))
  return { shoulder, elbow, reached: raw <= a + b && raw >= Math.abs(a - b) }
}`,
    },
    {
      lang: "ts",
      caption: "FABRIK with Three.js vectors (joints[0] is the fixed root):",
      code: `export function fabrik(joints: THREE.Vector3[], lengths: number[], target: THREE.Vector3,
                       tol = 1e-3, maxIter = 10) {
  const n = joints.length, root = joints[0].clone()
  const total = lengths.reduce((s, l) => s + l, 0)
  if (root.distanceTo(target) >= total) {            // out of reach: straighten
    for (let i = 1; i < n; i++)
      joints[i].copy(joints[i - 1]).add(
        target.clone().sub(joints[i - 1]).setLength(lengths[i - 1]))
    return
  }
  for (let it = 0; it < maxIter && joints[n - 1].distanceTo(target) > tol; it++) {
    joints[n - 1].copy(target)                        // backward pass
    for (let i = n - 2; i >= 0; i--)
      joints[i].sub(joints[i + 1]).setLength(lengths[i]).add(joints[i + 1])
    joints[0].copy(root)                              // forward pass
    for (let i = 1; i < n; i++)
      joints[i].sub(joints[i - 1]).setLength(lengths[i - 1]).add(joints[i - 1])
  }
}`,
    },
  ],
  mistakes: [
    "Calling `acos` on an unclamped ratio. Targets out of reach give NaN and the limb vanishes.",
    "Solving in world space but writing the result straight into local bone rotations. Convert through the parent's world transform.",
    "No pole vector. The knee flips sideways whenever the target crosses the root→target axis.",
    "Running FABRIK from the bind pose every frame. Warm-start from last frame or the chain jitters between solutions.",
    "Snapping to the IK pose instantly when a foot lands. Blend the weight in.",
  ],
  reading: [
    {
      title: "Andreas Aristidou — FABRIK project page",
      url: "https://andreasaristidou.com/FABRIK",
    },
    {
      title: "Three.js docs — CCDIKSolver (IK addon)",
      url: "https://threejs.org/docs/#examples/en/animations/CCDIKSolver",
    },
  ],
  visual:
    "Left: the white two-bone arm solved analytically; the grey diamond is the pole it bends toward (flip it with the toggle). Right: the yellow ringed 4-bone chain solved with FABRIK. Each green ball is the target on its faint green orbit; it turns into a red wireframe when it leaves the grey dashed reach circle and the limb straightens toward it.",
}

export default sheet
