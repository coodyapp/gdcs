import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "chunk-streaming",
  category: "performance",
  subcategory: "world",
  title: "Chunk Streaming",
  hook: "keep only the world around the player in memory",
  summary:
    "Split a big world into chunks, load those within a radius of the player and unload them past a larger radius, so the boundary never thrashes.",
  level: "advanced",
  tags: ["open world", "streaming", "hysteresis", "chunks", "memory"],
  updated: "2026-11-01",
  prompt:
    "Build a chunk streaming system in TypeScript for a Three.js open world on the x/z plane. Inputs: chunk size, loadRadius, unloadRadius (assert unload ≥ load), and maxLoadsPerFrame. Each frame: unload resident chunks whose centre is farther than unloadRadius (return them to a pool and dispose GPU resources only when the pool is full), then collect missing chunks within loadRadius, sort nearest first, and start at most maxLoadsPerFrame async loads, ignoring duplicates already in flight and cancelling loads that leave the unload radius before finishing. Expose events for loaded/unloaded. Write tests: wiggling across a chunk boundary produces zero load/unload events with a margin, and many without one.",
  related: ["spatial-partitioning", "time-slicing", "frame-budget"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Large worlds don't fit in memory or in the [frame budget](/performance/cpu/frame-budget) all at once. **Chunk streaming** divides the world into fixed-size squares (or cubes) and keeps only the ones near the player resident: terrain meshes, props, colliders, AI. Chunks are addressed by integer coordinates `(⌊x/s⌋, ⌊z/s⌋)`, so finding the neighbourhood is simple arithmetic.",
    "Use **two radii**. Load a chunk when it comes within `R_load` and unload it only after it moves beyond `R_unload > R_load`. This **hysteresis** band stops a chunk on the edge from being loaded and destroyed every time the player steps back and forth across it, which would waste I/O and cause hitches. A margin of about one chunk is typical.",
    "Loading takes time, so stream **nearest first** and spread work across frames: limit loads (and mesh building) per frame like [time slicing](/performance/cpu/time-slicing), parse data in a Web Worker, and reuse released chunk objects from a pool. Set `R_load` large enough that a chunk finishes loading before the player can see or reach it: at least speed × worst-case load time beyond the view distance.",
    "Spatial queries inside resident chunks use the same tricks as [spatial partitioning](/performance/world/spatial-partitioning); chunks are a coarse grid around a finer one.",
  ],
  formulas: [
    {
      label: "Chunk of a position",
      math: tex`(c_x, c_z) = \left(\left\lfloor \tfrac{x}{s} \right\rfloor, \left\lfloor \tfrac{z}{s} \right\rfloor\right)`,
    },
    {
      label: "Hysteresis",
      math: tex`\text{load if } d \le R_{\text{load}}, \quad \text{unload if } d > R_{\text{unload}}, \quad R_{\text{unload}} > R_{\text{load}}`,
    },
    {
      label: "Resident chunks (approx.)",
      math: tex`N \approx \frac{\pi R^2}{s^2}, \quad R_{\text{load}} \le R \le R_{\text{unload}}`,
    },
    {
      label: "Minimum load radius",
      math: tex`R_{\text{load}} \ge R_{\text{view}} + v_{\max}\, t_{\text{load}}`,
    },
  ],
  rules: [
    "Set the unload radius 1–2 chunk sizes larger than the load radius.",
    "Load nearest first, with a per-frame cap (e.g. 1–4 chunk loads or mesh builds per frame).",
    "Pick a chunk size that loads in a few milliseconds: commonly 16–64 m for terrain or 16³ voxels.",
    "Pool chunk objects and GPU buffers. Re-fill them rather than creating and disposing each time.",
    "Call `geometry.dispose()`, `material.dispose()` and `texture.dispose()` on chunks you truly release, or GPU memory grows forever.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Load/unload with hysteresis and a per-frame budget:",
      code: `const S = 32, R_LOAD = 96, R_UNLOAD = 128, MAX_LOADS = 2
const resident = new Map<string, Chunk>()
const dist = (cx: number, cz: number, p: THREE.Vector3) =>
  Math.hypot((cx + 0.5) * S - p.x, (cz + 0.5) * S - p.z)

function stream(player: THREE.Vector3) {
  for (const [key, chunk] of resident)
    if (dist(chunk.cx, chunk.cz, player) > R_UNLOAD) {
      chunk.release() // back to the pool, dispose GPU data if needed
      resident.delete(key)
    }

  const wanted: [number, number, number][] = []
  const r = Math.ceil(R_LOAD / S)
  const pcx = Math.floor(player.x / S), pcz = Math.floor(player.z / S)
  for (let cx = pcx - r; cx <= pcx + r; cx++)
    for (let cz = pcz - r; cz <= pcz + r; cz++) {
      const d = dist(cx, cz, player)
      if (d <= R_LOAD && !resident.has(\`\${cx},\${cz}\`)) wanted.push([d, cx, cz])
    }
  wanted.sort((a, b) => a[0] - b[0]) // nearest first
  for (const [, cx, cz] of wanted.slice(0, MAX_LOADS))
    resident.set(\`\${cx},\${cz}\`, Chunk.acquire(cx, cz)) // async fill
}`,
    },
  ],
  mistakes: [
    "Using one radius for both loading and unloading, so boundary chunks thrash as the player wiggles.",
    "Loading every newly needed chunk in the same frame after a teleport, causing a long hitch. Use a budget and a loading screen for big jumps.",
    "Forgetting to dispose released geometry and textures, so GPU memory leaks over a long session.",
    "Making the load radius smaller than the view distance plus travel during load time, so the world pops in visibly.",
    "Using floating-point world positions far from the origin. Rebase the origin when the player travels thousands of units.",
  ],
  reading: [
    {
      title: "Red Blob Games — Grids and graphs",
      url: "https://www.redblobgames.com/pathfinding/grids/graphs.html",
    },
    {
      title: "Three.js manual — How to dispose of objects",
      url: "https://threejs.org/manual/#en/how-to-dispose-of-objects",
    },
  ],
  visual:
    "A top-down world of chunks around the orange player: green chunks are resident, yellow ones are waiting for the load budget, and red ones were just unloaded. The green ring is the load radius and the red ring the unload radius. Set the margin to 0 to see edge chunks thrash, and lower the budget to see loading lag behind.",
}

export default sheet
