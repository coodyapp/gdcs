import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "spatial-partitioning",
  category: "performance",
  subcategory: "world",
  title: "Spatial Partitioning",
  hook: "only compare things that are near each other",
  summary:
    "Bin objects into a uniform grid so collision and proximity queries test only same-cell and neighbour-cell pairs instead of all n(n−1)/2 pairs.",
  level: "core",
  tags: [
    "broad phase",
    "uniform grid",
    "spatial hash",
    "quadtree",
    "collision",
  ],
  updated: "2026-11-02",
  prompt:
    "Implement a uniform-grid broad phase in TypeScript for circles in a 2D (x/z) Three.js game. Constructor takes world bounds, cell size and capacity and preallocates Int32Arrays for counts, cell starts and sorted items. build(circles) bins by centre with a counting sort, clamps out-of-bounds points to edge cells, and throws if any diameter exceeds the cell size. candidates(visit) reports each unordered pair from the same cell and the 4 forward neighbours exactly once and returns the number of checks. Add queryRadius(x, y, r, out) for AI. Write tests: on random data the grid's overlapping pairs equal brute force exactly, with no duplicates, and use far fewer checks.",
  related: [
    "chunk-streaming",
    "time-slicing",
    "raycasting",
    "collision-detection",
    "bounding-volumes",
    "interest-management",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Testing every object against every other is `n(n−1)/2` checks: 4,950 for 100 objects, about 500,000 for 1,000. Most of those pairs are far apart. **Spatial partitioning** organises objects by position so a query only looks at objects nearby. This is the **broad phase**: it produces a short list of candidate pairs for the exact (narrow-phase) test.",
    'The simplest structure is a **uniform grid**. Pick a cell size at least as large as the biggest object\'s diameter, put each object in the cell containing its centre, and test each object only against its own cell and the 8 neighbours. Any two overlapping objects are guaranteed to be in the same or adjacent cells. To count each pair once, scan each cell against itself and only its 4 "forward" neighbours.',
    "Rebuild the grid every frame with a counting sort (count per cell, prefix sum, scatter) into flat arrays. That costs `O(n + cells)` and allocates nothing. For unbounded worlds, hash `(cx, cy)` into a fixed table (a **spatial hash**) instead of allocating a dense array.",
    'Uniform grids suit objects of similar size. Very mixed sizes favour **quadtrees/octrees** or a **BVH** (bounding-volume hierarchy, also used for [raycasting](/threejs/rendering/raycasting) against meshes), and sweep-and-prune works well when objects move little between frames. The same grid answers "who is within radius r" for AI and [time-sliced](/performance/cpu/time-slicing) sensors.',
  ],
  formulas: [
    {
      label: "Brute force",
      math: tex`\text{checks} = \frac{n(n-1)}{2} = O(n^2)`,
    },
    {
      label: "Uniform grid (evenly spread)",
      math: tex`\text{checks} \approx \frac{n(n-1)}{2}\cdot\frac{9c^2}{A}`,
      note: "Cell size c, world area A: roughly n × (objects in a 3×3 block of cells) / 2.",
    },
    {
      label: "Cell size rule",
      math: tex`\textcolor{#fafafa}{c} \ge 2\,r_{\max}`,
    },
  ],
  rules: [
    "Start with cell size = 1–2× the largest object diameter. Much smaller cells miss overlaps (or need multi-cell insertion); much larger ones test too many pairs.",
    "Aim for about 1–4 objects per occupied cell.",
    "Rebuild from scratch each frame for moving objects; it is usually faster than incremental updates.",
    "Insert a large object into every cell its bounds overlap, or keep giants in a separate list.",
    "Use flat typed arrays (counts, starts, items) instead of arrays of arrays to avoid GC churn.",
  ],
  code: [
    {
      lang: "ts",
      caption:
        "Uniform grid broad phase with a counting sort and forward-neighbour scan:",
      code: `const FORWARD = [[1, 0], [-1, 1], [0, 1], [1, 1]]

function broadPhase(xs: Float32Array, ys: Float32Array, n: number, cell: number,
                    cols: number, rows: number, visit: (i: number, j: number) => void) {
  // Allocated here for brevity; keep these arrays across frames in real code.
  const cellOf = new Int32Array(n), start = new Int32Array(cols * rows + 1)
  for (let i = 0; i < n; i++) {
    const cx = Math.min(cols - 1, Math.max(0, Math.floor(xs[i] / cell)))
    const cy = Math.min(rows - 1, Math.max(0, Math.floor(ys[i] / cell)))
    cellOf[i] = cy * cols + cx
    start[cellOf[i] + 1]++
  }
  for (let c = 0; c < cols * rows; c++) start[c + 1] += start[c] // prefix sum
  const fill = start.slice(0, -1), items = new Int32Array(n)
  for (let i = 0; i < n; i++) items[fill[cellOf[i]]++] = i

  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    const a = cy * cols + cx
    for (let p = start[a]; p < start[a + 1]; p++) {
      for (let q = p + 1; q < start[a + 1]; q++) visit(items[p], items[q])
      for (const [dx, dy] of FORWARD) {
        const nx = cx + dx, ny = cy + dy
        if (nx < 0 || nx >= cols || ny >= rows) continue
        const b = ny * cols + nx
        for (let q = start[b]; q < start[b + 1]; q++) visit(items[p], items[q])
      }
    }
  }
}`,
    },
  ],
  mistakes: [
    "Choosing cells smaller than the objects, so overlapping pairs in non-adjacent cells are silently missed.",
    "Scanning all 8 neighbours from every cell and reporting each pair twice.",
    "Allocating a new array per cell every frame and feeding the garbage collector.",
    "Using a uniform grid for a world with a few huge objects and many tiny ones, where every cell ends up crowded.",
  ],
  reading: [
    {
      title: "Red Blob Games — Grids and graphs",
      url: "https://www.redblobgames.com/pathfinding/grids/graphs.html",
    },
    {
      title: "GPU Gems 3 — Broad-phase collision detection with CUDA",
      url: "https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-32-broad-phase-collision-detection-cuda",
    },
  ],
  visual:
    "Moving circles on a uniform grid seen from above: lit white cells are occupied (brighter with 2+ circles), faint white lines join each candidate pair the grid actually tests (same or neighbouring cell), and circles are green until they really overlap, then turn red with a red halo ring. Compare the readout's brute-force count with the grid's, then change the cell size or circle count.",
}

export default sheet
