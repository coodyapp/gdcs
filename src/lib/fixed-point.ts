/**
 * Why one simulation can fork across machines, and how to stop it: Q16.16
 * fixed-point arithmetic, and a chaotic ball-among-pegs world that runs on
 * either floats or integers. Pure and framework-free. Floats here use only
 * + - * / and comparisons, which ECMAScript defines exactly.
 */

/** Q16.16: a 32-bit integer holding value × 65536. */
export const FX_ONE = 65536
export const FX_MAX = 0x7fffffff
export const FX_MIN = -0x80000000

/** Nearest Q16.16 value. The rounding is what swallows tiny float differences. */
export const fxFromFloat = (x: number) => Math.round(x * FX_ONE) | 0
export const fxToFloat = (a: number) => a / FX_ONE

/** Two's-complement wraparound: FX_MAX + 1 lsb is FX_MIN. */
export const fxAdd = (a: number, b: number) => (a + b) | 0
export const fxSub = (a: number, b: number) => (a - b) | 0

/**
 * a × b, rounded down, wrapping to 32 bits. Built from 16-bit partial products,
 * so no intermediate ever touches a float: 256 × 256 wraps to exactly 0.
 */
export function fxMul(a: number, b: number): number {
  const ah = a >> 16
  const al = a & 0xffff
  const bh = b >> 16
  const bl = b & 0xffff
  return (
    (Math.imul(Math.imul(ah, bh), FX_ONE) +
      Math.imul(ah, bl) +
      Math.imul(al, bh) +
      (Math.imul(al, bl) >>> 16)) |
    0
  )
}

/**
 * a / b, truncated toward zero, wrapping to 32 bits. Division by zero saturates
 * by the sign of a, the one policy here that is a choice and not arithmetic.
 */
export function fxDiv(a: number, b: number): number {
  if (b === 0) return a < 0 ? FX_MIN : FX_MAX
  return Number(BigInt.asIntN(32, (BigInt(a) << 16n) / BigInt(b)))
}

const f64 = new Float64Array(1)
const i64 = new BigInt64Array(f64.buffer)

/**
 * Moves a double by n representable steps (units in the last place). The sign
 * of the result's step depends on the sign of x: positive n moves away from zero.
 */
export function nudgeUlps(x: number, n: number): number {
  f64[0] = x
  i64[0] += BigInt(n)
  return f64[0]
}

/** The size of one representable step at x. */
export const ulpOf = (x: number) => Math.abs(nudgeUlps(x, 1) - x)

/** FNV-1a over 32-bit words. A difference in a single word always changes it. */
export function checksum(words: Uint32Array | Int32Array): number {
  let h = 0x811c9dc5
  for (let i = 0; i < words.length; i++) {
    h = Math.imul(h ^ words[i], 0x01000193)
  }
  return h >>> 0
}

/** The raw bits of a double array, for hashing. Zero signs and NaNs count. */
export const bitsOf = (state: Float64Array) => new Uint32Array(state.buffer)

const TAU = 6.283185307179586

/**
 * Sine built only from + - * and exactly specified rounding, so every conforming
 * JavaScript engine must return the same bits. Math.sin has no such guarantee.
 */
export function ownSin(angle: number): number {
  let x = angle - TAU * Math.round(angle / TAU)
  if (x > TAU / 4) x = TAU / 2 - x
  else if (x < -TAU / 4) x = -TAU / 2 - x
  const y = x * x
  return (
    x *
    (1 +
      y *
        (-1 / 6 +
          y *
            (1 / 120 +
              y * (-1 / 5040 + y * (1 / 362880 + y * (-1 / 39916800))))))
  )
}

// --- The chaotic world: a ball bouncing among round pegs, with no friction. ---

/** Half-size of the arena for the ball's centre. */
export const ARENA_X = 97
export const ARENA_Y = 47
/** Peg radius as the ball's centre sees it: drawn peg plus ball. */
export const PEG_HIT_RADIUS = 12
export const BALL_RADIUS = 3

const PEG_RAW: readonly (readonly [number, number])[] = [
  [-75, -25],
  [-25, -25],
  [25, -25],
  [75, -25],
  [-50, 0],
  [0, 0],
  [50, 0],
  [-75, 25],
  [-25, 25],
  [25, 25],
  [75, 25],
]
export const PEGS = PEG_RAW

