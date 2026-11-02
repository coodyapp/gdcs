import { describe, expect, it } from "vite-plus/test"

import {
  acceptedRewind,
  clampRewind,
  CYCLE,
  historyCapacity,
  hitsSoFar,
  holderReactionBudget,
  isHolding,
  LANE,
  laneHistory,
  laneTime,
  pushTick,
  rayEntersBox,
  resolveShot,
  sampleHistory,
  shotsFired,
  SHOTS_PER_CYCLE,
  shotTime,
  simulateLane,
  targetOffset,
  targetPosition,
  totalDelay,
  type LaneParams,
  type Tick,
} from "./lag-compensation"

const history: Tick[] = [
  { time: 1, x: 0, y: 0 },
  { time: 1.1, x: 1, y: 2 },
  { time: 1.2, x: 3, y: 2 },
]

const lane = (over: Partial<LaneParams> = {}): LaneParams => ({
  latency: 0.15,
  interp: 0.1,
  compensation: true,
  maxRewind: 0.4,
  ...over,
})

describe("sampleHistory", () => {
  it("returns the stored tick at a tick time", () => {
    for (const t of history) {
      const out = sampleHistory(history, t.time)
      expect(out.x).toBeCloseTo(t.x, 9)
      expect(out.y).toBeCloseTo(t.y, 9)
    }
  })

  it("interpolates between the two ticks around the time", () => {
    const mid = sampleHistory(history, 1.05)
    expect(mid.x).toBeCloseTo(0.5, 9)
    expect(mid.y).toBeCloseTo(1, 9)
    expect(sampleHistory(history, 1.175).x).toBeCloseTo(2.5, 9)
  })

  it("recovers linear motion exactly between ticks, unlike the nearest tick", () => {
    const ticks = Array.from({ length: 31 }, (_, i) => ({
      time: i / 30,
      x: 5 * (i / 30),
      y: 0,
    }))
    let worstNearest = 0
    for (let t = 0.1; t < 0.9; t += 0.0013) {
      expect(sampleHistory(ticks, t).x).toBeCloseTo(5 * t, 9)
      worstNearest = Math.max(
        worstNearest,
        Math.abs(ticks[Math.round(t * 30)].x - 5 * t)
      )
    }
    expect(worstNearest).toBeCloseTo(5 / 30 / 2, 2)
  })

  it("holds the ends outside the stored range", () => {
    expect(sampleHistory(history, 0).x).toBe(0)
    expect(sampleHistory(history, 9).x).toBe(3)
  })

  it("writes into the caller's object", () => {
    const out = { x: 9, y: 9 }
    expect(sampleHistory(history, 1, out)).toBe(out)
    expect(out.x).toBe(0)
  })

  it("rejects an empty history", () => {
    expect(() => sampleHistory([], 0)).toThrow()
  })
})

describe("history storage", () => {
  it("keeps only the newest ticks", () => {
    let h: Tick[] = []
    for (let i = 0; i < 10; i++) h = pushTick(h, { time: i, x: i, y: 0 }, 4)
    expect(h.map((t) => t.time)).toEqual([6, 7, 8, 9])
  })

  it("capacity always brackets now - maxRewind, wherever now falls in a tick", () => {
    for (const [maxRewind, hz] of [
      [0.25, 60],
      [0.25, 30],
      [0.2, 128],
      [0.1, 20],
    ]) {
      const capacity = historyCapacity(maxRewind, hz)
      for (let f = 0; f < 0.999; f += 0.1) {
        const now = 100 + f / hz
        const newest = Math.floor(now * hz)
        const oldest = (newest - capacity + 1) / hz
        expect(oldest).toBeLessThanOrEqual(now - maxRewind)
      }
    }
    expect(historyCapacity(0.25, 60)).toBe(17)
  })
})

