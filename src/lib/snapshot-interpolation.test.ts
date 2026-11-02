import { describe, expect, it } from "vite-plus/test"

import {
  bufferCapacity,
  bufferedAhead,
  estimateClockOffset,
  insertSnapshot,
  longestLossStreak,
  MAX_EXTRAPOLATION,
  pruneBuffer,
  requiredDelay,
  RUN_SECONDS,
  sampleBuffer,
  simulateRun,
  truePosition,
  type Snapshot,
} from "./snapshot-interpolation"

const snap = (time: number, x = time * 10, y = 0): Snapshot => ({ time, x, y })

describe("sampleBuffer", () => {
  const buffer = [snap(1), snap(1.1), snap(1.2)]

  it("returns the snapshot itself at a snapshot time", () => {
    for (const s of buffer) {
      const out = sampleBuffer(buffer, s.time)
      expect(out.x).toBeCloseTo(s.x, 9)
      expect(out.mode).toBe("interpolate")
      expect(out.underrun).toBe(false)
    }
  })

  it("blends linearly between snapshots", () => {
    const out = sampleBuffer(buffer, 1.025)
    expect(out.x).toBeCloseTo(10.25, 9)
    expect(out.from).toBe(1)
    expect(out.to).toBe(1.1)
    expect(out.alpha).toBeCloseTo(0.25, 9)
  })

  it("interpolates across a gap left by a lost packet", () => {
    const out = sampleBuffer([snap(1, 0), snap(1.3, 3)], 1.1)
    expect(out.x).toBeCloseTo(1, 9)
    expect(out.underrun).toBe(false)
  })

  it("waits at the oldest snapshot before the buffer begins", () => {
    const out = sampleBuffer(buffer, 0.5)
    expect(out.mode).toBe("waiting")
    expect(out.x).toBe(10)
    expect(out.underrun).toBe(false)
  })

  it("flags an underrun, coasts, then freezes", () => {
    const coast = sampleBuffer(buffer, 1.25)
    expect(coast.underrun).toBe(true)
    expect(coast.mode).toBe("extrapolate")
    expect(coast.x).toBeCloseTo(12.5, 9)

    const frozen = sampleBuffer(buffer, 1.2 + MAX_EXTRAPOLATION + 1)
    expect(frozen.underrun).toBe(true)
    expect(frozen.mode).toBe("frozen")
    expect(frozen.x).toBeCloseTo(12 + MAX_EXTRAPOLATION * 10, 9)
  })

  it("does not count the exact newest snapshot as an underrun", () => {
    expect(sampleBuffer(buffer, 1.2).underrun).toBe(false)
    expect(sampleBuffer(buffer, 1.2001).underrun).toBe(true)
  })

  it("handles an empty and a single-entry buffer", () => {
    expect(sampleBuffer([], 1).mode).toBe("empty")
    expect(sampleBuffer([snap(1)], 2).mode).toBe("frozen")
  })
})

describe("out-of-order arrival", () => {
  it("sorts by server time whatever the arrival order", () => {
    let buffer: Snapshot[] = []
    for (const t of [1.2, 1, 1.3, 1.1]) buffer = insertSnapshot(buffer, snap(t))
    expect(buffer.map((s) => s.time)).toEqual([1, 1.1, 1.2, 1.3])
  })

  it("ignores duplicates and leaves its input untouched", () => {
    const input = [snap(1), snap(2)]
    const out = insertSnapshot(input, snap(1, 99))
    expect(out).toEqual(input)
    expect(out).not.toBe(input)
    expect(insertSnapshot(input, snap(1.5))).toHaveLength(3)
    expect(input).toHaveLength(2)
  })

  it("gives the same motion as in-order delivery", () => {
    const ordered = [snap(1), snap(1.1), snap(1.2)]
    const shuffled = [ordered[2], ordered[0], ordered[1]].reduce<Snapshot[]>(
      insertSnapshot,
      []
    )
    expect(sampleBuffer(shuffled, 1.15)).toEqual(sampleBuffer(ordered, 1.15))
  })

  it("happens in the run once jitter exceeds the send interval", () => {
    const { packets } = simulateRun({
      sendHz: 20,
      jitterMs: 150,
      delayMs: 300,
      loss: 0,
    })
    const reordered = packets.some(
      (p, i) => i > 0 && p.arrival < packets[i - 1].arrival
    )
    expect(reordered).toBe(true)
  })
})

describe("buffer bookkeeping", () => {
  it("keeps one snapshot behind the render time and all ahead", () => {
    const buffer = [snap(1), snap(2), snap(3), snap(4)]
    expect(pruneBuffer(buffer, 2.5).map((s) => s.time)).toEqual([2, 3, 4])
    expect(pruneBuffer(buffer, 0.5)).toBe(buffer)
    expect(bufferedAhead(buffer, 2.5)).toBe(2)
    expect(bufferedAhead(buffer, 4)).toBe(0)
  })

  it("never needs more than bufferCapacity snapshots", () => {
    for (const sendHz of [5, 10, 20, 30])
      for (const delayMs of [100, 250, 400]) {
        const run = simulateRun({ sendHz, jitterMs: 30, delayMs, loss: 0 })
        const held = Math.max(...run.buffered) + 1
        expect(held).toBeLessThanOrEqual(
          bufferCapacity(delayMs / 1000, 1 / sendHz)
        )
      }
  })

  it("rounds capacity up without float noise", () => {
    expect(bufferCapacity(0.3, 0.1)).toBe(4)
    expect(bufferCapacity(0.25, 0.1)).toBe(4)
    expect(bufferCapacity(0.1, 0.05)).toBe(3)
  })
})

