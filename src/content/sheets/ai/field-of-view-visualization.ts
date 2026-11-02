import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "field-of-view-visualization",
  category: "ai",
  subcategory: "perception",
  title: "Field of View Visualization",
  hook: "fan out rays, stitch the hits into a mesh, sharpen the corners",
  summary:
    "Draw what an agent sees: cast a fan of rays, build a triangle-fan mesh from the hits, and binary-search between rays to snap edges to corners.",
  level: "common",
  tags: [
    "vision cone",
    "visibility mesh",
    "raycasting",
    "buffergeometry",
    "stealth",
  ],
  updated: "2026-11-02",
  prompt:
    "Build a TypeScript + Three.js `FovMesh` that draws a guard's visible area on the XZ plane. Inputs: eye position, heading, viewAngle, viewRadius, rayCount, edgeIterations, edgeDistThreshold and a `cast(angle) → { point, dist, objectId }` callback (objectId −1 when the ray reaches viewRadius). Cast rayCount evenly spaced rays across the cone. Between consecutive rays whose objectId differs or whose distances differ by more than the threshold, binary-search the angle edgeIterations times, keeping the last ray that matches the left hit and the first that does not, and insert both points. Write positions into a preallocated BufferGeometry (eye at index 0, rim points after it), build fan indices (0, i+1, i+2) once at max capacity, and call setDrawRange each frame; never allocate in update. Write Vitest tests: open space gives exactly rayCount rim points, one box yields two refined edges, and the refined polygon's area is closer to a 20,000-ray reference than the unrefined one.",
  related: [
    "field-of-view",
    "stencil-shader",
    "raycasting",
    "trigonometry",
    "steering-behaviors",
    "finite-state-machine",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "To show the player what a guard sees, sweep the [vision cone](/ai/perception/field-of-view) with N evenly spaced [rays](/threejs/rendering/raycasting). Each ray stops at the first wall or at the view radius. The eye plus those hit points, in angle order, form a **triangle fan**: triangle *i* is (eye, hit *i*, hit *i+1*). Put that in a `BufferGeometry` and you have a polygon that wraps around every obstacle.",
    "With few rays, corners look chewed: the true silhouette of a wall falls somewhere between two rays and the mesh cuts straight across. More rays help, but cost grows linearly everywhere, even in open space. **Edge refinement** spends rays only where they matter: when two neighbours hit different objects (or the same object at very different distances), binary-search the angle between them. Each step halves the gap, so 4–6 iterations put the edge within 1/16–1/64 of the ray spacing.",
    "Each search returns two points, the last ray still on the near surface and the first one past it, and both go into the fan between the original rays. Rebuild in place each frame: write positions into a preallocated `Float32Array`, keep a fan index buffer sized for the worst case, and use `setDrawRange` so the GPU draws only the triangles in use.",
  ],
  formulas: [
    {
      label: "Ray angles",
      math: tex`\alpha_i = h - \tfrac{\theta}{2} + i\,\frac{\theta}{N-1},\quad i = 0..N-1`,
      note: "h is the heading, θ the view angle, N the ray count.",
    },
    {
      label: "Edge test between neighbours",
      math: tex`\text{id}_i \ne \text{id}_{i+1} \;\lor\; |d_i - d_{i+1}| > \textcolor{#f5d547}{\varepsilon}`,
    },
    {
      label: "Error after k iterations",
      math: tex`\Delta\alpha_k = \frac{\theta}{(N-1)\,2^{\textcolor{#f5d547}{k}}}`,
      note: "Fan triangles: N + 2·edges − 1, indices 3 × that.",
    },
  ],
  rules: [
    "Start with about 1 ray per 3–4° of view angle (e.g. 30–40 rays for 120°) and 4–6 edge iterations.",
    "Distance threshold ≈ the smallest gap a player could slip through, e.g. 0.3–0.5 m.",
    "Worst-case capacity: N + 2(N − 1) rim points; allocate for that once.",
    "Lift the mesh a few millimetres above the floor, or use polygonOffset, to avoid z-fighting.",
    "Draw it with depthWrite: false and low opacity so it does not hide what it covers.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Fan sweep with binary-search edge refinement:",
      code: `function sweep(cast: Cast, heading: number, fov: number, n: number,
               iters: number, eps: number, out: Hit[]) {
  out.length = 0
  const step = fov / (n - 1)
  let prev = cast(heading - fov / 2)
  out.push(prev)
  for (let i = 1; i < n; i++) {
    const a = heading - fov / 2 + i * step
    const cur = cast(a)
    if (iters > 0 && differs(prev, cur, eps)) {
      let lo = a - step, hi = a, loHit = prev, hiHit = cur
      for (let k = 0; k < iters; k++) {
        const m = (lo + hi) / 2, h = cast(m)
        if (differs(loHit, h, eps)) { hi = m; hiHit = h }
        else { lo = m; loHit = h }
      }
      out.push(loHit, hiHit) // both sides of the silhouette
    }
    out.push(cur)
    prev = cur
  }
}
const differs = (a: Hit, b: Hit, eps: number) =>
  a.id !== b.id || Math.abs(a.dist - b.dist) > eps`,
    },
    {
      lang: "ts",
      caption: "Update the mesh in place (allocated once at capacity):",
      code: `const pos = geo.attributes.position as THREE.BufferAttribute
pos.setXYZ(0, eye.x, 0.02, eye.z)
hits.forEach((h, i) => pos.setXYZ(i + 1, h.x, 0.02, h.z))
pos.needsUpdate = true
geo.setDrawRange(0, (hits.length - 1) * 3) // index = [0,i+1,i+2]…
geo.computeBoundingSphere()`,
    },
  ],
  mistakes: [
    "Raising the ray count to hide jagged corners instead of refining edges; cost goes up everywhere for a problem that lives only at silhouettes.",
    "Comparing only hit/no-hit, so two different walls at different depths are joined by a slanted triangle across the gap.",
    "Creating a new BufferGeometry every frame; it leaks GPU buffers until disposed. Rewrite the existing arrays and set needsUpdate.",
    "Forgetting setDrawRange (or the index) when the point count shrinks, leaving stale triangles from the last frame.",
  ],
  reading: [
    {
      title: "Sebastian Lague — Field of View (Unity project)",
      url: "https://github.com/SebLague/Field-of-View",
    },
    {
      title: "Three.js docs — BufferGeometry",
      url: "https://threejs.org/docs/#api/en/core/BufferGeometry",
    },
    {
      title: "Red Blob Games — 2D visibility",
      url: "https://www.redblobgames.com/articles/visibility/",
    },
  ],
  visual:
    "The translucent white fan with a solid white rim is the visible area of the white guard ball; grey blocks and pillars are walls. Thin grey lines are the evenly spaced rays, and yellow lines ending in yellow dots are the extra edge-refinement casts. Drop iterations to 0 to see jagged corners, then raise them; turn rays off to judge the mesh alone.",
}

export default sheet
