/**
 * Uniform-grid broad phase for circles in 2D.
 *
 * Each circle is binned by its centre into exactly one cell (counting sort,
 * no per-frame allocation). Because the cell size is at least the largest
 * diameter, two overlapping circles always sit in the same or an adjacent
 * cell, so only those cell pairs need testing. Each unordered cell pair is
 * visited once by scanning a cell against itself and its four "forward"
 * neighbours (E, SW, S, SE).
 */

export interface Circle {
  x: number
  y: number
  r: number
}

export const circlesOverlap = (a: Circle, b: Circle) => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const rr = a.r + b.r
  return dx * dx + dy * dy < rr * rr
}

/** Number of tests an all-pairs check performs: n(n − 1) / 2. */
export const bruteForceChecks = (n: number) => (n * (n - 1)) / 2

/** Reference O(n²) answer: every overlapping pair as [i, j] with i < j. */
export function bruteForcePairs(
  circles: readonly Circle[]
): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < circles.length; i++)
    for (let j = i + 1; j < circles.length; j++)
      if (circlesOverlap(circles[i], circles[j])) out.push([i, j])
  return out
}

// Forward half of the 8-neighbourhood: (dx, dy) offsets.
const FORWARD = [1, 0, -1, 1, 0, 1, 1, 1] as const

export class SpatialGrid {
  readonly cols: number
  readonly rows: number
  /** Circles per cell after `build`, indexed `cy * cols + cx`. */
  readonly counts: Int32Array
  private readonly start: Int32Array
  private readonly items: Int32Array
  private readonly cellOf: Int32Array
  private readonly fill: Int32Array

  constructor(
    readonly width: number,
    readonly height: number,
    readonly cellSize: number,
    readonly capacity: number,
    readonly originX = 0,
    readonly originY = 0
  ) {
    if (cellSize <= 0) throw new RangeError("cellSize must be positive")
    this.cols = Math.max(1, Math.ceil(width / cellSize))
    this.rows = Math.max(1, Math.ceil(height / cellSize))
    const cells = this.cols * this.rows
    this.counts = new Int32Array(cells)
    this.start = new Int32Array(cells + 1)
    this.items = new Int32Array(capacity)
    this.cellOf = new Int32Array(capacity)
    this.fill = new Int32Array(cells)
  }

  /** Cell index of a point; points outside the bounds clamp to edge cells. */
  cellIndex(x: number, y: number) {
    const cx = Math.min(
      this.cols - 1,
      Math.max(0, Math.floor((x - this.originX) / this.cellSize))
    )
    const cy = Math.min(
      this.rows - 1,
      Math.max(0, Math.floor((y - this.originY) / this.cellSize))
    )
    return cy * this.cols + cx
  }

  /** Bin every circle by its centre. Throws if a circle is wider than a cell. */
  build(circles: readonly Circle[]) {
    const n = circles.length
    if (n > this.capacity) throw new RangeError("more circles than capacity")
    this.counts.fill(0)
    for (let i = 0; i < n; i++) {
      const c = circles[i]
      if (2 * c.r > this.cellSize)
        throw new RangeError("cellSize must be at least the largest diameter")
      const cell = this.cellIndex(c.x, c.y)
      this.cellOf[i] = cell
      this.counts[cell]++
    }
    // Prefix sums give each cell a contiguous slice of `items`.
    this.start[0] = 0
    for (let c = 0; c < this.counts.length; c++) {
      this.fill[c] = this.start[c]
      this.start[c + 1] = this.start[c] + this.counts[c]
    }
    for (let i = 0; i < n; i++) this.items[this.fill[this.cellOf[i]]++] = i
  }

  /**
   * Calls `visit(i, j)` once for every candidate pair (same or adjacent
   * cell) and returns how many candidates there were. Call after `build`.
   */
  candidates(visit: (i: number, j: number) => void) {
    let checks = 0
    const { cols, rows, start, items } = this
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const a = cy * cols + cx
        const a0 = start[a]
        const a1 = start[a + 1]
        if (a0 === a1) continue
        for (let p = a0; p < a1; p++)
          for (let q = p + 1; q < a1; q++) {
            visit(items[p], items[q])
            checks++
          }
        for (let k = 0; k < FORWARD.length; k += 2) {
          const nx = cx + FORWARD[k]
          const ny = cy + FORWARD[k + 1]
          if (nx < 0 || nx >= cols || ny >= rows) continue
          const b = ny * cols + nx
          for (let p = a0; p < a1; p++)
            for (let q = start[b]; q < start[b + 1]; q++) {
              visit(items[p], items[q])
              checks++
            }
        }
      }
    }
    return checks
  }
}

/** Convenience wrapper: overlapping pairs (i < j) plus the number of narrow-phase tests. */
export function gridPairs(
  circles: readonly Circle[],
  grid: SpatialGrid
): { pairs: [number, number][]; checks: number } {
  grid.build(circles)
  const pairs: [number, number][] = []
  const checks = grid.candidates((i, j) => {
    if (circlesOverlap(circles[i], circles[j]))
      pairs.push(i < j ? [i, j] : [j, i])
  })
  return { pairs, checks }
}
