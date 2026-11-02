import { describe, expect, it } from "vite-plus/test"

import {
  BudgetSim,
  egressBytes,
  GAME_HEADER,
  headerShare,
  IPV4_UDP_HEADER,
  IPV6_UDP_HEADER,
  kbitToBytes,
  makeEntities,
  measure,
  packetCapacity,
  refreshEstimate,
  SAFE_PAYLOAD,
  STALE_LIMIT_MS,
  tickAllowance,
  wireRate,
} from "./bandwidth-budget"

const DEFAULTS = {
  budget: kbitToBytes(32),
  sendHz: 20,
  count: 28,
  accumulator: true,
}

/** Every parameter combination the visual's sliders reach, in coarse steps. */
const sweep = () => {
  const configs = []
  for (const kbit of [16, 32, 48, 64, 96, 128])
    for (const sendHz of [5, 10, 20, 30, 60])
      for (const count of [8, 16, 32, 48, 64])
        for (const accumulator of [true, false])
          configs.push({
            budget: kbitToBytes(kbit),
            sendHz,
            count,
            accumulator,
          })
  return configs
}

describe("rate formula", () => {
  it("matches hand-computed values", () => {
    expect(kbitToBytes(32)).toBe(4000)
    expect(wireRate(172, 20)).toBe(4000) // (172 + 28) × 20
    expect(wireRate(1200, 30)).toBe(36840) // 1228 × 30
    expect(wireRate(1200, 60, IPV6_UDP_HEADER)).toBe(74880) // 1248 × 60
    expect(IPV4_UDP_HEADER).toBe(20 + 8)
    expect(IPV6_UDP_HEADER).toBe(40 + 8)
  })

  it("computes the header share and what a slower rate saves", () => {
    expect(headerShare(172)).toBeCloseTo(0.14, 10)
    // Headers per second at 20 Hz and at 10 Hz.
    expect(wireRate(0, 20)).toBe(560)
    expect(wireRate(0, 10)).toBe(280)
  })

  it("computes capacity from the budget and caps it at the MTU limit", () => {
    expect(tickAllowance(4000, 20)).toBe(200)
    expect(packetCapacity(4000, 20)).toBe(172)
    expect(packetCapacity(16000, 5)).toBe(SAFE_PAYLOAD)
    expect(packetCapacity(2000, 60)).toBe(5)
    expect(packetCapacity(1000, 60)).toBe(0)
  })

  it("computes egress as clients × rate × time", () => {
    expect(egressBytes(100, 4000, 3600)).toBe(1.44e9)
    expect(egressBytes(1000, 4000, 30 * 24 * 3600)).toBe(10_368e9)
  })
})

describe("budget and MTU", () => {
  it("never exceeds the budget in any one-second window, or the MTU limit", () => {
    for (const config of sweep()) {
      const sim = new BudgetSim(config)
      const ticks = config.sendHz * 30
      const wire = new Int32Array(ticks)
      let windowSum = 0
      let worstWindow = 0
      let worstWire = 0
      let worstPayload = 0
      for (let t = 0; t < ticks; t++) {
        sim.step()
        wire[t] = sim.wire
        windowSum += sim.wire
        if (t >= config.sendHz) windowSum -= wire[t - config.sendHz]
        worstWindow = Math.max(worstWindow, windowSum)
        worstWire = Math.max(worstWire, sim.wire)
        worstPayload = Math.max(worstPayload, sim.payload)
      }
      expect(worstWindow).toBeLessThanOrEqual(config.budget)
      expect(worstWire).toBeLessThanOrEqual(sim.allowance)
      expect(worstPayload).toBeLessThanOrEqual(SAFE_PAYLOAD)
    }
  }, 30_000)

  it("honours a lower MTU limit and the larger IPv6 header", () => {
    const m = measure(
      {
        budget: kbitToBytes(128),
        sendHz: 5,
        count: 64,
        accumulator: true,
        mtuPayload: 500,
        header: IPV6_UDP_HEADER,
      },
      60
    )
    expect(m.maxPayload).toBeLessThanOrEqual(500)
    expect(m.maxWire).toBeLessThanOrEqual(548)
  })

  it("lets the MTU limit, not the budget, cap a low send rate", () => {
    const config = {
      budget: kbitToBytes(128),
      sendHz: 5,
      count: 64,
      accumulator: true,
    }
    const m = measure(config, 120)
    expect(m.maxWire).toBeLessThanOrEqual(1228)
    expect(m.maxWire).toBeGreaterThan(1200)
    // At most 1228 × 5 = 6140 B/s (49 kbit/s) of a 16,000 B/s budget.
    expect(m.bytesPerSecond).toBeLessThanOrEqual(6140)
  })

  it("sends nothing when headers alone use the budget", () => {
    const m = measure(
      { budget: kbitToBytes(16), sendHz: 60, count: 32, accumulator: true },
      10
    )
    expect(m.bytesPerSecond).toBe(0)
    expect(m.starved).toBe(32)
  })

  it("computes the packet's bytes from what it holds", () => {
    const sim = new BudgetSim(DEFAULTS)
    for (let t = 0; t < 200; t++) {
      sim.step()
      let bytes = GAME_HEADER
      for (let k = 0; k < sim.packetCount; k++)
        bytes += sim.entities.size[sim.packet[k]]
      expect(sim.payload).toBe(bytes)
      expect(sim.wire).toBe(bytes + IPV4_UDP_HEADER)
    }
  })
})

