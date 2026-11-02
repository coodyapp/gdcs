import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "transforms-and-matrices",
  category: "mathematics",
  subcategory: "transforms",
  title: "Transforms and Matrices",
  hook: "pack move, turn and resize into one multiply",
  summary:
    "A 4×4 matrix stores translation, rotation and scale in one object. Multiply to combine transforms, invert to undo them, and mind the order.",
  level: "core",
  tags: ["matrix", "matrix4", "TRS", "transform", "homogeneous coordinates"],
  updated: "2026-11-01",
  prompt:
    "Write `src/lib/mat4.ts` in TypeScript with column-major 4×4 matrices stored as number[16] (same layout as THREE.Matrix4.elements): identity, translation(x,y,z), rotationX/Y/Z(rad), scaling(x,y,z), multiply(a,b) where b is applied first, invert(m) returning null when |det| < 1e-12, transformPoint (w = 1) and transformDirection (w = 0). Add composeTRS(position, quaternion, scale) that matches THREE.Matrix4.compose. Write Vitest tests: T·R·S and R·T·S give different results for a 90° Y rotation; invert(m)·m equals identity within 1e-6 for a random TRS; transformDirection ignores translation; composeTRS matches Three.js element by element. No Three.js imports in the library itself.",
  related: [
    "local-vs-world-space",
    "euler-angles",
    "quaternions",
    "vectors",
    "dot-and-cross-product",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Every object in a 3D scene has a **transform**: where it is (translation **T**), how it is turned (rotation **R**) and how big it is (scale **S**). A 4×4 matrix can hold all three, so moving a vertex from model space into the world is one matrix–vector multiply, and a chain of transforms collapses into one matrix.",
    "The 4th row and column exist because translation is not linear in 3D. Writing a point as `(x, y, z, 1)` (homogeneous coordinates) lets the last column add the offset. Directions use `w = 0`, so they rotate and scale but never move. That is why normals and velocities must not pick up an object's position.",
    "**Order matters.** With column vectors (Three.js, OpenGL, most maths texts) the rightmost matrix acts first. `T·R·S` scales the mesh, spins it in place, then moves it: the usual object transform. `R·T·S` moves it first and then spins the whole offset around the origin, so the object orbits instead. Matrix multiplication is not commutative.",
    "In Three.js each `Object3D` keeps `position`, `quaternion` and `scale`, and builds `matrix = T·R·S` from them. `matrixWorld = parent.matrixWorld · matrix` is refreshed by `updateMatrixWorld()`, which the renderer calls once per frame. See [local vs world space](/mathematics/transforms/local-vs-world-space) for the hierarchy.",
  ],
  formulas: [
    {
      label: "Object transform (rightmost first)",
      math: tex`M = \textcolor{#fafafa}{T\,R\,S}, \qquad \textcolor{#a3a3a3}{R\,T\,S} \ne T\,R\,S`,
      note: "White is the object built with T·R·S; the grey outline is the same pieces multiplied as R·T·S.",
    },
    {
      label: "Homogeneous point and direction",
      math: tex`\begin{bmatrix} R S & t \\ 0 & 1 \end{bmatrix}\begin{bmatrix} p \\ 1 \end{bmatrix} = RSp + t, \qquad \begin{bmatrix} R S & t \\ 0 & 1 \end{bmatrix}\begin{bmatrix} d \\ 0 \end{bmatrix} = RSd`,
    },
    {
      label: "Inverse of a TRS",
      math: tex`(T R S)^{-1} = S^{-1} R^{\mathsf{T}} T^{-1}, \qquad M^{-1} M = I`,
      note: "Reverse the order and invert each piece. A pure rotation inverts by transposing.",
    },
    {
      label: "Normal matrix",
      math: tex`N = \left(M_{3\times3}^{-1}\right)^{\mathsf{T}}`,
      note: "Needed for normals when the scale is non-uniform.",
    },
  ],
  rules: [
    "Read a product right to left: `A·B·p` applies B, then A.",
    "Three.js `a.multiply(b)` is `a = a·b`; `a.premultiply(b)` is `a = b·a`.",
    "If you set `object.matrix` yourself, set `matrixAutoUpdate = false` or Three.js overwrites it from position/quaternion/scale.",
    "Call `updateMatrixWorld()` before reading `matrixWorld` in the same frame you moved something.",
    "Keep scales uniform where you can; non-uniform scale under a rotated child creates shear that cannot be decomposed back into TRS.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Build, combine and invert transforms with `THREE.Matrix4`:",
      code: `const T = new THREE.Matrix4().makeTranslation(3, 0, 0)
const R = new THREE.Matrix4().makeRotationY(Math.PI / 2)
const S = new THREE.Matrix4().makeScale(2, 2, 2)

// T·R·S: scale, then rotate in place, then move. (Rightmost first.)
const trs = new THREE.Matrix4().multiplyMatrices(T, R).multiply(S)
// R·T·S: move first, then rotate the offset → the object orbits.
const rts = new THREE.Matrix4().multiplyMatrices(R, T).multiply(S)

const p = new THREE.Vector3(0, 0, 0)
p.clone().applyMatrix4(trs) // (3, 0, 0)
p.clone().applyMatrix4(rts) // (0, 0, -3)

// Same as T·R·S, from parts:
const m = new THREE.Matrix4().compose(position, quaternion, scale)

// Undo: world point back into the object's space.
const inv = trs.clone().invert()
const local = worldPoint.clone().applyMatrix4(inv)

// Directions ignore translation (w = 0).
const dir = new THREE.Vector3(1, 0, 0).transformDirection(trs)`,
    },
  ],
  mistakes: [
    "Multiplying in the wrong order and getting orbiting instead of spinning (or vice versa).",
    "Transforming a direction or normal with `applyMatrix4`, which adds the translation. Use `transformDirection` or the normal matrix.",
    "Reading `matrixWorld` right after moving a parent, before `updateMatrixWorld()` has run.",
    "Writing to `object.matrix` while `matrixAutoUpdate` is still true; your values vanish next frame.",
    "Inverting a matrix every frame when you only need the transpose of a pure rotation.",
  ],
  reading: [
    {
      title: "Three.js docs — Matrix4",
      url: "https://threejs.org/docs/#api/en/math/Matrix4",
    },
    {
      title: "Three.js manual — Matrix transformations",
      url: "https://threejs.org/manual/#en/matrix-transformations",
    },
    {
      title: "Scratchapixel — Geometry: matrices",
      url: "https://www.scratchapixel.com/lessons/mathematics-physics-for-computer-graphics/geometry/matrices.html",
    },
  ],
  visual:
    "The solid white ship uses the order you pick; the grey wireframe ghost uses the other order with the same T, R and S. The short axis lines at the origin are world X (red) and Z (white). Rotate with a non-zero translation and watch R·T·S swing the ship around the origin while T·R·S only turns it in place.",
}

export default sheet
