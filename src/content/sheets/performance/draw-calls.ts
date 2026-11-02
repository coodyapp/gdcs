import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "draw-calls",
  category: "performance",
  subcategory: "gpu",
  title: "Draw Calls",
  hook: "draw a thousand things in one request",
  summary:
    "Each mesh costs the CPU a draw call plus state changes. Instancing and batching turn thousands of identical objects into one call; track renderer.info.",
  level: "core",
  tags: [
    "instancing",
    "batching",
    "InstancedMesh",
    "BatchedMesh",
    "cpu overhead",
  ],
  updated: "2026-11-02",
  prompt:
    "Refactor my TypeScript + Three.js scene to cut draw calls. Find meshes that share geometry and material and replace each group with a THREE.InstancedMesh (copy world matrices with setMatrixAt, per-instance colour with setColorAt). Group meshes that share a material but differ in geometry into a THREE.BatchedMesh. Keep a map from the old object ids to instance ids so gameplay code can still move or hide one item (hide by scaling its matrix to zero). Recompute bounding spheres after edits. Log renderer.info.render.calls before and after, and write a test that builds 500 identical meshes and asserts the converted scene renders them with one call.",
  related: ["texture-atlas", "overdraw", "frame-budget"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    'A **draw call** is one request from the CPU to the GPU: "draw this geometry with this shader and these settings". Before each one the engine and driver bind buffers, upload uniforms (the object\'s matrix, material values) and maybe switch shaders or textures. The GPU can draw a thousand triangles almost as fast as ten, so with many small objects the frame is limited by this **per-call CPU overhead**, not by triangle count.',
    "In Three.js every visible `Mesh` is at least one draw call (more with multi-material geometry or shadows, since each shadow-casting light renders casters again). Read `renderer.info.render.calls` after rendering to see the count. Under WebGL a few hundred calls per frame is comfortable on a laptop; several thousand will eat most of the [frame budget](/performance/cpu/frame-budget).",
    "**Instancing** (`THREE.InstancedMesh`) draws N copies of one geometry and material in a single call, with a per-instance matrix and optional colour. **Batching** (`THREE.BatchedMesh`) draws many *different* geometries that share a material in one call. Static scenery can also be merged into one geometry at load time. Sharing materials and packing textures into a [texture atlas](/performance/gpu/texture-atlas) is what makes batching possible.",
    "Fewer calls usually also means fewer state changes. When you can't merge, sort by shader and then material so consecutive calls reuse state, which is what Three.js does for opaque objects.",
  ],
  formulas: [
    {
      label: "CPU submission cost",
      math: tex`\textcolor{#f5d547}{T_{\text{cpu}}} \approx n_{\text{calls}} \cdot c_{\text{call}} + n_{\text{switches}} \cdot c_{\text{state}}`,
      note: "With c_call around 5–20 µs in WebGL, 1,000 separate meshes can cost several ms.",
    },
    {
      label: "Instancing",
      math: tex`n_{\text{calls}}: N \;\rightarrow\; 1`,
    },
  ],
  rules: [
    "Check `renderer.info.render.calls` (and `.triangles`) every time a scene gets slower.",
    "Aim for under ~200–500 draw calls per frame on web for mid-range hardware.",
    "Use `InstancedMesh` for 50+ copies of the same mesh (trees, rocks, bullets, crowd props).",
    "Use `BatchedMesh` or merged geometry when objects differ in shape but share a material.",
    "Set `instanceMatrix.needsUpdate = true` only on frames where instances moved, and call `computeBoundingSphere()` after large moves so culling stays correct.",
  ],
  code: [
    {
      lang: "ts",
      caption: "1,000 cubes in one draw call with `THREE.InstancedMesh`:",
      code: `const COUNT = 1000
const geometry = new THREE.BoxGeometry(0.4, 0.4, 0.4)
const material = new THREE.MeshStandardMaterial()
const cubes = new THREE.InstancedMesh(geometry, material, COUNT)
const m = new THREE.Matrix4()
const color = new THREE.Color()

for (let i = 0; i < COUNT; i++) {
  m.setPosition((i % 32) - 16, 0, Math.floor(i / 32) - 16)
  cubes.setMatrixAt(i, m)
  cubes.setColorAt(i, color.setHSL(i / COUNT, 0.6, 0.5))
}
cubes.instanceMatrix.needsUpdate = true
cubes.instanceColor!.needsUpdate = true
scene.add(cubes)

renderer.render(scene, camera)
console.log(renderer.info.render.calls) // 1 for the cubes, not 1000`,
    },
  ],
  mistakes: [
    "Creating a new material per object (even with identical settings), which defeats batching and multiplies state changes.",
    "Measuring triangles while ignoring call count, then simplifying meshes that were never the bottleneck.",
    "Forgetting `needsUpdate` after `setMatrixAt`, so instances don't move.",
    "Leaving the instanced mesh's bounding sphere at its initial value, so the whole batch gets frustum-culled when it shouldn't.",
    "Merging everything into one giant mesh, which then can't be culled or updated in parts. Group by region instead.",
  ],
  reading: [
    {
      title: "Three.js docs — InstancedMesh",
      url: "https://threejs.org/docs/#api/en/objects/InstancedMesh",
    },
    {
      title: "Three.js docs — BatchedMesh",
      url: "https://threejs.org/docs/#api/en/objects/BatchedMesh",
    },
    {
      title: "Three.js docs — WebGLRenderer.info",
      url: "https://threejs.org/docs/#api/en/renderers/WebGLRenderer.info",
    },
  ],
  visual:
    "A slow-motion view of the CPU submitting one frame. As separate meshes, each cube turns yellow when its own draw call is sent; as one InstancedMesh, the whole block turns white at once inside a single white outline (one call). The yellow bar is CPU time spent submitting. The default alternates between the two; raise the cube count to widen the gap.",
}

export default sheet
