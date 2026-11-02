/**
 * Snapshot interpolation: render a remote entity slightly in the past, between
 * two buffered server snapshots. Everything here is pure. `simulateRun` replays
 * one deterministic network run so the visual and the tests see the same data.
 * Times are in seconds.
 */
import { mulberry32 } from "./noise"

export interface Snapshot {
  /** Server time at which this state was captured. */
  time: number
  x: number
  y: number
}

export type SampleMode =
  | "empty" // nothing received yet
  | "waiting" // render time is older than the oldest snapshot
  | "interpolate"
  | "extrapolate"
  | "frozen" // extrapolation budget used up: hold position

export interface Sample {
  x: number
  y: number
  mode: SampleMode
  /** True when no received snapshot is at or after the render time. */
  underrun: boolean
  /** Bracketing snapshot times and blend factor while interpolating. */
  from: number
  to: number
  alpha: number
}

/** Longest extrapolation before the entity freezes, in seconds. */
export const MAX_EXTRAPOLATION = 0.1

/** Returns a copy sorted by time; a repeated time is ignored. Handles reordering. */
export function insertSnapshot<T extends Snapshot>(
  buffer: readonly T[],
  snapshot: T
): T[] {
  let i = buffer.length
  while (i > 0 && buffer[i - 1].time > snapshot.time) i--
  if (i > 0 && buffer[i - 1].time === snapshot.time) return [...buffer]
  return [...buffer.slice(0, i), snapshot, ...buffer.slice(i)]
}

/** Drops what can no longer be used: keeps the last snapshot at or before `renderTime` and everything newer. */
export function pruneBuffer<T extends Snapshot>(
  buffer: readonly T[],
  renderTime: number
): readonly T[] {
  let keep = 0
  for (let i = 0; i < buffer.length && buffer[i].time <= renderTime; i++)
    keep = i
  return keep === 0 ? buffer : buffer.slice(keep)
}

/** Snapshots still ahead of the render time: the margin left before an underrun. */
export function bufferedAhead(
  buffer: readonly Snapshot[],
  renderTime: number
): number {
  let n = 0
  for (const s of buffer) if (s.time > renderTime) n++
  return n
}

/** Reads a time-sorted buffer at `renderTime`. */
export function sampleBuffer(
  buffer: readonly Snapshot[],
  renderTime: number,
  maxExtrapolation = MAX_EXTRAPOLATION
): Sample {
  const n = buffer.length
  if (n === 0)
    return {
      x: 0,
      y: 0,
      mode: "empty",
      underrun: true,
      from: NaN,
      to: NaN,
      alpha: 0,
    }
  const first = buffer[0]
  if (renderTime < first.time)
    return {
      x: first.x,
      y: first.y,
      mode: "waiting",
      underrun: false,
      from: first.time,
      to: first.time,
      alpha: 0,
    }
  const last = buffer[n - 1]
  if (renderTime <= last.time) {
    let i = 0
    while (i < n - 2 && buffer[i + 1].time <= renderTime) i++
    const a = buffer[i]
    const b = buffer[Math.min(i + 1, n - 1)]
    const span = b.time - a.time
    const alpha = span > 0 ? (renderTime - a.time) / span : 0
    return {
      x: a.x + (b.x - a.x) * alpha,
      y: a.y + (b.y - a.y) * alpha,
      mode: "interpolate",
      underrun: false,
      from: a.time,
      to: b.time,
      alpha,
    }
  }
  // Dry: nothing newer has arrived. Coast briefly, then hold.
  const past = renderTime - last.time
  const base = {
    underrun: true,
    from: last.time,
    to: last.time,
    alpha: 0,
  }
  if (n < 2) return { x: last.x, y: last.y, mode: "frozen", ...base }
  const prev = buffer[n - 2]
  const dt = last.time - prev.time
  const coast = Math.min(past, maxExtrapolation)
  return {
    x: last.x + ((last.x - prev.x) / dt) * coast,
    y: last.y + ((last.y - prev.y) / dt) * coast,
    mode: past <= maxExtrapolation ? "extrapolate" : "frozen",
    ...base,
  }
}

/**
 * Smallest delay with no underruns: one send interval to reach the next
 * snapshot, plus worst-case jitter, plus one interval per consecutive lost
 * packet to survive. Delay is measured from the fastest packet's arrival, which
 * is what `estimateClockOffset` gives you.
 */
export function requiredDelay(
  sendInterval: number,
  jitterRange: number,
  consecutiveLosses = 0
): number {
  return (1 + consecutiveLosses) * sendInterval + jitterRange
}

/** Most snapshots ever held at once: those ahead of the render time plus the one behind it. */
export function bufferCapacity(delay: number, sendInterval: number): number {
  return Math.ceil(delay / sendInterval - 1e-9) + 1
}

/**
 * `min(arrival - serverTime)` over recent packets. The result folds together
 * clock difference and one-way latency, which cannot be separated from one
 * direction and do not need to be. Null when there are no samples.
 */
export function estimateClockOffset(
  samples: readonly { serverTime: number; arrival: number }[]
): number | null {
  if (samples.length === 0) return null
  let best = Infinity
  for (const s of samples) best = Math.min(best, s.arrival - s.serverTime)
  return best
}

/** The server's path: a figure of eight, three laps per run. Periodic in RUN_SECONDS. */
export const RUN_SECONDS = 20
const LAP = (3 * 2 * Math.PI) / RUN_SECONDS
export const PATH = { centerY: 1.35, halfWidth: 5.2, halfHeight: 2.3 }
export function truePosition(t: number): { x: number; y: number } {
  return {
    x: PATH.halfWidth * Math.sin(LAP * t),
    y: PATH.centerY + PATH.halfHeight * Math.sin(2 * LAP * t),
  }
}