describe("delay and rewind", () => {
  it("total delay is the round trip plus interpolation", () => {
    expect(totalDelay(0.15, 0.1)).toBeCloseTo(0.25, 9)
  })

  it("offset equals speed times total delay", () => {
    for (const [latency, interp] of [
      [0.05, 0.05],
      [0.15, 0.1],
      [0.3, 0.2],
    ]) {
      const run = simulateLane(lane({ latency, interp }))
      expect(run.offset).toBeCloseTo(LANE.speed * (latency + interp), 9)
      for (const s of run.shots)
        expect(Math.abs(s.truth.x - s.aim.x)).toBeCloseTo(run.offset, 9)
    }
    expect(targetOffset(-5, 0.2)).toBeCloseTo(1, 9)
  })

  it("rewind beyond the cap clamps", () => {
    expect(clampRewind(0.3, 0.2)).toBe(0.2)
    expect(clampRewind(0.1, 0.2)).toBe(0.1)
    expect(clampRewind(-0.1, 0.2)).toBe(0)
    const run = simulateLane(
      lane({ latency: 0.3, interp: 0.2, maxRewind: 0.2 })
    )
    expect(run.rewind).toBe(0.2)
    expect(run.capped).toBe(true)
    for (const s of run.shots) {
      const expected = targetPosition(s.time - 0.2).x
      expect(s.tested.x).toBeCloseTo(expected, 9)
    }
  })

  it("the server caps what a client claims it saw", () => {
    const base = {
      now: 10,
      measuredLatency: 0.1,
      interp: 0.1,
      tolerance: 0.02,
      maxRewind: 0.4,
    }
    expect(acceptedRewind({ ...base, claimedViewTime: 9.8 })).toBeCloseTo(
      0.2,
      9
    )
    // A forged old timestamp ("backtrack") is limited by the measured latency.
    expect(acceptedRewind({ ...base, claimedViewTime: 9 })).toBeCloseTo(0.22, 9)
    // A real but extreme latency is limited by the cap.
    expect(
      acceptedRewind({ ...base, measuredLatency: 0.6, claimedViewTime: 9 })
    ).toBe(0.4)
    // A timestamp from the future does not reach ahead of the server.
    expect(acceptedRewind({ ...base, claimedViewTime: 11 })).toBe(0)
  })
})

describe("rayEntersBox", () => {
  const o = { x: 0, y: 0 }
  it("reports where the ray enters", () => {
    expect(rayEntersBox(o, { x: 0, y: 2 }, { x: 0, y: 2 }, 0.5)).toBeCloseTo(
      0.75,
      9
    )
  })
  it("misses to the side and behind the origin", () => {
    expect(rayEntersBox(o, { x: 0, y: 2 }, { x: 2, y: 2 }, 0.5)).toBe(-1)
    expect(rayEntersBox(o, { x: 0, y: 2 }, { x: 0, y: -2 }, 0.5)).toBe(-1)
  })
  it("handles an origin inside the box", () => {
    expect(rayEntersBox(o, { x: 1, y: 1 }, o, 0.5)).toBe(0)
  })
})

describe("simulateLane", () => {
  it("every shot aimed at the seen position hits with compensation", () => {
    for (const latency of [0, 0.05, 0.15, 0.3])
      for (const interp of [0, 0.1, 0.2]) {
        const run = simulateLane(lane({ latency, interp, maxRewind: 0.5 }))
        expect(run.hits).toBe(SHOTS_PER_CYCLE)
        // The rewound hitbox is exactly what the shooter saw.
        for (const s of run.shots) expect(s.tested.x).toBeCloseTo(s.aim.x, 9)
      }
  })

  it("the same shots miss without compensation at speed", () => {
    for (const latency of [0.1, 0.15, 0.3])
      for (const interp of [0.05, 0.1, 0.2]) {
        const run = simulateLane(lane({ latency, interp, compensation: false }))
        expect(run.rewind).toBe(0)
        expect(run.hits).toBe(0)
        for (const s of run.shots) expect(s.entry).toBe(-1)
      }
  })

  it("the uncompensated shot lands once the delay is small enough", () => {
    const run = simulateLane(
      lane({ latency: 0.02, interp: 0, compensation: false })
    )
    expect(run.hits).toBe(SHOTS_PER_CYCLE)
  })

  it("a cap well below the delay brings the misses back", () => {
    const run = simulateLane(
      lane({ latency: 0.3, interp: 0.2, maxRewind: 0.2 })
    )
    expect(run.hits).toBe(0)
  })

  it("resolves a test on the rewound position, not the present", () => {
    const hist = laneHistory()
    const now = shotTime(1)
    const aim = targetPosition(now - 0.25)
    const on = resolveShot({
      history: hist,
      now,
      shooter: LANE.shooter,
      aim,
      rewind: 0.25,
      compensation: true,
      half: LANE.half,
    })
    expect(on.rewind).toBe(0.25)
    expect(on.tested.x).toBeCloseTo(aim.x, 9)
  })

  it("is deterministic and never straddles a turn at the largest delay", () => {
    const params = lane({ latency: 0.3, interp: 0.2, maxRewind: 0.5 })
    expect(simulateLane(params)).toEqual(simulateLane(params))
    for (const s of simulateLane(params).shots)
      expect(Math.abs(s.truth.x - s.aim.x)).toBeCloseTo(2.5, 9)
  })
})

