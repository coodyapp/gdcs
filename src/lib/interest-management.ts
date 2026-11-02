/**
 * Area-of-interest replication for N players in a 2D world.
 *
 * Every entity is also a client. Each tick, a client's interest set S_c loses
 * members beyond the leave radius and gains entities inside the enter radius,
 * which a uniform grid finds by scanning at most 3×3 cells. Updates per tick
 * are the sum of |S_c|; the "send everything" baseline is N(N − 1).
 *
 * Motion is a closed-form function of (seed, entity, time), so changing a
 * parameter never moves anything and a run replays exactly.
 */
import { mulberry32 } from "./noise"

export const WORLD_WIDTH = 12
export const WORLD_HEIGHT = 7.5
export const TICK_HZ = 20
/** Leave radius with hysteresis on, as a multiple of the enter radius. */
export const LEAVE_RATIO = 1.25
/** Peak displacement of the fast strafing wobble added to every path. */
export const WOBBLE = 0.2
/** Entity 0: the client the visual draws from. */
export const VIEWER = 0

const WINDOW_TICKS = TICK_HZ * 5
/** Far entities go out every this many ticks in the tiered count. */
export const FAR_DIVISOR = 2
export const MAX_MARKS = 128
const TAU = Math.PI * 2

/** Closed-form wandering paths. Entity i's path never depends on N. */
export class Wanderers {
  private readonly p: Float64Array

  constructor(
    readonly n: number,
    seed = 7
  ) {
    const FIELDS = 10
    this.p = new Float64Array(n * FIELDS)
    for (let i = 0; i < n; i++) {
      const random = mulberry32(seed + Math.imul(i + 1, 0x9e3779b1))
      random()
      const heading = random() * TAU
      const speed = 0.15 + random() * 0.3
      const o = i * FIELDS
      this.p[o] = random() * 2 // start along each axis's fold, in spans
      this.p[o + 1] = random() * 2
      this.p[o + 2] = Math.cos(heading) * speed
      this.p[o + 3] = Math.sin(heading) * speed
      this.p[o + 4] = 0.3 + random() * 0.5 // curve rate, rad/s
      this.p[o + 5] = random() * TAU
      this.p[o + 6] = random() * TAU
      this.p[o + 7] = TAU * (0.6 + random() * 0.6) // wobble rate, rad/s
      this.p[o + 8] = random() * TAU
      this.p[o + 9] = random() * TAU
    }
  }

  /** Writes every position at time t into xs and ys. Allocates nothing. */
  write(t: number, xs: Float64Array, ys: Float64Array) {
    const { p, n } = this
    const inset = WOBBLE + 0.05
    const spanX = WORLD_WIDTH - 2 * inset
    const spanY = WORLD_HEIGHT - 2 * inset
    for (let i = 0; i < n; i++) {
      if (i === VIEWER) {
        xs[i] = WORLD_WIDTH / 2 + 2.6 * Math.sin(0.21 * t)
        ys[i] = WORLD_HEIGHT / 2 + 1.1 * Math.sin(0.33 * t + 1)
        continue
      }
      const o = i * 10
      const rate = p[o + 4]
      const wobble = p[o + 7]
      const ux =
        p[o] * spanX + p[o + 2] * t + 0.5 * Math.sin(rate * t + p[o + 5])
      const uy =
        p[o + 1] * spanY + p[o + 3] * t + 0.5 * Math.sin(rate * t + p[o + 6])
      xs[i] = inset + fold(ux, spanX) + WOBBLE * Math.sin(wobble * t + p[o + 8])
      ys[i] = inset + fold(uy, spanY) + WOBBLE * Math.sin(wobble * t + p[o + 9])
    }
  }
}

/** Triangle wave: u bounces between 0 and span, so density stays uniform. */
function fold(u: number, span: number) {
  const m = ((u % (2 * span)) + 2 * span) % (2 * span)
  return m > span ? 2 * span - m : m
}

