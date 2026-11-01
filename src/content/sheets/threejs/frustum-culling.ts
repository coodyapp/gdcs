import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "frustum-culling",
  category: "threejs",
  subcategory: "rendering",
  title: "Frustum Culling",
  hook: "don't draw what the camera can't see",
  summary:
    "Frustum culling skips objects whose bounding volume lies fully outside the camera's six view planes, before any draw call is made.",
  level: "core",
  tags: ["culling", "frustum", "bounding sphere", "visibility", "optimization"],
  updated: "2026-11-01",
  prompt:
    "Write a TypeScript Three.js module that culls a list of game entities each frame. Build a THREE.Frustum from camera.projectionMatrix × camera.matrixWorldInverse after calling camera.updateMatrixWorld(). For each entity, transform its geometry's bounding sphere (computed once and padded by an optional `padding` value) into world space and test it; set `entity.mesh.visible` and an `entity.onScreen` flag that game code can use to throttle updates. No allocations per frame. Edge cases: objects straddling a plane count as visible; the camera inside an object's sphere counts as visible. Include a Vitest test with a camera at the origin looking down -Z: a sphere at (0,0,-5) is visible, one at (0,0,5) is culled, one at (100,0,-5) is culled.",
  related: ["level-of-detail", "draw-calls", "spatial-partitioning"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A perspective camera sees a truncated pyramid, the **view frustum**, bounded by six planes: near, far, left, right, top and bottom. Anything entirely outside it cannot reach a pixel, so the CPU can drop it before sending a [draw call](/performance/gpu/draw-calls).",
    "The test is cheap because it uses a bounding volume, not the mesh. For a **bounding sphere**, compute the signed distance from its centre to each plane; if any distance is below `-r`, the sphere is fully outside and the object is culled. Spheres can report false positives near the frustum corners, which is fine: drawing one extra object is harmless, skipping a visible one is a bug.",
    "Three.js does this automatically for every object with `frustumCulled = true` (the default), using `geometry.boundingSphere`. It is computed once from the original vertices, so if you move vertices in a shader, skin a mesh, or use `InstancedMesh` spread over a large area, the sphere is wrong and objects vanish at screen edges.",
    "Frustum culling does not handle objects hidden **behind** other objects; that is occlusion culling. With thousands of objects, test a hierarchy (BVH, octree, grid cells, see [spatial partitioning](/performance/world/spatial-partitioning)) so a single test rejects a whole region.",
  ],
  formulas: [
    {
      label: "Plane distance",
      math: tex`d_i = \hat{n}_i \cdot \mathbf{c} + w_i`,
      note: "Plane i stored as (n, w) with n pointing into the frustum.",
    },
    {
      label: "Sphere test",
      math: tex`\text{culled} \iff \exists\, i \in 1..6 : d_i < -r`,
    },
    {
      label: "Planes from the matrix",
      math: tex`M = P\,V, \quad \text{left} = M_{row4} + M_{row1}, \;\; \text{right} = M_{row4} - M_{row1}`,
      note: "Same pattern for rows 2 (bottom/top) and 3 (near/far). Normalize each plane afterwards.",
    },
  ],
  rules: [
    "Test bounding spheres first (6 dot products); refine with AABBs only for long, thin objects.",
    "Keep `far` as small as the game allows; it is both a culling plane and a depth-precision setting.",
    "Pad bounds of animated or vertex-displaced meshes by the maximum displacement.",
    "Shadow-casting lights need their own frustum; an object off screen can still cast a visible shadow.",
    "Cull by cluster or grid cell when object counts exceed a few thousand.",
  ],
  code: [
    {
      lang: "ts",
      caption:
        "Manual frustum test, e.g. to pause AI or audio for off-screen objects:",
      code: `const frustum = new THREE.Frustum()
const viewProj = new THREE.Matrix4()
const sphere = new THREE.Sphere()

function updateFrustum(camera: THREE.Camera) {
  camera.updateMatrixWorld()
  viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  frustum.setFromProjectionMatrix(viewProj)
}

function isOnScreen(mesh: THREE.Mesh) {
  const geo = mesh.geometry
  if (!geo.boundingSphere) geo.computeBoundingSphere()
  sphere.copy(geo.boundingSphere!).applyMatrix4(mesh.matrixWorld)
  return frustum.intersectsSphere(sphere)
}

// Vertex-displaced mesh: grow the sphere instead of disabling culling.
waterMesh.geometry.computeBoundingSphere()
waterMesh.geometry.boundingSphere!.radius += maxWaveHeight`,
    },
  ],
  mistakes: [
    "Setting `frustumCulled = false` on everything to fix a popping mesh instead of fixing its bounds.",
    "Forgetting `computeBoundingSphere()` after editing a geometry's positions, so the old bounds cull it.",
    "Culling against a stale camera: update matrices before building the frustum.",
    "Assuming culled objects are free. Their scripts, animation and physics still run unless you gate them too.",
    "Expecting frustum culling to remove objects hidden behind a wall (that needs occlusion culling).",
  ],
  reading: [
    {
      title: "Three.js docs — Frustum",
      url: "https://threejs.org/docs/#api/en/math/Frustum",
    },
    {
      title: "MDN — WebGL model, view, projection",
      url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_model_view_projection",
    },
  ],
  visual:
    "A top-down view of a game camera (orange) and its frustum wedge. Objects whose bounding sphere touches the wedge are drawn in cyan; the faded grey ones are culled and would cost no draw call. Narrow the field of view or shorten the far plane to cull more; turn off sweep to read the exact count.",
}

export default sheet
