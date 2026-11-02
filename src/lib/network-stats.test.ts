import { describe, expect, it } from "vite-plus/test"

import {
  JITTER_GAIN,
  lastAtOrBefore,
  lossPercentAt,
  mean,
  percentile,
  readEcho,
  samplesToSettle,
  simulateLink,
  SRTT_ALPHA,
  updateJitter,
  updateRtt,
  type RttEstimate,
} from "./network-stats"

describe("readEcho", () => {
  const stamps = { t1: 1000, t2: 5030, t3: 5045, t4: 1115 }

  it("removes the server's hold time from the RTT", () => {
    expect(readEcho(stamps).rtt).toBe(100)
  })

  it("gets the same RTT whatever the server's clock reads", () => {
    const shifted = { ...stamps, t2: stamps.t2 + 777, t3: stamps.t3 + 777 }
    expect(readEcho(shifted).rtt).toBe(readEcho(stamps).rtt)
  })

  it("cannot tell an asymmetric path from a clock offset", () => {
    // Out 30, back 70, clocks agree.
    const slowBack = { t1: 0, t2: 30, t3: 30, t4: 100 }
    // Out 50, back 50, server clock 20 behind.
    const offsetClock = { t1: 0, t2: 50 - 20, t3: 50 - 20, t4: 100 }
    expect(slowBack).toEqual(offsetClock)
    expect(readEcho(slowBack)).toEqual({ rtt: 100, offset: -20 })
  })
})

describe("updateRtt (RFC 6298)", () => {
  it("matches the formulas worked by hand", () => {
    let e = updateRtt(null, 100)
    expect(e).toEqual({ srtt: 100, rttvar: 50 })
    e = updateRtt(e, 120)
    // RTTVAR = 0.75 * 50 + 0.25 * |100 - 120|, SRTT = 0.875 * 100 + 0.125 * 120
    expect(e).toEqual({ srtt: 102.5, rttvar: 42.5 })
    e = updateRtt(e, 80)
    // RTTVAR = 0.75 * 42.5 + 0.25 * |102.5 - 80|, SRTT = 0.875 * 102.5 + 10
    expect(e).toEqual({ srtt: 99.6875, rttvar: 37.5 })
  })

  it("converges to a constant input", () => {
    let e: RttEstimate = updateRtt(null, 200)
    for (let i = 1; i <= 200; i++) {
      const before = Math.abs(e.srtt - 100)
      e = updateRtt(e, 100)
      expect(Math.abs(e.srtt - 100)).toBeCloseTo(before * (7 / 8), 9)
    }
    expect(e.srtt).toBeCloseTo(100, 6)
    expect(e.rttvar).toBeCloseTo(0, 6)
  })
})

describe("updateJitter (RFC 3550)", () => {
  it("matches the formula worked by hand", () => {
    let j = updateJitter(0, 100, 110)
    expect(j).toBe(0.625) // 10 / 16
    j = updateJitter(j, 110, 90)
    expect(j).toBe(1.8359375) // 0.625 + (20 - 0.625) / 16
    j = updateJitter(j, 90, 90)
    expect(j).toBeCloseTo(1.72119140625, 12) // 1.8359375 * 15 / 16
  })

  it("is not affected by a constant clock offset in the transit times", () => {
    const transit = [40, 55, 42, 61, 39]
    const run = (offset: number) =>
      transit.reduce(
        (j, t, i) =>
          i === 0 ? 0 : updateJitter(j, transit[i - 1] + offset, t + offset),
        0
      )
    expect(run(123456)).toBeCloseTo(run(0), 6)
  })

  it("decays to zero when the transit time stops changing", () => {
    let j = 30
    for (let i = 0; i < 300; i++) j = updateJitter(j, 80, 80)
    expect(j).toBeCloseTo(0, 6)
  })
})

describe("samplesToSettle", () => {
  it("gives the samples needed to close 90% of a step", () => {
    expect(samplesToSettle(SRTT_ALPHA)).toBe(18)
    expect(samplesToSettle(JITTER_GAIN)).toBe(36)
    expect((7 / 8) ** 18).toBeLessThan(0.1)
    expect((7 / 8) ** 17).toBeGreaterThan(0.1)
  })
})

describe("percentile", () => {
  const values = Array.from({ length: 100 }, (_, i) => 100 - i)

  it("uses the nearest rank and leaves the input alone", () => {
    const copy = [...values]
    expect(percentile(values, 50)).toBe(50)
    expect(percentile(values, 99)).toBe(99)
    expect(percentile(values, 100)).toBe(100)
    expect(percentile(values, 0)).toBe(1)
    expect(values).toEqual(copy)
  })

  it("is NaN with no samples", () => {
    expect(percentile([], 50)).toBeNaN()
    expect(mean([])).toBeNaN()
  })
})