export interface RunParams {
  sendHz: number
  jitterMs: number
  delayMs: number
  /** Packet loss from 0 to 1. */
  loss: number
  latencyMs?: number
  /** Client clock minus server clock. Must not change the result. */
  clockSkewMs?: number
  seed?: number
  stepHz?: number
}

export interface Packet extends Snapshot {
  /** On the client's clock. Set for lost packets too: when it would have landed. */
  arrival: number
  lost: boolean
}

export interface UnderrunEvent {
  start: number
  end: number
  x: number
  y: number
}

export interface Run {
  stepHz: number
  steps: number
  /** Client minus server time, as estimated from the packets. */
  offset: number
  /** How far the render time trails the server, in seconds. */
  lag: number
  /** All packets by send time, including a lead-in before t = 0. */
  packets: Packet[]
  renderX: Float32Array
  renderY: Float32Array
  trueX: Float32Array
  trueY: Float32Array
  /** Time of the older snapshot in the bracket, or NaN when dry. */
  fromTime: Float32Array
  toTime: Float32Array
  error: Float32Array
  buffered: Uint8Array
  underrun: Uint8Array
  /** Underruns begun so far, per step. */
  underrunsSoFar: Uint16Array
  events: UnderrunEvent[]
  underruns: number
  starvedFraction: number
  meanError: number
}

const LEAD_IN = 3

/** Same seed and rate gives the same jitter and losses, so sliders only scale them. */
function packetNoise(index: number, period: number, seed: number) {
  const wrapped = ((index % period) + period) % period
  const random = mulberry32(seed + Math.imul(wrapped + 1, 0x9e3779b1))
  random()
  return { jitter: random(), drop: random() }
}

/** Plays one periodic run: the state at the end joins up with the state at t = 0. */
export function simulateRun({
  sendHz,
  jitterMs,
  delayMs,
  loss,
  latencyMs = 50,
  clockSkewMs = 0,
  seed = 42,
  stepHz = 120,
}: RunParams): Run {
  const interval = 1 / sendHz
  const skew = clockSkewMs / 1000
  const delay = delayMs / 1000
  const period = Math.round(RUN_SECONDS * sendHz)
  const packets: Packet[] = []
  const lastIndex = Math.ceil((RUN_SECONDS + 1) * sendHz)
  for (let i = -Math.ceil(LEAD_IN * sendHz); i <= lastIndex; i++) {
    const { jitter, drop } = packetNoise(i, period, seed)
    const time = i * interval
    packets.push({
      time,
      ...truePosition(time),
      arrival: time + skew + (latencyMs + jitter * jitterMs) / 1000,
      lost: drop < loss,
    })
  }

  const received = packets.filter((p) => !p.lost)
  const offset =
    estimateClockOffset(
      received.map((p) => ({ serverTime: p.time, arrival: p.arrival }))
    ) ?? skew + latencyMs / 1000

  const queue = [...received].sort((a, b) => a.arrival - b.arrival)
  const steps = Math.round(RUN_SECONDS * stepHz)
  const run: Run = {
    stepHz,
    steps,
    offset,
    lag: offset - skew + delay,
    packets,
    renderX: new Float32Array(steps),
    renderY: new Float32Array(steps),
    trueX: new Float32Array(steps),
    trueY: new Float32Array(steps),
    fromTime: new Float32Array(steps),
    toTime: new Float32Array(steps),
    error: new Float32Array(steps),
    buffered: new Uint8Array(steps),
    underrun: new Uint8Array(steps),
    underrunsSoFar: new Uint16Array(steps),
    events: [],
    underruns: 0,
    starvedFraction: 0,
    meanError: 0,
  }

  let buffer: readonly Packet[] = []
  let next = 0
  let open: UnderrunEvent | null = null
  let starved = 0
  let errorSum = 0
  for (let s = -Math.round((LEAD_IN - 1) * stepHz); s < steps; s++) {
    const t = s / stepHz
    const local = t + skew
    while (next < queue.length && queue[next].arrival <= local)
      buffer = insertSnapshot(buffer, queue[next++])
    const renderTime = local - offset - delay
    buffer = pruneBuffer(buffer, renderTime)
    if (s < 0) continue
    const sample = sampleBuffer(buffer, renderTime)
    const truth = truePosition(t)
    const error = Math.hypot(sample.x - truth.x, sample.y - truth.y)
    run.renderX[s] = sample.x
    run.renderY[s] = sample.y
    run.trueX[s] = truth.x
    run.trueY[s] = truth.y
    run.fromTime[s] = sample.underrun ? NaN : sample.from
    run.toTime[s] = sample.underrun ? NaN : sample.to
    run.error[s] = error
    run.buffered[s] = bufferedAhead(buffer, renderTime)
    run.underrun[s] = sample.underrun ? 1 : 0
    errorSum += error
    if (sample.underrun) {
      starved++
      if (open) open.end = t
      else {
        open = { start: t, end: t, x: sample.x, y: sample.y }
        run.events.push(open)
      }
    } else open = null
    run.underrunsSoFar[s] = run.events.length
  }
  run.underruns = run.events.length
  run.starvedFraction = starved / steps
  run.meanError = errorSum / steps
  return run
}

/** Longest run of consecutive lost packets within one period. */
export function longestLossStreak(packets: readonly Packet[]): number {
  let best = 0
  let streak = 0
  for (const p of packets) {
    streak = p.lost ? streak + 1 : 0
    best = Math.max(best, streak)
  }
  return best
}
