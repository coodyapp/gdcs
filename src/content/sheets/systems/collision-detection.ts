import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "collision-detection",
  category: "systems",
  subcategory: "collision",
  title: "Collision Detection: Broad and Narrow Phase",
  hook: "throw out the impossible pairs, then test the rest exactly",
  summary:
    "Checking every pair costs n(n-1)/2 tests. A broad phase discards distant pairs cheaply; a narrow phase tests the rest and returns contact data.",
  level: "core",
  tags: ["collision", "broad phase", "narrow phase", "aabb", "contacts"],
  updated: "2026-11-02",
  prompt:
    "Write a two-phase collision detector in TypeScript for a Three.js game with up to 2,000 moving spheres. Broad phase: a uniform grid in the XZ plane using a Map from cell key to body indices, with cell size supplied by the caller and a thrown RangeError if it is smaller than the largest diameter. Visit the same cell and four forward neighbours so each unordered pair appears once. Narrow phase: `sphereContact(a, b)` compares squared distance to the squared radius sum and returns { normal (unit, from a to b), depth }, using +Y for coincident centres. Return a contact list and the number of narrow-phase tests. Do not apply any collision response. Write Vitest tests on seeded random data: the contact pairs match brute force exactly, no pair appears twice, and the test count stays below n(n-1)/2.",
  related: [
    "spatial-partitioning",
    "tunneling",
    "bounding-volumes",
    "hitbox-hurtbox",
    "impulse-and-momentum",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Testing every object against every other grows with the square of the count: 30 objects make 435 pairs, 1,000 make 499,500. Almost all of those pairs are nowhere near each other, so collision systems split the work into two phases.",
    "The **broad phase** cheaply discards pairs that cannot touch, usually by comparing rough bounds. A **uniform grid** or [spatial partition](/performance/world/spatial-partitioning) only pairs objects in the same or neighbouring cells. **Sort-and-sweep** sorts bounds along an axis and only pairs objects whose intervals overlap. A **BVH** walks a tree of nested bounds. All of them may report false positives, but they must never drop a pair that really touches.",
    "The **narrow phase** runs an exact test on each surviving candidate, such as sphere–sphere or AABB–AABB, or a general algorithm such as GJK or SAT for convex shapes. Its output is **contact data**: a normal saying which way to separate, and a penetration depth saying how far. The response step (pushing apart, bounce, damage) consumes that data and is a separate job.",
    "All of this looks at where objects are at one instant. A fast object can jump past a thin one between ticks and neither phase will see it. That problem is [tunneling](/systems/collision/tunneling), and it needs swept tests.",
  ],
  formulas: [
    {
      label: "All pairs among n objects",
      math: tex`\textcolor{#a3a3a3}{\text{pairs}} = \frac{n(n-1)}{2}`,
      note: "30 → 435 · 100 → 4,950 · 1,000 → 499,500.",
    },
    {
      label: "Sphere–sphere overlap",
      math: tex`\lVert c_b - c_a \rVert^2 < (r_a + r_b)^2`,
      note: "Comparing squares avoids the square root on the many pairs that miss.",
    },
    {
      label: "AABB–AABB overlap",
      math: tex`a^{\min}_k \le b^{\max}_k \;\land\; a^{\max}_k \ge b^{\min}_k \quad \forall k \in \{x, y, z\}`,
      note: "One separated axis is enough to reject, so the test can exit early.",
    },
    {
      label: "Sphere contact data",
      math: tex`\hat{n} = \frac{c_b - c_a}{\lVert c_b - c_a \rVert}, \quad \textcolor{#ff6467}{\text{depth}} = r_a + r_b - \lVert c_b - c_a \rVert`,
      note: "The normal points from a to b. For two AABBs, use the axis with the smallest overlap.",
    },
  ],
  rules: [
    "Binning by centre: cell size must be at least the largest diameter, or real overlaps get missed. Start at 1–2× that diameter.",
    "Uniform grid: best for many objects of similar size. A few huge objects force huge cells, so put them on a separate list.",
    "Sort-and-sweep: objects move little per frame, so re-sorting the nearly sorted list with insertion sort is close to linear. It degrades when everything lines up on the sort axis.",
    "BVH: handles mixed sizes and suits static level geometry. Refit moving nodes each frame and rebuild only occasionally.",
    "Filter by layer or mask, and skip static–static and sleeping pairs, before any exact test.",
    "Under roughly 20–50 objects, plain all-pairs is often fast enough. Measure before adding a structure.",
  ],
  code: [
    {
      lang: "ts",
      caption:
        "Narrow phase: exact test plus contact data, for spheres and boxes.",
      code: `import * as THREE from "three"

type Contact = { normal: THREE.Vector3; depth: number }

function sphereContact(a: THREE.Sphere, b: THREE.Sphere): Contact | null {
  const delta = b.center.clone().sub(a.center)
  const sum = a.radius + b.radius
  const distSq = delta.lengthSq()
  if (distSq >= sum * sum) return null // the usual outcome: no sqrt spent
  const dist = Math.sqrt(distSq)
  const normal = dist > 0 ? delta.divideScalar(dist) : new THREE.Vector3(0, 1, 0)
  return { normal, depth: sum - dist }
}

// THREE.Box3 has the same test built in: a.intersectsBox(b)
const boxesOverlap = (a: THREE.Box3, b: THREE.Box3) =>
  a.min.x <= b.max.x && a.max.x >= b.min.x &&
  a.min.y <= b.max.y && a.max.y >= b.min.y &&
  a.min.z <= b.max.z && a.max.z >= b.min.z`,
    },
    {
      lang: "ts",
      caption:
        "Broad phase: a uniform grid that visits each candidate pair once. `cell` must be at least the largest diameter.",
      code: `type Body = { x: number; z: number; r: number }

// Half the neighbours, so a pair of cells is never visited from both sides.
const FORWARD = [[1, -1], [1, 0], [1, 1], [0, 1]]
const cellKey = (cx: number, cz: number) => cx * 100003 + cz

function gridPairs(
  bodies: Body[],
  cell: number,
  visit: (i: number, j: number) => void
) {
  const cells = new Map<number, number[]>()
  bodies.forEach((b, i) => {
    const k = cellKey(Math.floor(b.x / cell), Math.floor(b.z / cell))
    const list = cells.get(k)
    if (list) list.push(i)
    else cells.set(k, [i])
  })
  bodies.forEach((b, i) => {
    const cx = Math.floor(b.x / cell)
    const cz = Math.floor(b.z / cell)
    // Same cell: indices are ascending, so j > i takes each pair once.
    for (const j of cells.get(cellKey(cx, cz))!) if (j > i) visit(i, j)
    for (const [dx, dz] of FORWARD)
      for (const j of cells.get(cellKey(cx + dx, cz + dz)) ?? []) visit(i, j)
  })
}`,
    },
  ],
  mistakes: [
    "Making grid cells smaller than the largest object. With centre binning, two big overlapping objects can land more than one cell apart and the pair silently disappears.",
    "Reporting a pair twice, as (A, B) and (B, A). The response then runs twice, doubling pushes and damage.",
    "Letting the normal's direction vary between pairs. Define it as pointing from A to B everywhere, or the response pushes objects deeper into each other.",
    "Dividing by the distance when two centres coincide. That gives a NaN normal that spreads through the simulation, so choose a fallback axis.",
    "Using bounds that ignore motion for fast objects. Grow them by the distance moved this tick, or the broad phase discards a pair that was about to collide.",
  ],
  reading: [
    {
      title: "MDN — 3D collision detection",
      url: "https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_collision_detection",
    },
    {
      title: "GPU Gems 3 — Broad-phase collision detection with CUDA",
      url: "https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-32-broad-phase-collision-detection-cuda",
    },
    {
      title: "Box2D docs — Collision",
      url: "https://box2d.org/documentation/md_collision.html",
    },
  ],
  visual:
    "Dark circles with a thin white outline drift in a box. Thin grey lines join every pair being tested, and solid red circles with a thick white outline truly overlap. The bar below fills light grey for the share of all pairs tested and red for the share that really overlap. Turn off the broad phase to watch the lines and bar fill up, or raise the cell size to see the saving shrink.",
}

export default sheet
