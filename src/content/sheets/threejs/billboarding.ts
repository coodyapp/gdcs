import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "billboarding",
  category: "threejs",
  subcategory: "rendering",
  title: "Billboarding",
  hook: "flat cards that always turn to face the camera",
  summary:
    "A billboard is a flat quad rotated every frame to face the camera, so a 2D image reads as 3D. Use full facing for sprites, Y-axis only for trees.",
  level: "common",
  tags: ["billboard", "sprite", "impostor", "particles", "quaternion"],
  updated: "2026-11-02",
  prompt:
    "Write a TypeScript Three.js `BillboardSystem` that keeps a set of quads facing the camera. Support two modes per quad: 'spherical' (copy the camera's world quaternion, converted into the quad parent's local space with the parent's inverse world quaternion) and 'cylindrical' (yaw only around world +Y using atan2 of the eye-to-quad vector on XZ, also converted for rotated parents). Update in one loop per frame with no allocations. Then add an alternative GPU path: an InstancedMesh with a vertex shader that builds the quad from the view matrix right/up vectors, with a uniform to switch to cylindrical (up = +Y). Include a test: with the camera directly above a cylindrical billboard it stays vertical, while a spherical one becomes horizontal.",
  related: ["level-of-detail", "particle-system", "quaternions"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A **billboard** is a textured quad whose rotation is overwritten each frame so its face points at the viewer. Two triangles stand in for something that would cost thousands: particles, grass, distant trees, health bars, lens flares, and the far level of a [level of detail](/threejs/rendering/level-of-detail) chain.",
    "**Spherical (full) billboards** copy the camera's rotation, so they are always screen-aligned, even when you look down on them. That suits particles, sprites and UI markers. `THREE.Sprite` does exactly this in its vertex shader. **Cylindrical (axis-aligned) billboards** only rotate around the world up axis, so they stay upright: right for trees, characters and anything that would look wrong tipping over when the camera rises.",
    "Copying the camera quaternion makes all billboards parallel to the screen plane. Pointing each one at the camera position instead (`lookAt`) is subtly different: quads near the screen edges turn toward the eye. Parallel is cheaper and avoids sorting artefacts in particles; point-at looks better for large, close quads.",
    "For thousands of billboards do it on the GPU: build the quad corners in the vertex shader from the camera's right and up vectors (rows of the view matrix), and draw everything as one instanced mesh or `Points`.",
  ],
  formulas: [
    {
      label: "Spherical corner",
      math: tex`\mathbf{p} = \mathbf{c} + x\,s\,\hat{R}_{cam} + y\,s\,\hat{U}_{cam}`,
      note: "c is the billboard centre, (x, y) the corner in ±0.5, s its size.",
    },
    {
      label: "Cylindrical yaw",
      math: tex`\textcolor{#fafafa}{\psi} = \operatorname{atan2}(e_x - c_x,\; e_z - c_z)`,
      note: "Rotate only around +Y by ψ; e is the eye position.",
    },
  ],
  rules: [
    "Particles, sprites, icons: spherical. Trees, grass, characters, signs: cylindrical.",
    "Cross two or three quads (an X or star) for vegetation seen from above; fade to a single billboard far away.",
    "Alpha-tested foliage (`alphaTest ≈ 0.5`) avoids sorting; true transparency needs back-to-front order.",
    "Size particles in world units for 3D feel, in pixels (`sizeAttenuation: false`) for UI markers.",
    "Billboard in the vertex shader once you pass about a thousand quads.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Spherical and cylindrical billboards on the CPU:",
      code: `const eye = new THREE.Vector3()
const pos = new THREE.Vector3()

function faceCamera(quads: THREE.Object3D[], camera: THREE.Camera, mode: "full" | "y") {
  camera.getWorldPosition(eye)
  for (const q of quads) {
    if (mode === "full") {
      // Parallel to the screen: same rotation as the camera.
      q.quaternion.copy(camera.quaternion) // assumes q's parent is unrotated
    } else {
      q.getWorldPosition(pos)
      q.rotation.set(0, Math.atan2(eye.x - pos.x, eye.z - pos.z), 0)
    }
  }
}`,
    },
    {
      lang: "glsl",
      caption: "GPU version: expand a point into a camera-facing quad.",
      code: `attribute vec2 corner;          // (-0.5..0.5) per vertex
uniform float uSize;
void main() {
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  // Cylindrical variant: up = vec3(0.0, 1.0, 0.0);
  vec3 center = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 world = center + (right * corner.x + up * corner.y) * uSize;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`,
    },
  ],
  mistakes: [
    "Using full billboards for trees, which then lean back when the camera flies over them.",
    "Copying the camera quaternion into a quad whose parent is rotated; convert to the parent's space first.",
    "Billboards that are close and large: their flatness shows when they intersect geometry. Use soft particles or real meshes up close.",
    "Unsorted transparent billboards popping in front of each other; alpha-test or sort.",
  ],
  reading: [
    {
      title: "Three.js docs — Sprite",
      url: "https://threejs.org/docs/#api/en/objects/Sprite",
    },
    {
      title: "Three.js docs — Points and PointsMaterial",
      url: "https://threejs.org/docs/#api/en/objects/Points",
    },
  ],
  visual:
    "Tree cards stand on a turning platform. A solid green tree is a card's front, a faded see-through red one its back; the thin white stick shows which way each card faces (its yaw ψ). With 'off' you see cards edge-on and from behind, 'Y-axis' keeps them upright and facing you, 'full' also tilts them toward the elevated camera. Raise the camera angle to exaggerate the difference.",
}

export default sheet
