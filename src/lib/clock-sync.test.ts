import { describe, expect, it } from "vite-plus/test"

import {
  asymmetryError,
  backwardJumps,
  compareEstimators,
  lowestRttSample,
  MAX_SLEW,
  meanOffset,
  runErrorStats,
  simulateClockSync,
  simulateExchanges,
  STEP_THRESHOLD_MS,
  SyncedClock,
  TICK_MS,
  trueOffsetAt,
} from "./clock-sync"
import type { ClockSyncConfig } from "./clock-sync"
import { readEcho } from "./network-stats"

const link: ClockSyncConfig = {
  baseMs: 50,
  asymmetryMs: 0,
  jitterMs: 20,
  initialOffsetMs: 250,
  driftPpm: 0,
  durationMs: 60_000,
  pingHz: 5,
  filter: true,
  correction: "slew",
}
const TEN_MINUTES = 600_000

describe("the four-timestamp reading", () => {
  it("is exact on a symmetric path, whatever the hold time", () => {
    // Client 1000 ms behind the server, 40 ms each way, held 7 ms.
    const r = readEcho({ t1: 0, t2: 1040, t3: 1047, t4: 87 })
    expect(r.offset).toBe(1000)
    expect(r.rtt).toBe(80)
  })

  it("is exact in a run with equal legs and no drift", () => {
    const pings = simulateExchanges({ ...link, jitterMs: 0, holdMs: 30 })
    expect(pings.length).toBe(300)
    for (const p of pings) {
      expect(p.offset).toBeCloseTo(250, 9)
      expect(p.rtt).toBeCloseTo(100, 9)
    }
  })

  it("is wrong by exactly half the difference between the legs", () => {
    for (const asymmetryMs of [-60, -20, 10, 30, 90]) {
      for (const p of simulateExchanges({ ...link, asymmetryMs, seed: 3 }))
        expect(p.offset - 250).toBeCloseTo(asymmetryError(p.outMs, p.backMs), 9)
      const [still] = simulateExchanges({ ...link, asymmetryMs, jitterMs: 0 })
      expect(still.offset - 250).toBeCloseTo(asymmetryMs / 2, 9)
    }
  })

  it("cannot tell a slow leg from a different clock", () => {
    const stamps = (outMs: number, backMs: number, offset: number) => ({
      t1: 0,
      t2: outMs + offset,
      t3: outMs + offset,
      t4: outMs + backMs,
    })
    expect(stamps(30, 70, 0)).toEqual(stamps(50, 50, -20))
    expect(readEcho(stamps(30, 70, 0)).offset).toBe(-20)
  })

  it("leaves that error in the clock, however good the filter", () => {
    for (const correction of ["slew", "step"] as const) {
      const run = simulateClockSync({
        ...link,
        asymmetryMs: 30,
        jitterMs: 0,
        correction,
      })
      const { mean, max } = runErrorStats(run, 10_000)
      expect(mean).toBeCloseTo(15, 6)
      expect(max).toBeCloseTo(15, 6)
    }
  })
})

