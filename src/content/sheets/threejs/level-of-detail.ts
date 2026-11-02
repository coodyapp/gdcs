import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "level-of-detail",
  category: "threejs",
  subcategory: "rendering",
  title: "Level of Detail (LOD)",
  hook: "spend triangles only where the player can see them",
  summary:
    "LOD swaps a mesh for cheaper versions as it shrinks on screen, so far objects cost a fraction of near ones. Hysteresis stops the swaps flickering.",
  level: "common",
  tags: ["lod", "triangles", "optimization", "hysteresis", "impostor"],
  updated: "2026-11-02",
  prompt:
    "Build a TypeScript LOD manager for Three.js. Input: a list of { object, levels: Mesh[], switchAtPx: number[] } plus camera and renderer size. Every 4th frame, compute each object's projected bounding-sphere height in pixels (r / (d * tan(fov/2)) * H/2, using the camera's current fov so zoom is respected) and choose a level with 10% hysteresis so a level is only left once the size crosses the threshold by that margin. Toggle `visible` on level meshes only when the choice changes, never allocate per frame, and cull objects under 8 px. Write a Vitest test that a size oscillating ±5% around a threshold never changes level.",
  related: ["frustum-culling", "draw-calls", "billboarding"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A far-away object covers a handful of pixels, so drawing all of its triangles wastes vertex work and causes sub-pixel triangles that shade badly. **Level of detail** keeps several versions of a mesh (LOD0 full, LOD1 about half, LOD2 about a quarter, often a flat **impostor** last) and picks one per frame from the camera distance or projected screen size.",
    "`THREE.LOD` does the picking: add levels with `addLevel(mesh, distance)` and it shows the highest level whose distance the camera has passed, during `scene` update (`lod.autoUpdate`, on by default). Distances are in world units, so tune them against your field of view and resolution. Screen-size based selection, as many engines use, scales automatically with both.",
    "Without care, an object sitting right on a threshold pops back and forth every frame as the camera bobs. **Hysteresis** fixes that: the switch-back distance is a bit shorter than the switch-out distance, so a small wobble cannot toggle the level. In Three.js the third `addLevel` argument is that band as a fraction of the distance.",
    "LOD trims vertex cost and sub-pixel aliasing; it does nothing for [draw calls](/performance/gpu/draw-calls) unless far levels are also merged or instanced. Pair it with [frustum culling](/threejs/rendering/frustum-culling) so off-screen objects cost nothing at all.",
  ],
  formulas: [
    {
      label: "Projected size",
      math: tex`s_{px} = \frac{r}{\textcolor{#fdc700}{d}\,\tan(\tfrac{fov_y}{2})}\cdot \frac{H}{2}`,
      note: "Radius r at distance d, viewport height H. Halving it every level matches halving the triangle budget roughly every doubling of distance.",
    },
    {
      label: "Hysteresis band",
      math: tex`\text{enter } i \text{ at } \textcolor{#fdc700}{d} \ge D_i, \quad \text{leave } i \text{ at } \textcolor{#fdc700}{d} < D_i(1 - h)`,
    },
  ],
  rules: [
    "Triangle budget per level: roughly 100% → 50% → 25% → 10% (or an impostor).",
    "Switch when the object's on-screen height crosses about 300, 120 and 40 px; under ~10 px, cull it.",
    "Hysteresis of 5–15% of the threshold distance removes almost all popping.",
    "Keep silhouettes stable between levels; players notice outline changes far more than interior detail.",
    "Bake normal maps from LOD0 onto lower levels so shading survives the triangle loss.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Three levels with a 10% hysteresis band:",
      code: `const lod = new THREE.LOD()
const mat = new THREE.MeshStandardMaterial({ color: 0x8899aa })
const detail = [
  { geo: new THREE.IcosahedronGeometry(1, 4), distance: 0 },  // 5,120 tris
  { geo: new THREE.IcosahedronGeometry(1, 2), distance: 15 }, // 320 tris
  { geo: new THREE.IcosahedronGeometry(1, 0), distance: 40 }, // 20 tris
]
for (const { geo, distance } of detail) {
  lod.addLevel(new THREE.Mesh(geo, mat), distance, 0.1)
}
scene.add(lod) // updates itself during render (lod.autoUpdate = true)

// Which level is showing right now?
const level = lod.getCurrentLevel()`,
    },
    {
      lang: "pseudo",
      caption: "Engine-neutral selection with hysteresis:",
      code: `level = 0
for i in 1..levels.count-1:
    threshold = switchAt[i]
    if current == i: threshold *= (1 - hysteresis)  // sticky once entered
    if distance >= threshold: level = i else break
current = level`,
    },
  ],
  mistakes: [
    "Thresholds that are too close together, so the player sees every pop at normal walking speed.",
    "Ignoring FOV: zooming a sniper scope makes distant objects large but still draws LOD2.",
    "Low levels with different UVs or materials, causing a colour shift at the swap.",
    "Making every prop an LOD while the bottleneck is draw calls or fill rate, not vertices.",
    "Running LOD selection for thousands of objects each frame instead of every few frames or per cluster.",
  ],
  reading: [
    {
      title: "Three.js docs — LOD",
      url: "https://threejs.org/docs/#api/en/objects/LOD",
    },
    {
      title: "GPU Gems 2 — Terrain rendering using GPU-based geometry clipmaps",
      url: "https://developer.nvidia.com/gpugems/gpugems2/part-i-geometric-complexity/chapter-2-terrain-rendering-using-gpu-based-geometry-clipmaps",
    },
  ],
  visual:
    "The yellow cone is the viewer sliding back and forth past a field of spheres; its distance d picks each sphere's mesh: white and smooth is full detail, grey and faceted is medium, grey and blocky is the low version. Solid white rings mark the switch distances and dashed grey rings the hysteresis band; the solid white bar inside the grey wire box on the right is the total triangle count. Set hysteresis to 0 and slow the viewer to watch the boundary pop.",
}

export default sheet