describe("priority accumulator", () => {
  it("starves nobody at the defaults: worst 950 ms over an hour", () => {
    const m = measure(DEFAULTS, 3600)
    expect(m.starved).toBe(0)
    expect(m.worstStalenessMs).toBe(950)
    expect(m.worstStalenessMs).toBeLessThan(STALE_LIMIT_MS)
  })

  it("starves low priorities when it is off, for as long as the run lasts", () => {
    const m = measure({ ...DEFAULTS, accumulator: false }, 3600)
    expect(m.starved).toBe(22)
    expect(m.worstStalenessMs).toBe(3600 * 1000)
    // The bytes are spent either way: it only changes who gets them.
    expect(m.bytesPerSecond).toBeGreaterThan(3800)
  })

  it("starves nobody with it off if everything fits", () => {
    const m = measure(
      { budget: kbitToBytes(128), sendHz: 20, count: 16, accumulator: false },
      60
    )
    expect(m.starved).toBe(0)
    expect(m.worstStalenessMs).toBe(50)
  })

  it("stays within 1.23 × (estimate + 1) ticks wherever the largest entity fits", () => {
    let tested = 0
    let worstRatio = 0
    let worstMs = 0
    for (const config of sweep()) {
      if (!config.accumulator) continue
      const sim = new BudgetSim(config)
      const room = sim.capacity - GAME_HEADER
      if (room < 32) continue
      tested++
      const m = measure(config, 120)
      expect(m.starved).toBe(0)
      const entities = makeEntities(config.count)
      const estimate = refreshEstimate(entities, config.count - 1, room)
      const peakTicks = (m.worstStalenessMs * config.sendHz) / 1000
      const ratio = peakTicks / (Math.max(estimate, 1) + 1)
      expect(ratio, JSON.stringify(config)).toBeLessThanOrEqual(1.23)
      worstRatio = Math.max(worstRatio, ratio)
      worstMs = Math.max(worstMs, m.worstStalenessMs)
    }
    expect(tested).toBe(135)
    expect(worstRatio).toBeGreaterThan(1)
    expect(worstMs).toBe(5700) // 16 kbit/s, 20 Hz, 64 entities
  }, 30_000)

  it("cannot save an entity larger than the packet", () => {
    const config = {
      budget: kbitToBytes(16),
      sendHz: 35,
      count: 28,
      accumulator: true,
    }
    const sim = new BudgetSim(config)
    const room = sim.capacity - GAME_HEADER
    expect(room).toBe(21)
    for (let t = 0; t < 35 * 300; t++) sim.step()
    for (let i = 0; i < config.count; i++) {
      if (sim.entities.size[i] > room) expect(sim.sends[i]).toBe(0)
      else expect(sim.sends[i]).toBeGreaterThan(0)
    }
  })

  it("sends high priorities more often", () => {
    const sim = new BudgetSim(DEFAULTS)
    for (let t = 0; t < 24000; t++) sim.step()
    expect(sim.sends[0]).toBeGreaterThan(sim.sends[10])
    expect(sim.sends[10]).toBeGreaterThan(sim.sends[27])
  })

  it("replays exactly", () => {
    const a = new BudgetSim(DEFAULTS)
    const b = new BudgetSim(DEFAULTS)
    for (let t = 0; t < 500; t++) {
      a.step()
      b.step()
      expect(Array.from(a.packet.subarray(0, a.packetCount))).toEqual(
        Array.from(b.packet.subarray(0, b.packetCount))
      )
    }
  })
})

describe("send rate at a fixed budget", () => {
  const at = (sendHz: number) => measure({ ...DEFAULTS, sendHz }, 120)

  it("spends more on headers and updates fewer entities as it rises", () => {
    expect(at(10).headerFraction).toBeCloseTo(0.071, 2)
    expect(at(20).headerFraction).toBeCloseTo(0.145, 2)
    expect(at(60).headerFraction).toBeCloseTo(0.462, 2)
    expect(at(10).updatesPerSecond).toBeGreaterThan(at(20).updatesPerSecond)
    expect(at(20).updatesPerSecond).toBeGreaterThan(at(60).updatesPerSecond)
    expect(at(60).worstStalenessMs).toBeGreaterThan(at(20).worstStalenessMs)
  })
})