describe("filtering by RTT", () => {
  it("picks the lowest RTT, the newest on a tie, and null when empty", () => {
    const a = { offset: 1, rtt: 80 }
    const b = { offset: 2, rtt: 60 }
    const c = { offset: 3, rtt: 60 }
    expect(lowestRttSample([a, b, c])).toBe(c)
    expect(lowestRttSample([])).toBeNull()
    expect(meanOffset([a, b, c])).toBe(2)
    expect(meanOffset([])).toBeNaN()
  })

  it("bounds a sample's error by half its RTT above the fastest", () => {
    const pings = simulateExchanges({ ...link, durationMs: TEN_MINUTES })
    for (const p of pings)
      expect(Math.abs(p.offset - 250)).toBeLessThanOrEqual(
        (p.rtt - 2 * link.baseMs) / 2 + 1e-9
      )
  })

  it("beats the mean of the window on queueing jitter", () => {
    const { raw, mean, lowestRtt } = compareEstimators({
      ...link,
      durationMs: TEN_MINUTES,
    })
    // Seed 7, 10 min at 5 Hz, 20 ms average queue per leg, window of 8.
    expect(raw.rms).toBeCloseTo(13.3, 1)
    expect(mean.rms).toBeCloseTo(4.91, 1)
    expect(lowestRtt.rms).toBeCloseTo(3.47, 1)
    // It is not a better worst case.
    expect(mean.max).toBeCloseTo(18.25, 1)
    expect(lowestRtt.max).toBeCloseTo(19.99, 1)
    for (const seed of [1, 2, 3, 4, 5]) {
      const r = compareEstimators({ ...link, seed })
      expect(r.lowestRtt.rms).toBeLessThan(r.mean.rms)
    }
  })

  it("beats filtering on the offset itself", () => {
    const arrivals = simulateExchanges({ ...link, durationMs: TEN_MINUTES })
      .sort((a, b) => a.arrivedAt - b.arrivedAt)
      .map((p) => p.offset - 250)
    const medians: number[] = []
    const minimums: number[] = []
    for (let i = 7; i < arrivals.length; i++) {
      const window = arrivals.slice(i - 7, i + 1).sort((a, b) => a - b)
      medians.push((window[3] + window[4]) / 2)
      minimums.push(window[0])
    }
    const rms = (xs: number[]) =>
      Math.sqrt(xs.reduce((sum, x) => sum + x * x, 0) / xs.length)
    expect(rms(medians)).toBeCloseTo(4.37, 1)
    expect(
      minimums.reduce((sum, x) => sum + x, 0) / minimums.length
    ).toBeCloseTo(-19.26, 1)
  })

  it("loses to the mean when jitter is uniform", () => {
    const { mean, lowestRtt } = compareEstimators({
      ...link,
      jitterShape: "uniform",
      durationMs: TEN_MINUTES,
    })
    expect(mean.rms).toBeCloseTo(3.02, 1)
    expect(lowestRtt.rms).toBeCloseTo(5.34, 1)
  })

  it("ignores a busy uplink, which biases the mean", () => {
    const { mean, lowestRtt } = compareEstimators({
      ...link,
      uplinkQueueMs: 40,
      durationMs: TEN_MINUTES,
    })
    expect(mean.mean).toBeCloseTo(19.05, 1)
    expect(lowestRtt.mean).toBeCloseTo(1.39, 1)
    expect(lowestRtt.rms).toBeLessThan(mean.rms / 3)
  })
})

