/**
 * Measuring a network link the way a game can: timestamps and echoes, the
 * RFC 6298 smoothed RTT, the RFC 3550 interarrival jitter, percentiles, plus a
 * seeded link simulator. All times are milliseconds.
 */
import { mulberry32 } from "./noise"

/** RFC 6298 gains: SRTT moves 1/8 of the error, RTTVAR 1/4. */
export const SRTT_ALPHA = 1 / 8
export const RTTVAR_BETA = 1 / 4
/** RFC 3550 gain: the jitter estimate moves 1/16 of the error. */
export const JITTER_GAIN = 1 / 16
/** An echo this late counts as lost. */
export const LOSS_TIMEOUT_MS = 1000

/** One echo exchange: t1 and t4 on the client's clock, t2 and t3 on the server's. */
export interface EchoStamps {
  t1: number
  t2: number
  t3: number
  t4: number
}

/**
 * RTT excluding the server's hold time, and the clock offset (server minus
 * client). The RTT needs no shared clock. The offset is only right if both
 * directions take equally long, which the stamps cannot confirm.
 */
export function readEcho({ t1, t2, t3, t4 }: EchoStamps) {
  return {
    rtt: t4 - t1 - (t3 - t2),
    offset: (t2 - t1 + (t3 - t4)) / 2,
  }
}

export interface RttEstimate {
  srtt: number
  rttvar: number
}

/** RFC 6298 §2.2–2.3. RTTVAR must use the SRTT from before this sample. */
export function updateRtt(prev: RttEstimate | null, r: number): RttEstimate {
  if (!prev) return { srtt: r, rttvar: r / 2 }
  return {
    rttvar:
      (1 - RTTVAR_BETA) * prev.rttvar + RTTVAR_BETA * Math.abs(prev.srtt - r),
    srtt: (1 - SRTT_ALPHA) * prev.srtt + SRTT_ALPHA * r,
  }
}

/**
 * RFC 3550 §6.4.1: J += (|D| - J) / 16, where D is the change in transit time
 * between packets taken in arrival order. A constant clock offset in the
 * transit times cancels out of D.
 */
export function updateJitter(
  jitter: number,
  prevTransit: number,
  transit: number
) {
  return jitter + (Math.abs(transit - prevTransit) - jitter) * JITTER_GAIN
}

/** How many samples an EWMA of this gain needs to close all but `left` of a step. */
export function samplesToSettle(gain: number, left = 0.1) {
  return Math.ceil(Math.log(left) / Math.log(1 - gain))
}

export function mean(values: readonly number[]) {
  if (values.length === 0) return NaN
  return values.reduce((sum, x) => sum + x, 0) / values.length
}

/** Nearest-rank percentile: the smallest value with at least p% at or below it. */
export function percentile(values: readonly number[], p: number) {
  if (values.length === 0) return NaN
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.ceil((p / 100) * sorted.length)
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1]
}

export interface LagSpike {
  /** When the spike starts, by send time. */
  atMs: number
  durationMs: number
  /** Added to the client-to-server leg of every ping sent during the spike. */
  extraMs: number
}

export interface LinkConfig {
  /** Fixed delay of each leg: the fastest a packet can go. */
  baseMs: number
  /** Each leg adds a uniform random 0..jitterMs on top of the base. */
  jitterMs: number
  /** Chance of losing a packet on each leg, 0..1. */
  loss: number
  durationMs: number
  sendHz?: number
  seed?: number
  spikes?: readonly LagSpike[]
}

export interface Ping {
  sentAt: number
  /** Delay of each leg. A lost packet would have taken this long. */
  outMs: number
  backMs: number
  lost: "out" | "back" | null
  /** How far along its leg a lost packet gets, 0..1. */
  dropPoint: number
}

/** One echo received, with the estimators as they stood after it. */
export interface RttSample extends RttEstimate {
  at: number
  rtt: number
  jitter: number
}

export interface LinkRun {
  pings: Ping[]
  /** Received echoes in arrival order. */
  samples: RttSample[]
  /** Every ping once its fate is known, in that order; counts are cumulative. */
  outcomes: { at: number; resolved: number; lost: number }[]
}

const arrivalOf = (p: Ping) => p.sentAt + p.outMs + p.backMs

/**
 * Sends one ping per interval through a link. Every ping draws the same random
 * numbers whatever the config, so changing loss does not reshuffle the delays.
 */
export function simulateLink(config: LinkConfig): LinkRun {
  const {
    baseMs,
    jitterMs,
    loss,
    durationMs,
    sendHz = 20,
    seed = 7,
    spikes = [],
  } = config
  const rand = mulberry32(seed)
  const interval = 1000 / sendHz
  const pings: Ping[] = []
  for (let sentAt = 0; sentAt < durationMs; sentAt += interval) {
    const spike = spikes
      .filter((s) => sentAt >= s.atMs && sentAt < s.atMs + s.durationMs)
      .reduce((sum, s) => sum + s.extraMs, 0)
    const outMs = baseMs + rand() * jitterMs + spike
    const backMs = baseMs + rand() * jitterMs
    const lostOut = rand() < loss
    const lostBack = rand() < loss
    const dropPoint = 0.3 + rand() * 0.4
    const lost = lostOut ? "out" : lostBack ? "back" : null
    pings.push({ sentAt, outMs, backMs, lost, dropPoint })
  }

  const arrived = pings
    .filter((p) => !p.lost)
    .sort((a, b) => arrivalOf(a) - arrivalOf(b))
  const samples: RttSample[] = []
  let estimate: RttEstimate | null = null
  let jitter = 0
  let prevRtt = 0
  for (const p of arrived) {
    const rtt = p.outMs + p.backMs
    if (estimate) jitter = updateJitter(jitter, prevRtt, rtt)
    estimate = updateRtt(estimate, rtt)
    prevRtt = rtt
    samples.push({ at: arrivalOf(p), rtt, jitter, ...estimate })
  }

  let resolved = 0
  let lost = 0
  const outcomes = pings
    .map((p) => ({
      at: p.lost ? p.sentAt + LOSS_TIMEOUT_MS : arrivalOf(p),
      isLost: p.lost !== null,
    }))
    .sort((a, b) => a.at - b.at)
    .map((o) => {
      resolved++
      if (o.isLost) lost++
      return { at: o.at, resolved, lost }
    })

  return { pings, samples, outcomes }
}

/** Index of the last item with `at` <= t in a list sorted by `at`, or -1. */
export function lastAtOrBefore(items: readonly { at: number }[], t: number) {
  let lo = 0
  let hi = items.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (items[mid].at <= t) lo = mid + 1
    else hi = mid
  }
  return lo - 1
}

/** Share of pings lost among those whose fate is known at time t, as a percent. */
export function lossPercentAt(run: LinkRun, t: number) {
  const i = lastAtOrBefore(run.outcomes, t)
  if (i < 0) return 0
  return (run.outcomes[i].lost / run.outcomes[i].resolved) * 100
}