/** Fields of a ball, in floats or in Q16.16. */
const X = 0
const Y = 1
const VX = 2
const VY = 3

const PEGS_FX = PEG_RAW.flat().map(fxFromFloat)
const R_FX = fxFromFloat(PEG_HIT_RADIUS)
const R2_FX = fxMul(R_FX, R_FX)
const AX_FX = fxFromFloat(ARENA_X)
const AY_FX = fxFromFloat(ARENA_Y)

/** One step in floats. Pegs always in the same order: the order is part of the result. */
export function stepFloat(s: Float64Array) {
  let x = s[X] + s[VX]
  let y = s[Y] + s[VY]
  if (x > ARENA_X || x < -ARENA_X) {
    x = (x > 0 ? 2 * ARENA_X : -2 * ARENA_X) - x
    s[VX] = -s[VX]
  }
  if (y > ARENA_Y || y < -ARENA_Y) {
    y = (y > 0 ? 2 * ARENA_Y : -2 * ARENA_Y) - y
    s[VY] = -s[VY]
  }
  for (const [px, py] of PEG_RAW) {
    const dx = x - px
    const dy = y - py
    const d2 = dx * dx + dy * dy
    if (d2 >= PEG_HIT_RADIUS * PEG_HIT_RADIUS) continue
    const dot = s[VX] * dx + s[VY] * dy
    if (dot >= 0) continue // already leaving
    // v - 2 (v·d) d / (d·d): a reflection with no square root.
    const j = (2 * dot) / d2
    s[VX] -= j * dx
    s[VY] -= j * dy
  }
  s[X] = x
  s[Y] = y
}

/** The same step in Q16.16. Axis checks first, so d·d cannot overflow. */
export function stepFixed(s: Int32Array) {
  let x = fxAdd(s[X], s[VX])
  let y = fxAdd(s[Y], s[VY])
  if (x > AX_FX || x < -AX_FX) {
    x = fxSub(x > 0 ? AX_FX * 2 : -AX_FX * 2, x)
    s[VX] = -s[VX]
  }
  if (y > AY_FX || y < -AY_FX) {
    y = fxSub(y > 0 ? AY_FX * 2 : -AY_FX * 2, y)
    s[VY] = -s[VY]
  }
  for (let i = 0; i < PEGS_FX.length; i += 2) {
    const dx = fxSub(x, PEGS_FX[i])
    const dy = fxSub(y, PEGS_FX[i + 1])
    if (dx >= R_FX || dx <= -R_FX || dy >= R_FX || dy <= -R_FX) continue
    const d2 = fxAdd(fxMul(dx, dx), fxMul(dy, dy))
    if (d2 >= R2_FX) continue
    const dot = fxAdd(fxMul(s[VX], dx), fxMul(s[VY], dy))
    if (dot >= 0) continue
    const j = fxDiv(fxAdd(dot, dot), d2)
    s[VX] = fxSub(s[VX], fxMul(j, dx))
    s[VY] = fxSub(s[VY], fxMul(j, dy))
  }
  s[X] = x
  s[Y] = y
}

function mix(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 1, 0xc2b2ae35)
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  return (h ^ (h >>> 13)) >>> 0
}

/** A start clear of every peg, as x, y, vx, vy. Speed is 1–1.6 units per step. */
export function startOf(seed: number): Float64Array {
  for (let attempt = 0; ; attempt++) {
    const h = (k: number) => mix(mix(seed, attempt), k)
    const x = ((h(0) % 18000) - 9000) / 100
    const y = ((h(1) % 8000) - 4000) / 100
    const clear = PEG_RAW.every(([px, py]) => {
      const dx = x - px
      const dy = y - py
      return dx * dx + dy * dy > 4 * PEG_HIT_RADIUS * PEG_HIT_RADIUS
    })
    if (!clear) continue
    const vx = (0.7 + (h(2) % 400) / 1000) * (h(3) & 1 ? 1 : -1)
    const vy = (0.7 + (h(4) % 400) / 1000) * (h(5) & 1 ? 1 : -1)
    return Float64Array.of(x, y, vx, vy)
  }
}

