import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "normals",
  category: "threejs",
  subcategory: "rendering",
  title: "Surface Normals",
  hook: "the unit arrow that says which way a surface faces",
  summary:
    "A normal is a unit vector perpendicular to a surface. Lighting, slope checks, bounces and decals all start from it, so it must be right.",
  level: "core",
  tags: ["normal", "lighting", "slope", "cross product", "shading"],
  updated: "2026-11-02",
  prompt:
    "In TypeScript with Three.js, write a `surfaceInfo(hit: THREE.Intersection, maxSlopeDeg = 45)` helper that returns the world-space unit normal (use the normal matrix of hit.object.matrixWorld, not matrixWorld itself), the slope angle in degrees, and `walkable = dot(n, up) >= cos(maxSlopeDeg)`. Handle hits with no face by returning null. Also write `faceNormal(a, b, c, out)` using the CCW cross product without allocating. Add a Vitest test: a triangle in the XZ plane wound CCW from above gives (0, 1, 0); a mesh scaled (1, 4, 1) still returns a unit normal perpendicular to the transformed surface; a 30° ramp is walkable and a 60° ramp is not.",
  related: ["raycasting", "fragment-shader", "z-fighting"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A **normal** is a unit vector pointing straight out of a surface. For a triangle `a, b, c` it is the normalized cross product of two edges, and the winding order (counter-clockwise in Three.js) decides which side is the front.",
    "A **face normal** is flat per triangle and gives faceted shading. A **vertex normal** averages the normals of the faces that share a vertex, so lighting interpolates smoothly across the mesh. `geometry.computeVertexNormals()` does the averaging for you, but only across vertices that are actually shared: a cube with split corners stays hard-edged, which is usually what you want.",
    "Gameplay leans on normals too. `dot(n, up)` is the cosine of the slope angle, so one dot product tells you whether ground is walkable. Reflection and bounce directions, decal orientation, sliding along walls and the hit normal from [raycasting](/threejs/rendering/raycasting) all use the same vector.",
    "Normals live in object space inside the geometry. Rotating or **non-uniformly scaling** a mesh changes them, so convert with the normal matrix (the inverse transpose of the model matrix), not the model matrix itself.",
  ],
  formulas: [
    {
      label: "Face normal",
      math: tex`\textcolor{#3ee09a}{\hat{n}} = \frac{(b - a)\times(c - a)}{\lVert (b - a)\times(c - a)\rVert}`,
      note: "Swapping b and c flips the normal. That is what back-face culling reads.",
    },
    {
      label: "Slope angle",
      math: tex`\theta = \arccos(\textcolor{#3ee09a}{\hat{n}}\cdot\hat{u}), \quad \text{walkable if } \textcolor{#3ee09a}{\hat{n}}\cdot\hat{u} \ge \cos\theta_{max}`,
    },
    {
      label: "Normal matrix",
      math: tex`N = \left(M^{-1}\right)^{\mathsf{T}}_{3\times 3}`,
      note: "Equals the rotation part of M only when the scale is uniform.",
    },
    {
      label: "Reflection",
      math: tex`\vec{r} = \vec{d} - 2(\vec{d}\cdot\hat{n})\,\hat{n}`,
    },
  ],
  rules: [
    "Max walkable slope 45° → `dot(n, up) ≥ 0.707`; 50° → 0.643; 60° → 0.5.",
    "Re-normalize after interpolating or transforming. Lerped unit vectors get shorter.",
    "Hard edge = duplicated vertices with different normals. Smooth edge = one shared vertex.",
    "Smoothing groups / auto-smooth angle around 30–60° keeps bevels smooth and box corners crisp.",
    "If a mesh looks inside-out or black, check winding first, then `material.side`.",
  ],
  code: [
    {
      lang: "ts",
      caption:
        "Face normal of a triangle and a world-space normal from a raycast:",
      code: `const ab = new THREE.Vector3()
const ac = new THREE.Vector3()
function faceNormal(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, out: THREE.Vector3) {
  ab.subVectors(b, a)
  ac.subVectors(c, a)
  return out.crossVectors(ab, ac).normalize()
}

const normalMatrix = new THREE.Matrix3()
const worldNormal = new THREE.Vector3()
function hitNormal(hit: THREE.Intersection) {
  normalMatrix.getNormalMatrix(hit.object.matrixWorld)
  return worldNormal.copy(hit.face!.normal).applyMatrix3(normalMatrix).normalize()
}

const MAX_SLOPE_COS = Math.cos(THREE.MathUtils.degToRad(45))
const isWalkable = (n: THREE.Vector3) => n.y >= MAX_SLOPE_COS // dot(n, up) with up = +Y`,
    },
    {
      lang: "glsl",
      caption: "Vertex shader: carry the normal to view space correctly.",
      code: `// Three.js provides normalMatrix = inverse transpose of modelViewMatrix (3x3)
varying vec3 vNormal;
void main() {
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
// Fragment: normalize(vNormal) again, interpolation shortens it.`,
    },
  ],
  mistakes: [
    "Transforming normals with the model matrix on a non-uniformly scaled mesh. They tilt and lighting goes wrong.",
    "Calling `computeVertexNormals()` on a geometry with split vertices and expecting smooth shading (or on a welded cube and getting blobby lighting).",
    "Forgetting to normalize after interpolation, so `dot(n, up)` reads lower than the true cosine.",
    "Treating `face.normal` from a Three.js raycast as world space. It is object space.",
    "Inconsistent winding from an exporter, leaving half the triangles facing inward.",
  ],
  reading: [
    {
      title: "Three.js docs — BufferGeometry.computeVertexNormals",
      url: "https://threejs.org/docs/#api/en/core/BufferGeometry.computeVertexNormals",
    },
    {
      title: "Scratchapixel — Transforming normals",
      url: "https://www.scratchapixel.com/lessons/mathematics-physics-for-computer-graphics/geometry/transforming-normals.html",
    },
  ],
  visual:
    "A rolling heightfield with normal arrows sampled across it. Triangles stay grey where dot(n, up) passes the walkable limit and turn red where they are too steep; solid green arrows are the per-face normals and dashed grey arrows the smoothed vertex normals. Lower the max slope to see more ground turn red.",
}

export default sheet