describe("target path", () => {
  it("returns to the start after a cycle and stays in the lane", () => {
    expect(targetPosition(CYCLE).x).toBeCloseTo(targetPosition(0).x, 9)
    for (let t = -3; t < 6; t += 0.07) {
      expect(Math.abs(targetPosition(t).x)).toBeLessThanOrEqual(
        LANE.halfWidth + 1e-9
      )
    }
  })
  it("moves at the stated speed away from turns", () => {
    expect(targetPosition(0.6).x - targetPosition(0.5).x).toBeCloseTo(
      LANE.speed * 0.1,
      9
    )
  })
})

describe("clock", () => {
  const period = LANE.shotInterval + LANE.hold
  it("freezes simulated time while a shot is held", () => {
    const at = shotTime(0)
    expect(laneTime(at)).toBeCloseTo(at, 9)
    expect(laneTime(at + LANE.hold / 2)).toBeCloseTo(at, 9)
    expect(isHolding(at + LANE.hold / 2)).toBe(true)
    expect(isHolding(at + LANE.hold + 0.01)).toBe(false)
    expect(isHolding(0)).toBe(false)
    expect(laneTime(period)).toBeCloseTo(LANE.shotInterval, 9)
  })

  it("is monotonic and reaches every shot time", () => {
    let prev = -1
    for (let c = 0; c < 10; c += 0.01) {
      const t = laneTime(c)
      expect(t).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = t
    }
    expect(laneTime(shotTime(0) + period)).toBeCloseTo(shotTime(1), 9)
  })

  it("counts shots and hits across laps", () => {
    expect(shotsFired(0)).toBe(0)
    expect(shotsFired(shotTime(0))).toBe(1)
    expect(shotsFired(shotTime(0) + period * 5)).toBe(6)
    const run = simulateLane(lane())
    expect(hitsSoFar(run, SHOTS_PER_CYCLE * 2 + 1)).toBe(
      SHOTS_PER_CYCLE * 2 + 1
    )
    expect(hitsSoFar(simulateLane(lane({ compensation: false })), 6)).toBe(0)
  })
})

describe("peeker's advantage", () => {
  it("matches replaying the two shots as events", () => {
    const up = 0.02 // peeker to server
    const serverBuffer = 0.016
    const down = 0.0175 // server to holder
    const clientBuffer = 0.05
    const holderUp = 0.0175 // holder to server
    const peekerReaction = 0.25
    const peekerShotProcessed = peekerReaction + up + serverBuffer
    const holderSeesPeeker = up + serverBuffer + down + clientBuffer
    const budget = holderReactionBudget(
      peekerReaction,
      down + holderUp,
      serverBuffer + clientBuffer
    )
    const holderShotProcessed =
      holderSeesPeeker + budget + holderUp + serverBuffer
    expect(holderShotProcessed).toBeCloseTo(peekerShotProcessed, 9)
  })
})