describe("simulateLink", () => {
  const link = { baseMs: 40, jitterMs: 40, loss: 0.05, durationMs: 60_000 }

  it("is deterministic for a seed", () => {
    expect(simulateLink(link)).toEqual(simulateLink(link))
    expect(simulateLink({ ...link, seed: 8 }).samples[0].rtt).not.toBe(
      simulateLink(link).samples[0].rtt
    )
  })

  it("keeps every RTT between the fastest and slowest possible", () => {
    for (const s of simulateLink(link).samples) {
      expect(s.rtt).toBeGreaterThanOrEqual(80)
      expect(s.rtt).toBeLessThan(160)
    }
  })

  it("settles on the constant RTT with no jitter, and J stays zero", () => {
    const { samples } = simulateLink({ ...link, jitterMs: 0, loss: 0 })
    const last = samples[samples.length - 1]
    expect(last.rtt).toBe(80)
    expect(last.srtt).toBe(80)
    expect(last.jitter).toBe(0)
    expect(last.rttvar).toBeCloseTo(0, 6)
  })

  it("gives the same delays whatever the loss", () => {
    const a = simulateLink({ ...link, loss: 0 }).pings
    const b = simulateLink({ ...link, loss: 0.3 }).pings
    expect(b.map((p) => p.outMs)).toEqual(a.map((p) => p.outMs))
  })

  it("feeds estimators in arrival order when packets overtake", () => {
    const { samples } = simulateLink({
      ...link,
      jitterMs: 200,
      loss: 0,
      durationMs: 5000,
    })
    for (let i = 1; i < samples.length; i++)
      expect(samples[i].at).toBeGreaterThanOrEqual(samples[i - 1].at)
  })

  it("compounds per-leg loss: 5% each way loses about 9.75% of pings", () => {
    const run = simulateLink({ ...link, durationMs: 600_000 })
    expect(1 - 0.95 ** 2).toBeCloseTo(0.0975, 9)
    expect(lossPercentAt(run, Infinity)).toBeCloseTo(9.608, 2)
    expect(run.samples.length).toBe(
      run.pings.filter((p) => p.lost === null).length
    )
  })

  it("reports J below the range it was given", () => {
    const { samples, pings } = simulateLink({
      ...link,
      loss: 0,
      durationMs: 600_000,
    })
    const tail = samples.slice(500)
    // On RTTs (two uniform 0..40 legs).
    const j = mean(tail.map((s) => s.jitter))
    expect(j / 40).toBeGreaterThan(0.46)
    expect(j / 40).toBeLessThan(0.49)
    const inside = tail.filter((s) => Math.abs(s.rtt - s.srtt) <= s.jitter)
    expect(inside.length / tail.length).toBeCloseTo(0.777, 2)
    // On one leg: mean |x - y| of two uniform 0..40 values is 40 / 3.
    let oneWay = 0
    let total = 0
    for (let i = 1; i < pings.length; i++) {
      oneWay = updateJitter(oneWay, pings[i - 1].outMs, pings[i].outMs)
      if (i > 500) total += oneWay
    }
    const oneWayRatio = total / (pings.length - 501) / 40
    expect(oneWayRatio).toBeGreaterThan(0.31)
    expect(oneWayRatio).toBeLessThan(0.35)
    expect(j).toBeCloseTo(18.9, 0)
    expect(mean(tail.map((s) => s.srtt))).toBeCloseTo(119.8, 0)
    expect(mean(tail.map((s) => s.rttvar))).toBeCloseTo(13.8, 0)
  })

  it("pairs with lossPercentAt and lastAtOrBefore at the run edges", () => {
    const run = simulateLink(link)
    expect(lastAtOrBefore(run.samples, -1)).toBe(-1)
    expect(lastAtOrBefore(run.samples, Infinity)).toBe(run.samples.length - 1)
    const i = lastAtOrBefore(run.samples, 5000)
    expect(run.samples[i].at).toBeLessThanOrEqual(5000)
    expect(run.samples[i + 1].at).toBeGreaterThan(5000)
    expect(lossPercentAt(run, -1)).toBe(0)
  })
})

describe("a mean hides what a percentile shows", () => {
  const link = { baseMs: 30, jitterMs: 10, loss: 0, durationMs: 60_000 }
  const rtts = (spikeMs: number) =>
    simulateLink({
      ...link,
      spikes: spikeMs
        ? [{ atMs: 30_000, durationMs: spikeMs, extraMs: 300 }]
        : [],
    }).samples.map((s) => s.rtt)

  it("a 2 s spike moves the mean 10 ms and p99 by nearly 300", () => {
    const calm = rtts(0)
    const spiky = rtts(2000)
    expect(calm.length).toBe(1200)
    expect(mean(calm)).toBeCloseTo(69.87, 1)
    expect(percentile(calm, 99)).toBeCloseTo(78.3, 1)
    expect(mean(spiky)).toBeCloseTo(79.87, 1)
    expect(percentile(spiky, 50)).toBeCloseTo(69.99, 1)
    expect(percentile(spiky, 95)).toBeCloseTo(77.98, 1)
    expect(percentile(spiky, 99)).toBeCloseTo(372.06, 1)
  })

  it("p99 misses a spike under 1% of the window; the max does not", () => {
    const shortSpike = rtts(500)
    expect(mean(shortSpike)).toBeCloseTo(72.37, 1)
    expect(percentile(shortSpike, 99)).toBeCloseTo(78.98, 1)
    expect(Math.max(...shortSpike)).toBeCloseTo(378.3, 1)
  })

  it("SRTT forgets the spike seconds later", () => {
    const { samples } = simulateLink({
      ...link,
      spikes: [{ atMs: 30_000, durationMs: 2000, extraMs: 300 }],
    })
    expect(Math.max(...samples.map((s) => s.srtt))).toBeCloseTo(368.13, 1)
    const at = lastAtOrBefore(samples, 34_000)
    expect(samples[at].srtt).toBeLessThan(75)
  })
})
