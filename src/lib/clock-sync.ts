/**
 * Estimating a server's clock on a client: the NTP four-timestamp reading, a
 * lowest-RTT sample filter, a game clock that slews or steps towards the
 * estimate, and a seeded link and drift simulator. All times are milliseconds.
 * Offset always means server minus client, so serverTime = clientTime + offset.
 */
import { readEcho } from "./network-stats"
import type { EchoStamps } from "./network-stats"
import { mulberry32 } from "./noise"

/** Samples the filter keeps. NTP's clock filter also holds eight. */
export const FILTER_WINDOW = 8
/** Fastest correction: the game clock runs at most 5% fast or slow. */
export const MAX_SLEW = 0.05
/** The slew rate is this share of the error, per second. */
export const SLEW_GAIN_PER_S = 1
/** An error beyond this would take too long to slew (5 s at 5%), so step it. */
export const STEP_THRESHOLD_MS = 250
export const TICK_MS = 20
/** Queueing delay is capped at this many times its average. */
export const QUEUE_CAP = 5

/** The error in the offset reading: half the difference between the legs. */
export const asymmetryError = (outMs: number, backMs: number) =>
  (outMs - backMs) / 2

/** An exchange reduced to what the filter needs. */
export interface OffsetSample {
  offset: number
  rtt: number
}

/** The sample with the lowest RTT, or null if none. The newest wins a tie. */
export function lowestRttSample<T extends OffsetSample>(
  samples: readonly T[]
): T | null {
  let best: T | null = null
  for (const s of samples) if (!best || s.rtt <= best.rtt) best = s
  return best
}

export function meanOffset(samples: readonly OffsetSample[]) {
  if (samples.length === 0) return NaN
  return samples.reduce((sum, s) => sum + s.offset, 0) / samples.length
}

export type Correction = "slew" | "step"

/**
 * A game clock over a monotonic local clock: gameTime = local + offset. Slewing
 * moves the offset gradually, so game time keeps rising at 95–105% speed. A
 * first sample, an error past the threshold, or step mode replaces it at once.
 */
export class SyncedClock {
  offset = 0
  /** Current correction: 0.01 means the game clock runs 1% fast. */
  rate = 0
  steps = 0
  private target: number | null = null

  constructor(
    readonly correction: Correction = "slew",
    readonly thresholdMs = STEP_THRESHOLD_MS
  ) {}

  now(localMs: number) {
    return localMs + this.offset
  }

  setTarget(target: number) {
    const first = this.target === null
    this.target = target
    if (
      first ||
      this.correction === "step" ||
      Math.abs(target - this.offset) > this.thresholdMs
    ) {
      if (!first && target !== this.offset) this.steps++
      this.offset = target
    }
  }

  advance(localDtMs: number) {
    if (this.target === null || this.correction === "step") {
      this.rate = 0
      return
    }
    const wanted = ((this.target - this.offset) * SLEW_GAIN_PER_S) / 1000
    this.rate = Math.min(MAX_SLEW, Math.max(-MAX_SLEW, wanted))
    this.offset += this.rate * localDtMs
  }
}

export type JitterShape = "queueing" | "uniform"

export interface ClockSyncConfig {
  /** Average of the two legs' fixed delays. */
  baseMs: number
  /** Out leg minus back leg, split evenly either side of the base. */
  asymmetryMs: number
  /** Average random delay added to each leg. */
  jitterMs: number
  /** Queueing: skewed, mostly small with a long tail. Uniform: 0 to 2 × jitter. */
  jitterShape?: JitterShape
  /** More average random delay on the out leg only, as a busy uplink adds. */
  uplinkQueueMs?: number
  /** The server holds each ping for up to this long before answering. */
  holdMs?: number
  /** Server minus client at time zero. */
  initialOffsetMs: number
  /** How fast the true offset grows: 100 means 0.1 ms per second. */
  driftPpm: number
  durationMs: number
  pingHz: number
  /** Pick the lowest-RTT recent sample; otherwise use each new sample as is. */
  filter: boolean
  correction: Correction
  seed?: number
}

export interface Exchange extends EchoStamps, OffsetSample {
  /** Position in send order. */
  index: number
  /** All in server time. */
  sentAt: number
  outMs: number
  holdMs: number
  backMs: number
  arrivedAt: number
}

export interface ClockSyncRun {
  /** In send order. Queueing can reorder arrivals, so sort by `arrivedAt` to replay. */
  exchanges: Exchange[]
  /** Per tick of TICK_MS, from zero. All offsets are server minus client. */
  offset: Float64Array
  rate: Float64Array
  /** Estimate minus true offset. Positive puts the game clock ahead of the server. */
  error: Float64Array
  gameTime: Float64Array
  /** The step applied in each tick: negative moves game time backwards. */
  jump: Float64Array
  /** Index in `exchanges` of the sample behind the target, or -1. */
  picked: Int32Array
  steps: number
}

export const trueOffsetAt = (
  config: Pick<ClockSyncConfig, "initialOffsetMs" | "driftPpm">,
  serverMs: number
) => config.initialOffsetMs + config.driftPpm * 1e-6 * serverMs

/** One seeded random delay. Every leg draws once, whatever the shape or size. */
function legDelay(rand: () => number, jitterMs: number, shape: JitterShape) {
  const u = rand()
  if (shape === "uniform") return u * 2 * jitterMs
  return Math.min(-jitterMs * Math.log(1 - u), QUEUE_CAP * jitterMs)
}