/** Uniform grid over points, rebuilt with a counting sort. Query radius is free. */
export class InterestGrid {
  readonly cols: number
  readonly rows: number
  /** Distance tests made by the last query. */
  checks = 0
  /** Cells scanned by the last query. */
  cells = 0
  private readonly start: Int32Array
  private readonly fill: Int32Array
  private readonly items: Int32Array
  private readonly cellOf: Int32Array

  constructor(
    readonly width: number,
    readonly height: number,
    readonly cellSize: number,
    capacity: number
  ) {
    if (cellSize <= 0) throw new RangeError("cellSize must be positive")
    this.cols = Math.max(1, Math.ceil(width / cellSize))
    this.rows = Math.max(1, Math.ceil(height / cellSize))
    this.start = new Int32Array(this.cols * this.rows + 1)
    this.fill = new Int32Array(this.cols * this.rows)
    this.items = new Int32Array(capacity)
    this.cellOf = new Int32Array(capacity)
  }

  private cx(x: number) {
    const c = Math.floor(x / this.cellSize)
    return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c
  }

  private cy(y: number) {
    const c = Math.floor(y / this.cellSize)
    return c < 0 ? 0 : c >= this.rows ? this.rows - 1 : c
  }

  build(xs: ArrayLike<number>, ys: ArrayLike<number>, n: number) {
    const { start, fill, items, cellOf, cols } = this
    start.fill(0)
    for (let i = 0; i < n; i++) {
      const cell = this.cy(ys[i]) * cols + this.cx(xs[i])
      cellOf[i] = cell
      start[cell + 1]++
    }
    for (let c = 0; c < fill.length; c++) {
      start[c + 1] += start[c]
      fill[c] = start[c]
    }
    for (let i = 0; i < n; i++) items[fill[cellOf[i]]++] = i
  }

  /** Writes the indices within r of (x, y), inclusive, to out; returns how many. */
  query(
    x: number,
    y: number,
    r: number,
    xs: ArrayLike<number>,
    ys: ArrayLike<number>,
    out: Int32Array
  ) {
    const { start, items, cols } = this
    const r2 = r * r
    const x0 = this.cx(x - r)
    const x1 = this.cx(x + r)
    const y1 = this.cy(y + r)
    let found = 0
    this.checks = 0
    this.cells = 0
    for (let cy = this.cy(y - r); cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        this.cells++
        const cell = cy * cols + cx
        for (let p = start[cell]; p < start[cell + 1]; p++) {
          const i = items[p]
          const dx = xs[i] - x
          const dy = ys[i] - y
          this.checks++
          if (dx * dx + dy * dy <= r2) out[found++] = i
        }
      }
    }
    return found
  }
}

/** Reference O(n) answer for one query: indices within r, inclusive. */
export function bruteForceQuery(
  x: number,
  y: number,
  r: number,
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  n: number
) {
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - x
    const dy = ys[i] - y
    if (dx * dx + dy * dy <= r * r) out.push(i)
  }
  return out
}

/** Updates per tick when every client is sent every other entity. */
export const baselineUpdates = (n: number) => n * (n - 1)

/** Expected share of the baseline for uniform density, ignoring world edges. */
export const uniformShare = (radius: number, area: number) =>
  (Math.PI * radius * radius) / area

/** Near entities go out every tick; far ones every `divisor` ticks, staggered. */
export const isDue = (
  distance2: number,
  nearRadius: number,
  tick: number,
  client: number,
  entity: number,
  divisor: number
) =>
  distance2 <= nearRadius * nearRadius ||
  (tick + client + entity) % divisor === 0

export interface InterestOptions {
  n: number
  radius: number
  hysteresis: boolean
  interest: boolean
  seed?: number
  /** Leave radius ÷ enter radius when hysteresis is on. */
  leaveRatio?: number
  startTick?: number
}

/** All clients' interest sets, advanced one server tick at a time. */
export class InterestSim {
  readonly n: number
  readonly leaveRatio: number
  readonly xs: Float64Array
  readonly ys: Float64Array
  readonly wanderers: Wanderers
  tick: number
  radius: number
  hysteresis: boolean
  interest: boolean

