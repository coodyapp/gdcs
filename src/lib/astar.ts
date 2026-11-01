/**
 * Grid A* with a binary-heap open set. Pure logic: no Three.js, no DOM.
 * Cells are indexed `y * width + x`.
 */

export type Heuristic = "manhattan" | "octile" | "zero"

export interface Grid {
  width: number
  height: number
  /** 1 = wall, 0 = walkable. Length width * height. */
  walls: ArrayLike<number>
}

export interface AStarOptions {
  heuristic?: Heuristic
  /** 8-way movement (diagonal cost √2, no corner cutting). Default false. */
  diagonal?: boolean
  /** Weighted A*: f = g + w·h. w > 1 expands fewer nodes but may be suboptimal. */
  weight?: number
}

export interface AStarResult {
  /** Cell indices from start to goal, or null when the goal is unreachable. */
  path: number[] | null
  cost: number
  /** Order in which nodes were closed (expanded). */
  expanded: number[]
  /** Step (index into `expanded`) at which each cell entered the open set; -1 = never. */
  openedAt: Int32Array
}

const SQRT2 = Math.SQRT2

export function heuristic(
  kind: Heuristic,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = Math.abs(ax - bx)
  const dy = Math.abs(ay - by)
  if (kind === "manhattan") return dx + dy
  if (kind === "octile") return dx + dy + (SQRT2 - 2) * Math.min(dx, dy)
  return 0
}

/** Min-heap of cell indices keyed by an external priority array. */
export class MinHeap {
  private items: number[] = []
  private keys: number[] = []
  get size() {
    return this.items.length
  }
  push(item: number, key: number) {
    const { items, keys } = this
    let i = items.length
    items.push(item)
    keys.push(key)
    while (i > 0) {
      const p = (i - 1) >> 1
      if (keys[p] <= key) break
      items[i] = items[p]
      keys[i] = keys[p]
      i = p
    }
    items[i] = item
    keys[i] = key
  }
  pop(): number {
    const { items, keys } = this
    const top = items[0]
    const lastItem = items.pop()!
    const lastKey = keys.pop()!
    const n = items.length
    if (n > 0) {
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        if (l >= n) break
        const r = l + 1
        const c = r < n && keys[r] < keys[l] ? r : l
        if (keys[c] >= lastKey) break
        items[i] = items[c]
        keys[i] = keys[c]
        i = c
      }
      items[i] = lastItem
      keys[i] = lastKey
    }
    return top
  }
}

const DIRS4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const
const DIRS8 = [...DIRS4, [1, 1], [1, -1], [-1, 1], [-1, -1]] as const

export function astar(
  grid: Grid,
  start: number,
  goal: number,
  opts: AStarOptions = {}
): AStarResult {
  const { width, height, walls } = grid
  const kind = opts.heuristic ?? (opts.diagonal ? "octile" : "manhattan")
  const w = opts.weight ?? 1
  const dirs = opts.diagonal ? DIRS8 : DIRS4
  const n = width * height
  const g = new Float64Array(n).fill(Infinity)
  const parent = new Int32Array(n).fill(-1)
  const closed = new Uint8Array(n)
  const openedAt = new Int32Array(n).fill(-1)
  const expanded: number[] = []
  const gx = goal % width
  const gy = (goal / width) | 0
  const h = (c: number) => heuristic(kind, c % width, (c / width) | 0, gx, gy)
  // Tie-break toward larger g (deeper nodes) so equal-f plateaus resolve fast.
  const key = (c: number) => g[c] + w * h(c) - g[c] * 1e-6

  if (walls[start] || walls[goal])
    return { path: null, cost: Infinity, expanded, openedAt }

  const open = new MinHeap()
  g[start] = 0
  openedAt[start] = 0
  open.push(start, key(start))

  while (open.size > 0) {
    const cur = open.pop()
    if (closed[cur]) continue // stale duplicate (lazy decrease-key)
    closed[cur] = 1
    expanded.push(cur)
    if (cur === goal) break
    const cx = cur % width
    const cy = (cur / width) | 0
    for (const [dx, dy] of dirs) {
      const nx = cx + dx
      const ny = cy + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const nb = ny * width + nx
      if (walls[nb] || closed[nb]) continue
      const diag = dx !== 0 && dy !== 0
      // No corner cutting: both orthogonal neighbours must be free.
      if (diag && (walls[cy * width + nx] || walls[ny * width + cx])) continue
      const tentative = g[cur] + (diag ? SQRT2 : 1)
      if (tentative < g[nb]) {
        g[nb] = tentative
        parent[nb] = cur
        if (openedAt[nb] < 0) openedAt[nb] = expanded.length
        open.push(nb, key(nb))
      }
    }
  }

  if (!closed[goal]) return { path: null, cost: Infinity, expanded, openedAt }
  const path: number[] = []
  for (let c = goal; c !== -1; c = parent[c]) path.push(c)
  path.reverse()
  return { path, cost: g[goal], expanded, openedAt }
}

/** Parse an ASCII map: '#' wall, 'S' start, 'G' goal, anything else floor. */
export function parseGrid(rows: string[]) {
  const height = rows.length
  const width = rows[0].length
  const walls = new Uint8Array(width * height)
  let start = -1
  let goal = -1
  rows.forEach((row, y) => {
    for (let x = 0; x < width; x++) {
      const ch = row[x]
      const i = y * width + x
      if (ch === "#") walls[i] = 1
      if (ch === "S") start = i
      if (ch === "G") goal = i
    }
  })
  return { grid: { width, height, walls } as Grid, start, goal }
}