describe("estimateClockOffset", () => {
  it("finds skew plus latency from the fastest packet", () => {
    const samples = [0.03, 0, 0.02].map((jitter, i) => ({
      serverTime: i,
      arrival: i + 5 + 0.05 + jitter,
    }))
    expect(estimateClockOffset(samples)).toBeCloseTo(5.05, 9)
    expect(estimateClockOffset([])).toBeNull()
  })

  it("makes the run independent of the client's clock", () => {
    const params = { sendHz: 10, jitterMs: 30, delayMs: 200, loss: 0.05 }
    const a = simulateRun(params)
    const b = simulateRun({ ...params, clockSkewMs: 86_400_000 })
    expect(b.underruns).toBe(a.underruns)
    expect(b.lag).toBeCloseTo(a.lag, 6)
    expect(b.meanError).toBeCloseTo(a.meanError, 3)
  })
})

describe("delay versus send interval", () => {
  const rates = [5, 10, 20, 30]
  const jitters = [0, 20, 60]

  it("needs one interval plus jitter when nothing is lost", () => {
    for (const sendHz of rates)
      for (const jitterMs of jitters) {
        const need = requiredDelay(1000 / sendHz, jitterMs)
        const base = { sendHz, jitterMs, loss: 0 }
        expect(simulateRun({ ...base, delayMs: need + 1 }).underruns).toBe(0)
        expect(
          simulateRun({ ...base, delayMs: need - 10 }).underruns
        ).toBeGreaterThan(0)
      }
  })

  it("needs one more interval per consecutive lost packet", () => {
    for (const seed of [1, 2, 3, 4, 42])
      for (const loss of [0.05, 0.15]) {
        const base = { sendHz: 10, jitterMs: 30, loss, seed }
        const { packets } = simulateRun({ ...base, delayMs: 100 })
        const streak = longestLossStreak(
          packets.filter((p) => p.time >= 0 && p.time < RUN_SECONDS)
        )
        const need = requiredDelay(100, 30, streak)
        expect(simulateRun({ ...base, delayMs: need + 1 }).underruns).toBe(0)
      }
  })

  it("two intervals alone do not survive loss plus jitter", () => {
    const base = { sendHz: 10, jitterMs: 30, loss: 0.05 }
    const under = (delayMs: number) =>
      simulateRun({ ...base, delayMs }).underruns
    expect(under(200)).toBeGreaterThan(0)
    expect(under(150)).toBeGreaterThan(under(200))
    expect(under(100)).toBeGreaterThan(under(150))
  })

  it("defaults run almost clean, and dip below two intervals visibly", () => {
    const base = { sendHz: 10, jitterMs: 30, loss: 0.05 }
    expect(
      simulateRun({ ...base, delayMs: 250 }).underruns
    ).toBeLessThanOrEqual(1)
    expect(simulateRun({ ...base, delayMs: 150 }).underruns).toBeGreaterThan(5)
  })

  it("trades lag for safety: more delay means more distance from the truth", () => {
    const base = { sendHz: 10, jitterMs: 30, loss: 0 }
    const a = simulateRun({ ...base, delayMs: 150 })
    const b = simulateRun({ ...base, delayMs: 300 })
    expect(b.meanError).toBeGreaterThan(a.meanError * 1.3)
    expect(b.lag - a.lag).toBeCloseTo(0.15, 6)
  })
})

describe("simulateRun", () => {
  const params = { sendHz: 10, jitterMs: 30, delayMs: 250, loss: 0.05 }

  it("is deterministic", () => {
    const a = simulateRun(params)
    const b = simulateRun(params)
    expect(b.renderX).toEqual(a.renderX)
    expect(b.events).toEqual(a.events)
  })

  it("loops seamlessly", () => {
    const run = simulateRun(params)
    const gap = Math.hypot(
      run.renderX[0] - run.renderX[run.steps - 1],
      run.renderY[0] - run.renderY[run.steps - 1]
    )
    expect(gap).toBeLessThan(0.1)
    const start = truePosition(0)
    const end = truePosition(RUN_SECONDS)
    expect(end.x).toBeCloseTo(start.x, 9)
    expect(end.y).toBeCloseTo(start.y, 9)
  })

  it("smooths: rendered steps are far smaller than snapping to each packet", () => {
    const run = simulateRun({ ...params, loss: 0 })
    let biggest = 0
    for (let i = 1; i < run.steps; i++)
      biggest = Math.max(
        biggest,
        Math.hypot(
          run.renderX[i] - run.renderX[i - 1],
          run.renderY[i] - run.renderY[i - 1]
        )
      )
    const packets = run.packets
    let snapStep = 0
    for (let i = 1; i < packets.length; i++)
      snapStep = Math.max(
        snapStep,
        Math.hypot(
          packets[i].x - packets[i - 1].x,
          packets[i].y - packets[i - 1].y
        )
      )
    expect(run.underruns).toBe(0)
    expect(biggest).toBeLessThan(snapStep / 5)
  })

  it("loses nothing at zero loss and everything at full loss", () => {
    expect(
      simulateRun({ ...params, loss: 0 }).packets.some((p) => p.lost)
    ).toBe(false)
    expect(
      simulateRun({ ...params, loss: 1 }).packets.every((p) => p.lost)
    ).toBe(true)
  })
})
