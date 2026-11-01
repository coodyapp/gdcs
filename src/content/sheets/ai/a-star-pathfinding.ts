import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "a-star-pathfinding",
  category: "ai",
  subcategory: "navigation",
  title: "A* Pathfinding",
  hook: "expand the node that looks cheapest so far plus estimated cost to go",
  summary:
    "A* searches a graph by always expanding the node with the lowest cost so far plus estimated cost to go. With an admissible heuristic, the path is optimal.",
  level: "core",
  tags: ["pathfinding", "graph search", "heuristic", "grid", "navmesh"],
  updated: "2026-11-01",
  prompt:
    "Implement grid A* in TypeScript for a Three.js game. Input: width, height, a Uint8Array of walls, start and goal cell indices, options {diagonal: boolean, heuristic: 'manhattan' | 'octile' | 'zero', weight: number}. Use a binary min-heap with lazy deletion, tie-break toward larger g, diagonal cost √2 with no corner cutting, and typed arrays for g/parent/closed. Return {path: number[] | null, cost, expanded: number[]} so the search can be visualized. Write Vitest tests: on a hand-made map, A* cost equals Dijkstra (heuristic 'zero') cost and A* expands no more nodes; an 8-way path around a pillar costs 4, not 2√2; a goal walled off returns null.",
  related: ["steering-behaviors", "finite-state-machine", "raycasting"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A* finds the cheapest path through a graph: grid cells, waypoints or navmesh polygons. For each node it tracks `g`, the best known cost from the start, and `h`, a **heuristic** estimate of the cost to the goal. It keeps an **open set** of discovered nodes ordered by `f = g + h`. Each iteration it pops the lowest-f node, moves it to the **closed set**, and relaxes its neighbors. When the goal is popped, follow parent links back to the start.",
    "The heuristic is what makes it fast. `h = 0` turns A* into Dijkstra's algorithm, which floods outward in every direction. A perfect `h` walks straight to the goal. If `h` never **overestimates** the true cost (admissible), the first path to the goal is optimal. Match it to your movement rules: **Manhattan** for 4-way grids and **octile** for 8-way grids with diagonal cost √2.",
    "Use a **binary heap** for the open set. A sorted array or a linear scan turns a few-millisecond search into a frame-killer. Big worlds want a coarser graph (navmesh, hierarchical clusters), searches spread over several frames, and path smoothing with string-pulling or line-of-sight checks afterwards. Hand the finished path to [steering behaviors](/ai/steering/steering-behaviors) to actually move along it.",
  ],
  formulas: [
    { label: "Priority", math: tex`f(n) = g(n) + w\,h(n)` },
    {
      label: "Manhattan (4-way)",
      math: tex`h = |\Delta x| + |\Delta y|`,
    },
    {
      label: "Octile (8-way, diagonal = √2)",
      math: tex`h = |\Delta x| + |\Delta y| + (\sqrt{2} - 2)\min(|\Delta x|, |\Delta y|)`,
      note: "Weighted A* (w > 1) expands far fewer nodes; the path is at most w × optimal.",
    },
  ],
  rules: [
    "Break ties between equal f toward larger g (or smaller h). On open grids this cuts expansions dramatically.",
    "Use lazy deletion: push duplicates with the better key and skip popped nodes that are already closed. It's simpler than decrease-key and just as fast in practice.",
    "On 8-way grids, forbid cutting corners: a diagonal move needs both adjacent orthogonal cells to be free.",
    "Budget searches: cap expansions (e.g. 2,000 per frame) and resume next frame, or fall back to a partial path toward the closest node found.",
    "Cache paths and re-plan only when the goal moves more than a cell or two, or when the map changes along the route.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Core loop (binary heap, lazy deletion):",
      code: `g.fill(Infinity); g[start] = 0
open.push(start, h(start))
while (open.size) {
  const cur = open.pop()
  if (closed[cur]) continue            // stale duplicate
  closed[cur] = 1
  if (cur === goal) return rebuild(parent, goal)
  for (const [nb, cost] of neighbors(cur)) {
    if (closed[nb]) continue
    const ng = g[cur] + cost
    if (ng < g[nb]) {
      g[nb] = ng
      parent[nb] = cur
      open.push(nb, ng + w * h(nb))    // f = g + w·h
    }
  }
}
return null                            // unreachable`,
    },
  ],
  mistakes: [
    "Using Euclidean or Manhattan distance on an 8-way grid. Manhattan overestimates diagonals, so paths stop being optimal.",
    "Allowing diagonal moves through wall corners, so agents clip through geometry.",
    "Allocating node objects per search on a big grid. Reuse typed arrays (g, parent, closed) and clear them with a generation counter.",
    "Searching to an unreachable goal every frame. Flood fill connected regions once and reject impossible requests instantly.",
  ],
  reading: [
    {
      title: "Red Blob Games — Introduction to A*",
      url: "https://www.redblobgames.com/pathfinding/a-star/introduction.html",
    },
    {
      title: "Red Blob Games — Heuristics (Amit's A* pages)",
      url: "https://theory.stanford.edu/~amitp/GameProgramming/Heuristics.html",
    },
  ],
  visual:
    "The search animates from the green start to the red goal. Yellow tiles are the open set (frontier), blue tiles are closed (already expanded), and the orange line is the final path. Switch the heuristic to Dijkstra to watch it flood the map, or raise the weight to see it rush toward the goal, expand fewer tiles and sometimes pick a longer path.",
}

export default sheet