export interface TwinOptions {
  seed: number
  /** Copy B's vx starts this many representable steps away from copy A's. */
  ulps: number
  /** Run on Q16.16 integers. Both starts are rounded to the grid first. */
  fixed: boolean
  /** Fixed-point only: also add this many lsb to copy B after rounding. */
  lsb?: number
  /** Apply the nudge at this step instead of at the start. */
  nudgeAtStep?: number
}

/** Two copies of one world, compared after every step. */
export class TwinRun {
  readonly fixed: boolean
  step = 0
  /** Centre distance between the copies, in world units. */
  distance = 0
  /** The first step whose checksums differ, or null while they all match. */
  firstMismatch: number | null = null
  /** Whether the checksums agree right now. A difference can round away. */
  matching = true
  /** The first step at which the centres are at least a ball radius apart. */
  splitStep: number | null = null
  splitX = 0
  splitY = 0

  private readonly floatA: Float64Array
  private readonly floatB: Float64Array
  private readonly fixedA: Int32Array
  private readonly fixedB: Int32Array
  private readonly bitsA: Uint32Array
  private readonly bitsB: Uint32Array
  private readonly opts: TwinOptions

  constructor(opts: TwinOptions) {
    this.opts = opts
    this.fixed = opts.fixed
    this.floatA = startOf(opts.seed)
    this.floatB = this.floatA.slice()
    this.bitsA = bitsOf(this.floatA)
    this.bitsB = bitsOf(this.floatB)
    this.fixedA = Int32Array.from(this.floatA, fxFromFloat)
    this.fixedB = this.fixedA.slice()
    this.applyNudge()
    this.compare()
  }

  /** Copy B's vx takes the nudge. Only rounding on the grid can absorb it. */
  private applyNudge() {
    const { ulps, lsb = 0, nudgeAtStep = 0 } = this.opts
    if (this.step !== nudgeAtStep) return
    this.floatB[VX] = nudgeUlps(this.floatB[VX], ulps)
    this.fixedB[VX] =
      nudgeAtStep === 0
        ? fxAdd(fxFromFloat(this.floatB[VX]), lsb)
        : fxAdd(this.fixedB[VX], lsb)
  }

  private compare() {
    this.matching = this.checksumOf(0) === this.checksumOf(1)
    if (!this.matching && this.firstMismatch === null) {
      this.firstMismatch = this.step
    }
    const dx = this.xOf(0) - this.xOf(1)
    const dy = this.yOf(0) - this.yOf(1)
    this.distance = Math.sqrt(dx * dx + dy * dy)
    if (this.splitStep === null && this.distance >= BALL_RADIUS) {
      this.splitStep = this.step
      this.splitX = this.xOf(0)
      this.splitY = this.yOf(0)
    }
  }

  advance() {
    if (this.fixed) {
      stepFixed(this.fixedA)
      stepFixed(this.fixedB)
    } else {
      stepFloat(this.floatA)
      stepFloat(this.floatB)
    }
    this.step++
    this.applyNudge()
    this.compare()
  }

  xOf(copy: 0 | 1) {
    if (this.fixed) return fxToFloat((copy ? this.fixedB : this.fixedA)[X])
    return (copy ? this.floatB : this.floatA)[X]
  }

  yOf(copy: 0 | 1) {
    if (this.fixed) return fxToFloat((copy ? this.fixedB : this.fixedA)[Y])
    return (copy ? this.floatB : this.floatA)[Y]
  }

  /** The checksum of one copy's whole state, right now. */
  checksumOf(copy: 0 | 1) {
    if (this.fixed) return checksum(copy ? this.fixedB : this.fixedA)
    return checksum(copy ? this.bitsB : this.bitsA)
  }

  /** Speed of copy A in units per step, for checking that nothing drifts. */
  speedOfA() {
    const [vx, vy] = this.fixed
      ? [fxToFloat(this.fixedA[VX]), fxToFloat(this.fixedA[VY])]
      : [this.floatA[VX], this.floatA[VY]]
    return Math.sqrt(vx * vx + vy * vy)
  }
}

/** Runs a twin until the copies split, or gives up. Returns the step or null. */
export function measureSplit(opts: TwinOptions, maxSteps = 20000) {
  const run = new TwinRun(opts)
  while (run.splitStep === null && run.step < maxSteps) run.advance()
  return run.splitStep
}