  /** Totals since construction, excluding silent resync ticks. */
  countedTicks = 0
  totalUpdates = 0
  totalEnters = 0
  totalLeaves = 0
  /** Updates if far entities (beyond radius / 2) go out every FAR_DIVISOR ticks. */
  totalTieredUpdates = 0
  totalChecks = 0

  /** Last counted tick. */
  updates = 0
  enters = 0
  leaves = 0

  /** Ring of the viewer's recent events: kind 1 = enter, -1 = leave. */
  readonly markX = new Float64Array(MAX_MARKS)
  readonly markY = new Float64Array(MAX_MARKS)
  readonly markKind = new Int8Array(MAX_MARKS)
  readonly markTick = new Int32Array(MAX_MARKS).fill(-1_000_000)

  private markNext = 0
  private grid!: InterestGrid
  private readonly members: Int32Array
  private readonly counts: Int32Array
  private readonly inSet: Uint8Array
  private readonly found: Int32Array
  private silent = true
  private readonly windowUpdates = new Int32Array(WINDOW_TICKS)
  private readonly windowEnters = new Int32Array(WINDOW_TICKS)
  private readonly windowLeaves = new Int32Array(WINDOW_TICKS)
  private windowNext = 0
  private windowFilled = 0

  constructor(options: InterestOptions) {
    const { n, radius, hysteresis, interest, seed = 7 } = options
    this.n = n
    this.leaveRatio = options.leaveRatio ?? LEAVE_RATIO
    this.tick = options.startTick ?? 0
    this.radius = radius
    this.hysteresis = hysteresis
    this.interest = interest
    this.xs = new Float64Array(n)
    this.ys = new Float64Array(n)
    this.wanderers = new Wanderers(n, seed)
    this.members = new Int32Array(n * n)
    this.counts = new Int32Array(n)
    this.inSet = new Uint8Array(n * n)
    this.found = new Int32Array(n)
    this.makeGrid()
  }

  private makeGrid() {
    // Cells as wide as the query radius: a query spans at most 3×3 of them.
    this.grid = new InterestGrid(WORLD_WIDTH, WORLD_HEIGHT, this.radius, this.n)
  }

  get leaveRadius() {
    return this.hysteresis ? this.radius * this.leaveRatio : this.radius
  }

  get cols() {
    return this.grid.cols
  }

  get rows() {
    return this.grid.rows
  }

  has(client: number, entity: number) {
    return this.inSet[client * this.n + entity] === 1
  }

  /** |S_c|: entities currently replicated to a client. */
  size(client: number) {
    return this.counts[client]
  }

  /** Change settings. Sets adjust on the next tick without counting as churn. */
  configure(radius: number, hysteresis: boolean, interest: boolean) {
    if (
      radius === this.radius &&
      hysteresis === this.hysteresis &&
      interest === this.interest
    )
      return
    if (radius !== this.radius) {
      this.radius = radius
      this.makeGrid()
    }
    this.hysteresis = hysteresis
    this.interest = interest
    this.silent = true
  }

  /** Forget all sets and continue from a given tick (used by Reset). */
  restart(tick: number) {
    this.tick = tick
    this.counts.fill(0)
    this.inSet.fill(0)
    this.markTick.fill(-1_000_000)
    this.silent = true
  }

  private add(c: number, e: number) {
    this.inSet[c * this.n + e] = 1
    this.members[c * this.n + this.counts[c]++] = e
  }

  private removeAt(c: number, slot: number) {
    const row = c * this.n
    const e = this.members[row + slot]
    this.inSet[row + e] = 0
    this.members[row + slot] = this.members[row + --this.counts[c]]
  }

  private mark(kind: number, e: number) {
    const m = this.markNext
    this.markX[m] = this.xs[e]
    this.markY[m] = this.ys[e]
    this.markKind[m] = kind
    this.markTick[m] = this.tick
    this.markNext = (m + 1) % MAX_MARKS
  }

