import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "z-fighting",
  category: "threejs",
  subcategory: "rendering",
  title: "Z-Fighting",
  hook: "two surfaces, one depth value, endless flicker",
  summary:
    "Z-fighting is the shimmering stripes you get when two surfaces are closer than the depth buffer can resolve. Fix the geometry, the near plane or the bias.",
  level: "core",
  tags: ["depth buffer", "precision", "polygon offset", "near plane", "decals"],
  updated: "2026-11-02",
  prompt:
    "In a TypeScript Three.js project, add a `DecalLayer` helper that creates a decal mesh over a surface without z-fighting. Use a material with polygonOffset (factor -1, units -4), depthWrite false and transparent true, and also lift the mesh along the surface normal by an amount that grows with camera distance (e.g. 0.0005 × distance, clamped to 0.02) updated each frame without allocations. Expose a `depthStep(z, near, bits = 24)` utility returning z² / (near × 2^bits) and log a warning on startup if the camera's near is below 0.05. Write a Vitest test for depthStep (doubling near halves it; doubling z quadruples it).",
  related: ["normals", "frustum-culling", "fragment-shader"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "The depth buffer stores one value per pixel, usually 24 bits. When two triangles land on the same pixel with depths that round to the same value, which one wins depends on tiny interpolation differences, so the winner changes from pixel to pixel and frame to frame. That noisy, crawling pattern is **z-fighting**.",
    "Perspective depth is **not linear**: it is proportional to `1/z`, so most of the precision sits right in front of the near plane and very little is left far away. The depth step grows with the square of distance and shrinks as you push the near plane out. Going from `near = 0.01` to `near = 0.1` buys ten times more precision everywhere; moving the far plane barely matters.",
    "Fixes, in order of preference: don't author coplanar surfaces (cut the hole, or lift decals by a few millimetres); raise `camera.near` as far as the game allows; use `material.polygonOffset` to bias one surface toward the camera; and for huge worlds, a **logarithmic** or **reversed-Z** float depth buffer (`logarithmicDepthBuffer: true` or `reverseDepthBuffer: true` on the renderer).",
    "Nearby, related artefacts share the same cause: shadow acne is z-fighting between a surface and its own shadow map, cured with a depth bias, and flickering outlines on [billboards](/threejs/rendering/billboarding) or decals often are too.",
  ],
  formulas: [
    {
      label: "Stored depth (perspective)",
      math: tex`z_{buf} = \frac{f}{f - n}\left(1 - \frac{n}{z}\right)`,
      note: "0 at the near plane, 1 at the far plane; hyperbolic in z.",
    },
    {
      label: "Smallest resolvable gap",
      math: tex`\Delta z \approx \frac{z^2}{n \cdot 2^{b}} \quad (f \gg n)`,
      note: "b = depth bits (24). Doubling n halves Δz; doubling z quadruples it.",
    },
    {
      label: "Polygon offset",
      math: tex`z' = z + \text{factor}\cdot\max\left|\tfrac{\partial z}{\partial x}, \tfrac{\partial z}{\partial y}\right| + \text{units}\cdot r`,
      note: "r is the smallest resolvable depth step. Negative values pull toward the camera.",
    },
  ],
  rules: [
    "Pick `near` as large as possible: 0.1 for first-person, 0.5–1 for third-person or strategy cameras.",
    "Keep far/near under about 10,000 with a standard 24-bit buffer.",
    "Decals: lift 0.001–0.01 world units or use `polygonOffsetFactor: -1, polygonOffsetUnits: -4`.",
    "Never place two meshes with exactly coincident faces; boolean them or delete the hidden face.",
    "Planet-scale or space scenes: use a logarithmic or reversed-Z depth buffer.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Decal over a floor without fighting:",
      code: `const camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000) // not 0.0001!

const decalMaterial = new THREE.MeshStandardMaterial({
  map: decalTexture,
  transparent: true,
  depthWrite: false,       // decals shouldn't occlude each other
  polygonOffset: true,
  polygonOffsetFactor: -1, // scales with the surface slope
  polygonOffsetUnits: -4,  // constant bias in depth steps
})

// Large worlds: trade a little speed for far more depth precision.
const renderer = new THREE.WebGLRenderer({ logarithmicDepthBuffer: true })`,
    },
  ],
  mistakes: [
    'Setting `near` to 0.0001 "to be safe" and destroying precision for the whole scene.',
    "Raising `far` to fix fighting; it barely helps. The near plane is what matters.",
    "Using a fixed tiny offset for decals at all distances; far away it is below one depth step and fights again.",
    "Huge `polygonOffset` values that make decals show through walls.",
    "Coincident faces from modular kits (floors overlapping at seams).",
  ],
  reading: [
    {
      title: "Three.js docs — Material.polygonOffset",
      url: "https://threejs.org/docs/#api/en/materials/Material.polygonOffset",
    },
    {
      title: "Khronos OpenGL wiki — Depth Buffer Precision",
      url: "https://www.khronos.org/opengl/wiki/Depth_Buffer_Precision",
    },
  ],
  visual:
    "A large white floor and a smaller yellow square panel, turned 30°, share the same plane as they turn; on the right a grey box and a grey copy rotated 90° occupy the same space. With no fix the depth test flips between each pair, producing stripes and speckles. Choose polygon offset or a small lift to settle it, or open a tiny gap and slide the near plane: a very small near brings the fighting back even with a gap.",
}

export default sheet