describe("correcting the game clock", () => {
  const configs = [
    { filter: true, jitterMs: 20 },
    { filter: false, jitterMs: 20 },
    { filter: false, jitterMs: 60 },
    { filter: true, jitterMs: 60, asymmetryMs: -60, driftPpm: 2000 },
  ]

  it("keeps game time rising while slewing", () => {
    for (const c of configs) {
      const run = simulateClockSync({ ...link, ...c, durationMs: TEN_MINUTES })
      expect(backwardJumps(run, 1000).count).toBe(0)
      for (let k = 100; k < run.gameTime.length; k++) {
        const moved = run.gameTime[k] - run.gameTime[k - 1]
        expect(moved).toBeGreaterThanOrEqual(
          TICK_MS * (1 - MAX_SLEW) * (1 - 0.003)
        )
        expect(moved).toBeLessThanOrEqual(TICK_MS * (1 + MAX_SLEW) + 1e-6)
        expect(Math.abs(run.rate[k])).toBeLessThanOrEqual(MAX_SLEW)
      }
    }
  })

  it("jumps backwards when stepping on every estimate", () => {
    const run = (filter: boolean, correction: "slew" | "step") =>
      simulateClockSync({
        ...link,
        filter,
        correction,
        durationMs: TEN_MINUTES,
      })
    const filtered = backwardJumps(run(true, "step"), 10_000)
    const raw = backwardJumps(run(false, "step"), 10_000)
    expect(filtered.count).toBe(321)
    expect(filtered.largest).toBeCloseTo(24.05, 1)
    expect(raw.count).toBe(1473)
    expect(raw.largest).toBeCloseTo(72.89, 1)
    expect(runErrorStats(run(true, "slew"), 10_000).rms).toBeCloseTo(1.99, 1)
    expect(runErrorStats(run(true, "step"), 10_000).rms).toBeCloseTo(3.42, 1)
  })

  it("steps on the first sample and past the threshold, and only then", () => {
    const clock = new SyncedClock("slew")
    clock.setTarget(1000)
    expect(clock.offset).toBe(1000)
    expect(clock.steps).toBe(0)

    clock.setTarget(1000 + STEP_THRESHOLD_MS)
    expect(clock.offset).toBe(1000)
    expect(clock.steps).toBe(0)

    clock.setTarget(1000 + STEP_THRESHOLD_MS + 1)
    expect(clock.offset).toBe(1000 + STEP_THRESHOLD_MS + 1)
    expect(clock.steps).toBe(1)
  })

  it("caps the slew and closes a small error gradually", () => {
    const clock = new SyncedClock("slew")
    clock.setTarget(0)
    clock.setTarget(200)
    clock.advance(TICK_MS)
    expect(clock.rate).toBe(MAX_SLEW)
    expect(clock.offset).toBeCloseTo(TICK_MS * MAX_SLEW, 9)

    let ms = TICK_MS
    while (Math.abs(clock.offset - 200) > 1) {
      clock.advance(TICK_MS)
      ms += TICK_MS
    }
    // 200 ms: 3 s at the cap down to 50 ms, then an exponential tail.
    expect(ms).toBeGreaterThan(6000)
    expect(ms).toBeLessThan(8000)
  })

  it("settles straight away after connecting with a large offset", () => {
    const run = simulateClockSync({ ...link, initialOffsetMs: 30_000 })
    expect(Math.abs(run.error[0])).toBeCloseTo(30_000, 0)
    expect(run.steps).toBe(0)
    expect(Math.abs(run.error[Math.ceil(1000 / TICK_MS)])).toBeLessThan(20)
  })
})

describe("tracking drift", () => {
  const tracked = (seed: number) =>
    runErrorStats(
      simulateClockSync({
        ...link,
        driftPpm: 100,
        pingHz: 1,
        durationMs: TEN_MINUTES,
        seed,
      }),
      10_000
    )

  it("stays within a measured bound while the clocks part", () => {
    // 100 ppm, one ping a second, 20 ms average queue per leg, 10 min.
    const worst = Math.max(...[1, 2, 3, 7].map((seed) => tracked(seed).max))
    expect(worst).toBeCloseTo(14.95, 1)
    expect(tracked(7).max).toBeCloseTo(9.9, 1)
    expect(tracked(7).rms).toBeCloseTo(3.2, 1)
    // An offset read once at connect would be this far out by then.
    const drifted = trueOffsetAt({ initialOffsetMs: 0, driftPpm: 100 }, 600_000)
    expect(drifted).toBeCloseTo(60, 9)
    // With no jitter, the drift alone costs far less.
    const quiet = simulateClockSync({
      ...link,
      driftPpm: 100,
      pingHz: 1,
      jitterMs: 0,
      durationMs: TEN_MINUTES,
    })
    expect(runErrorStats(quiet, 10_000).max).toBeCloseTo(0.41, 1)
  })

  it("lags behind drift by about the gain and half the window", () => {
    const lag = (driftPpm: number, pingHz: number) =>
      runErrorStats(
        simulateClockSync({
          ...link,
          driftPpm,
          pingHz,
          durationMs: TEN_MINUTES,
        }),
        10_000
      ).mean
    expect(lag(1000, 5)).toBeCloseTo(-1.83, 1)
    expect(lag(1000, 1)).toBeCloseTo(-5.15, 1)
  })

  it("is deterministic", () => {
    const a = simulateClockSync({ ...link, driftPpm: 500 })
    const b = simulateClockSync({ ...link, driftPpm: 500 })
    expect(Array.from(a.offset)).toEqual(Array.from(b.offset))
    expect(a.exchanges).toEqual(b.exchanges)
  })
})