  /** Advance one tick: move, despawn beyond the leave radius, spawn inside the enter radius. */
  step() {
    const { n, xs, ys, grid, found, tick, radius, silent } = this
    this.wanderers.write(tick / TICK_HZ, xs, ys)
    const leave = this.leaveRadius
    const leave2 = leave * leave
    let enters = 0
    let leaves = 0
    let updates = 0
    let tiered = 0
    let checks = 0
    if (this.interest) grid.build(xs, ys, n)

    for (let c = 0; c < n; c++) {
      const row = c * n
      if (!this.interest) {
        if (this.counts[c] !== n - 1)
          for (let e = 0; e < n; e++)
            if (e !== c && this.inSet[row + e] === 0) this.add(c, e)
      } else {
        const x = xs[c]
        const y = ys[c]
        // Members only need a distance test, so no grid is needed to leave.
        for (let slot = this.counts[c] - 1; slot >= 0; slot--) {
          const e = this.members[row + slot]
          const dx = xs[e] - x
          const dy = ys[e] - y
          checks++
          if (dx * dx + dy * dy > leave2) {
            this.removeAt(c, slot)
            leaves++
            if (c === VIEWER && !silent) this.mark(-1, e)
          }
        }
        const count = grid.query(x, y, radius, xs, ys, found)
        checks += grid.checks
        for (let k = 0; k < count; k++) {
          const e = found[k]
          if (e === c || this.inSet[row + e] === 1) continue
          this.add(c, e)
          enters++
          if (c === VIEWER && !silent) this.mark(1, e)
        }
      }
      updates += this.counts[c]
      const near = radius / 2
      for (let slot = 0; slot < this.counts[c]; slot++) {
        const e = this.members[row + slot]
        const dx = xs[e] - xs[c]
        const dy = ys[e] - ys[c]
        if (isDue(dx * dx + dy * dy, near, tick, c, e, FAR_DIVISOR)) tiered++
      }
    }

    this.tick = tick + 1
    if (silent) {
      this.silent = false
      this.windowFilled = 0
      this.windowNext = 0
      this.updates = updates
      this.enters = 0
      this.leaves = 0
      return
    }
    this.updates = updates
    this.enters = enters
    this.leaves = leaves
    this.countedTicks++
    this.totalUpdates += updates
    this.totalEnters += enters
    this.totalLeaves += leaves
    this.totalTieredUpdates += tiered
    this.totalChecks += checks
    const w = this.windowNext
    this.windowUpdates[w] = updates
    this.windowEnters[w] = enters
    this.windowLeaves[w] = leaves
    this.windowNext = (w + 1) % WINDOW_TICKS
    this.windowFilled = Math.min(this.windowFilled + 1, WINDOW_TICKS)
  }

  /** Recent rates per second, over up to the last 5 s of counted ticks. */
  rates() {
    let updates = 0
    let enters = 0
    let leaves = 0
    for (let i = 0; i < this.windowFilled; i++) {
      updates += this.windowUpdates[i]
      enters += this.windowEnters[i]
      leaves += this.windowLeaves[i]
    }
    const seconds = Math.max(this.windowFilled, 1) / TICK_HZ
    return {
      messages: (updates + enters + leaves) / seconds,
      enters: enters / seconds,
      leaves: leaves / seconds,
    }
  }
}

export interface RunStats {
  ticks: number
  updates: number
  tieredUpdates: number
  baseline: number
  enters: number
  leaves: number
  checks: number
}

/** Runs a seeded simulation headlessly. */
export function simulateStats(options: InterestOptions & { seconds: number }) {
  const sim = new InterestSim(options)
  const steps = Math.round(options.seconds * TICK_HZ) + 1 // +1: initial sync
  for (let i = 0; i < steps; i++) sim.step()
  const stats: RunStats = {
    ticks: sim.countedTicks,
    updates: sim.totalUpdates,
    tieredUpdates: sim.totalTieredUpdates,
    baseline: baselineUpdates(options.n) * sim.countedTicks,
    enters: sim.totalEnters,
    leaves: sim.totalLeaves,
    checks: sim.totalChecks,
  }
  return stats
}