/** The pings of a run, each with its stamps read off the two clocks. */
export function simulateExchanges(config: ClockSyncConfig): Exchange[] {
  const {
    baseMs,
    asymmetryMs,
    jitterMs,
    jitterShape = "queueing",
    uplinkQueueMs = 0,
    holdMs = 0,
    durationMs,
    pingHz,
    seed = 7,
  } = config
  const rand = mulberry32(seed)
  const clientAt = (s: number) => s - trueOffsetAt(config, s)
  const exchanges: Exchange[] = []
  const interval = 1000 / pingHz
  for (let i = 0; i * interval < durationMs; i++) {
    const sentAt = i * interval
    const outMs =
      baseMs +
      asymmetryMs / 2 +
      legDelay(rand, jitterMs + uplinkQueueMs, jitterShape)
    const backMs =
      baseMs - asymmetryMs / 2 + legDelay(rand, jitterMs, jitterShape)
    const hold = rand() * holdMs
    const stamps = {
      t1: clientAt(sentAt),
      t2: sentAt + outMs,
      t3: sentAt + outMs + hold,
      t4: clientAt(sentAt + outMs + hold + backMs),
    }
    exchanges.push({
      ...stamps,
      ...readEcho(stamps),
      index: i,
      sentAt,
      outMs,
      holdMs: hold,
      backMs,
      arrivedAt: sentAt + outMs + hold + backMs,
    })
  }
  return exchanges
}

/** Runs the exchanges through the filter and the clock, one tick at a time. */
export function simulateClockSync(config: ClockSyncConfig): ClockSyncRun {
  const exchanges = simulateExchanges(config)
  const arrivals = [...exchanges].sort((a, b) => a.arrivedAt - b.arrivedAt)
  const ticks = Math.ceil(config.durationMs / TICK_MS) + 1
  const run: ClockSyncRun = {
    exchanges,
    offset: new Float64Array(ticks),
    rate: new Float64Array(ticks),
    error: new Float64Array(ticks),
    gameTime: new Float64Array(ticks),
    jump: new Float64Array(ticks),
    picked: new Int32Array(ticks).fill(-1),
    steps: 0,
  }
  const clock = new SyncedClock(config.correction)
  const window: Exchange[] = []
  const clientAt = (s: number) => s - trueOffsetAt(config, s)
  let next = 0
  let picked = -1
  for (let k = 0; k < ticks; k++) {
    const s = k * TICK_MS
    const before = clock.offset
    while (next < arrivals.length && arrivals[next].arrivedAt <= s) {
      const arrival = arrivals[next++]
      window.push(arrival)
      if (window.length > FILTER_WINDOW) window.shift()
      const chosen = config.filter ? lowestRttSample(window)! : arrival
      picked = chosen.index
      clock.setTarget(chosen.offset)
    }
    run.jump[k] = clock.offset - before
    if (k > 0) clock.advance(clientAt(s) - clientAt(s - TICK_MS))
    run.offset[k] = clock.offset
    run.rate[k] = clock.rate
    run.error[k] = clock.offset - trueOffsetAt(config, s)
    run.gameTime[k] = clock.now(clientAt(s))
    run.picked[k] = picked
  }
  run.steps = clock.steps
  return run
}

export interface ErrorStats {
  rms: number
  /** Largest size of the error. */
  max: number
  /** Mean of the signed error, which shows a constant bias. */
  mean: number
}

function statsOf(errors: readonly number[]): ErrorStats {
  let squares = 0
  let max = 0
  let sum = 0
  for (const e of errors) {
    squares += e * e
    max = Math.max(max, Math.abs(e))
    sum += e
  }
  return {
    rms: Math.sqrt(squares / errors.length),
    max,
    mean: sum / errors.length,
  }
}

/** Error of the clock from `fromMs` on, which skips the settling after connect. */
export function runErrorStats(run: ClockSyncRun, fromMs = 0) {
  return statsOf(Array.from(run.error.subarray(Math.ceil(fromMs / TICK_MS))))
}

/** How many steps moved game time backwards, and the biggest of them. */
export function backwardJumps(run: ClockSyncRun, fromMs = 0) {
  let count = 0
  let largest = 0
  for (let k = Math.ceil(fromMs / TICK_MS); k < run.jump.length; k++) {
    if (run.jump[k] < 0) {
      count++
      largest = Math.max(largest, -run.jump[k])
    }
  }
  return { count, largest }
}

/**
 * Three ways to read each arrival's offset, each scored against the true offset
 * at that moment: the raw sample, the mean of the window, and its lowest-RTT
 * sample. Needs no clock, so it compares the estimators and nothing else.
 */
export function compareEstimators(
  config: ClockSyncConfig,
  windowSize = FILTER_WINDOW
) {
  const arrivals = simulateExchanges(config).sort(
    (a, b) => a.arrivedAt - b.arrivedAt
  )
  const raw: number[] = []
  const averaged: number[] = []
  const lowest: number[] = []
  for (let i = windowSize - 1; i < arrivals.length; i++) {
    const window = arrivals.slice(i - windowSize + 1, i + 1)
    const truth = trueOffsetAt(config, arrivals[i].arrivedAt)
    raw.push(arrivals[i].offset - truth)
    averaged.push(meanOffset(window) - truth)
    lowest.push(lowestRttSample(window)!.offset - truth)
  }
  return {
    raw: statsOf(raw),
    mean: statsOf(averaged),
    lowestRtt: statsOf(lowest),
  }
}
