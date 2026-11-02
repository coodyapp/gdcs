import { describe, expect, it } from "vite-plus/test"

import {
  Client,
  decodePacket,
  DeltaSim,
  encodeDelta,
  encodeFull,
  ENTITY_BYTES,
  expectedChangedShare,
  FIELDS,
  FIELD_BYTES,
  fullPacketBytes,
  HEADER_BYTES,
  LOST,
  MAX_BASELINE_AGE,
  maskBytes,
  maxPacketBytes,
  ONE_WAY_TICKS,
  packetBack,
  packetTick,
  type SimOptions,
} from "./delta-compression"
import { mulberry32 } from "./noise"

/** Steps a sim, keeping every world state so the client can be checked. */
function runChecked(options: SimOptions, ticks: number) {
  const sim = new DeltaSim(options)
  const world = new Map<number, Uint16Array>()
  let wrongTicks = 0
  let checked = 0
  let wrongEntities = 0
  for (let i = 0; i < ticks; i++) {
    const sentTick = sim.tick
    sim.step()
    world.set(sentTick, sim.state.slice())
    const got = sim.client.state
    if (!got) continue
    const want = world.get(sim.client.newestTick)!
    checked++
    let wrong = 0
    for (let e = 0; e < sim.n; e++) {
      for (let f = 0; f < FIELDS; f++) {
        if (got[e * FIELDS + f] !== want[e * FIELDS + f]) {
          wrong++
          break
        }
      }
    }
    if (wrong > 0) wrongTicks++
    wrongEntities = wrong
  }
  return { sim, wrongTicks, checked, wrongEntities }
}

function randomState(n: number, random: () => number) {
  const s = new Uint16Array(n * FIELDS)
  for (let i = 0; i < s.length; i++) {
    const bytes = FIELD_BYTES[i % FIELDS]
    s[i] = Math.floor(random() * (bytes === 2 ? 65536 : 256))
  }
  return s
}

describe("encoding", () => {
  it("full snapshots round-trip and cost header + 7N bytes", () => {
    const random = mulberry32(1)
    for (const n of [1, 7, 8, 9, 100, 400]) {
      const state = randomState(n, random)
      const out = new Uint8Array(maxPacketBytes(n))
      const length = encodeFull(state, n, 1234567, out)
      expect(length).toBe(HEADER_BYTES + n * ENTITY_BYTES)
      expect(packetTick(out)).toBe(1234567)
      expect(packetBack(out)).toBe(0)
      const decoded = new Uint16Array(n * FIELDS)
      decodePacket(out, null, decoded)
      expect(decoded).toEqual(state)
    }
  })

  it("deltas reproduce the target from the baseline for any random change", () => {
    const random = mulberry32(2)
    for (let trial = 0; trial < 300; trial++) {
      const n = 1 + Math.floor(random() * 120)
      const base = randomState(n, random)
      const target = base.slice()
      const edits = Math.floor(random() * n * 2)
      for (let k = 0; k < edits; k++) {
        const i = Math.floor(random() * target.length)
        const bytes = FIELD_BYTES[i % FIELDS]
        target[i] = Math.floor(random() * (bytes === 2 ? 65536 : 256))
      }
      const out = new Uint8Array(maxPacketBytes(n))
      encodeDelta(base, target, n, 9, 3, out)
      const decoded = new Uint16Array(n * FIELDS)
      decodePacket(out, base, decoded)
      expect(decoded).toEqual(target)
    }
  })

  it("a delta costs header + bitmask + a mask byte and the fields per changed entity", () => {
    const n = 100
    const base = new Uint16Array(n * FIELDS)
    const target = base.slice()
    const out = new Uint8Array(maxPacketBytes(n))
    // Nothing changed: header and bitmask only.
    expect(encodeDelta(base, target, n, 1, 1, out)).toBe(HEADER_BYTES + 13)
    // x and y of one entity: 1 + 2 + 2.
    target[0] = 5
    target[1] = 6
    expect(encodeDelta(base, target, n, 1, 1, out)).toBe(HEADER_BYTES + 13 + 5)
    // Health of another: 1 + 1.
    target[3 * FIELDS + 3] = 9
    expect(encodeDelta(base, target, n, 1, 1, out)).toBe(
      HEADER_BYTES + 13 + 5 + 2
    )
  })

  it("a delta with every field changed is larger than a full snapshot", () => {
    const n = 100
    const base = new Uint16Array(n * FIELDS)
    const target = new Uint16Array(n * FIELDS).fill(1)
    const out = new Uint8Array(maxPacketBytes(n))
    const length = encodeDelta(base, target, n, 1, 1, out)
    expect(length).toBe(maxPacketBytes(n))
    expect(length).toBeGreaterThan(fullPacketBytes(n))
    expect(maskBytes(n)).toBe(13)
  })
})

describe("Client", () => {
  const n = 8
  const out = new Uint8Array(maxPacketBytes(n))
  const random = mulberry32(3)
  const s0 = randomState(n, random)
  const s1 = randomState(n, random)

  it("rejects a delta whose baseline it does not hold, and stays intact", () => {
    const client = new Client(n)
    encodeFull(s0, n, 10, out)
    expect(client.receive(out)).toBe("applied")
    encodeDelta(s0, s1, n, 12, 1, out) // baseline tick 11 never arrived
    expect(client.receive(out)).toBe("no-baseline")
    expect(client.newestTick).toBe(10)
    expect(client.state).toEqual(s0)
  })

  it("ignores packets older than the newest, so reordering is harmless", () => {
    const client = new Client(n)
    encodeFull(s1, n, 20, out)
    client.receive(out)
    encodeFull(s0, n, 19, out)
    expect(client.receive(out)).toBe("stale")
    expect(client.state).toEqual(s1)
  })

  it("rejects a baseline evicted from a history that is too short", () => {
    const client = new Client(n, 4)
    encodeFull(s0, n, 100, out)
    client.receive(out)
    encodeFull(s1, n, 104, out) // same slot as 100
    client.receive(out)
    encodeDelta(s0, s1, n, 105, 5, out)
    expect(client.receive(out)).toBe("no-baseline")
    expect(client.state).toEqual(s1)
  })

  it("applies a delta against a baseline older than its newest state", () => {
    const client = new Client(n)
    encodeFull(s0, n, 30, out)
    client.receive(out)
    encodeFull(s1, n, 31, out)
    client.receive(out)
    const target = s0.slice()
    target[0] ^= 1
    encodeDelta(s0, target, n, 32, 2, out)
    expect(client.receive(out)).toBe("applied")
    expect(client.state).toEqual(target)
  })
})

describe("DeltaSim", () => {
  it("reproduces the state exactly over seeded lossy runs", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const loss of [0, 0.05, 0.2, 0.5]) {
        const { sim, wrongTicks, checked } = runChecked(
          { n: 100, share: 0.15, loss, seed },
          1200
        )
        expect(wrongTicks, `seed ${seed} loss ${loss}`).toBe(0)
        expect(checked).toBeGreaterThan(0)
        expect(sim.client.rejected).toBe(0)
        expect(sim.client.applied).toBeGreaterThan(0)
        if (loss > 0) expect(sim.lostPackets).toBeGreaterThan(0)
      }
    }
  })

  it("corrupts the client if deltas assume the last packet arrived", () => {
    const options: SimOptions = { n: 100, share: 0.15, loss: 0.1, seed: 3 }
    const safe = runChecked(options, 600)
    const broken = runChecked({ ...options, policy: "last-sent" }, 600)
    expect(safe.wrongTicks).toBe(0)
    expect(broken.wrongTicks).toBeGreaterThan(300)
    expect(broken.wrongEntities).toBeGreaterThan(0)
    // The same world and the same network: only the baseline choice differs.
    expect(broken.sim.lostPackets).toBe(safe.sim.lostPackets)
  })

  it("survives one scripted lost packet: the baseline just gets older", () => {
    const { sim, wrongTicks } = runChecked(
      {
        n: 50,
        share: 0.3,
        loss: 0,
        seed: 4,
        drop: (tick, direction) => direction === "down" && tick === 20,
      },
      40
    )
    expect(wrongTicks).toBe(0)
    expect(sim.lastKind).toBe("delta")
  })

  it("uses a baseline one round trip old on a clean network", () => {
    const sim = new DeltaSim({ n: 50, share: 0.2, loss: 0 })
    for (let i = 0; i < 2 * ONE_WAY_TICKS; i++) {
      sim.step()
      expect(sim.lastKind, "no ack yet").toBe("full-no-ack")
    }
    for (let i = 0; i < 20; i++) {
      sim.step()
      expect(sim.lastKind).toBe("delta")
      expect(sim.lastAge).toBe(2 * ONE_WAY_TICKS)
    }
  })

  it("baseline age climbs one tick at a time while acks are missing", () => {
    const blackoutFrom = 30
    const sim = new DeltaSim({
      n: 100,
      share: 0.15,
      loss: 0,
      drop: (tick, direction) => direction === "down" && tick >= blackoutFrom,
    })
    while (sim.tick <= blackoutFrom + 2) sim.step()
    const ages = []
    for (let i = 0; i < 10; i++) {
      sim.step()
      ages.push(sim.lastAge)
    }
    for (let i = 1; i < ages.length; i++) expect(ages[i]).toBe(ages[i - 1] + 1)
  })

  it("delta size grows with the share of entities changing", () => {
    const meanBytes = (share: number) => {
      const sim = new DeltaSim({ n: 100, share, loss: 0, seed: 5 })
      for (let i = 0; i < 20; i++) sim.step()
      const before = sim.totalBytes
      for (let i = 0; i < 2000; i++) sim.step()
      return (sim.totalBytes - before) / 2000
    }
    const sizes = [0, 0.05, 0.15, 0.3, 0.6, 0.9].map(meanBytes)
    for (let i = 1; i < sizes.length; i++)
      expect(sizes[i]).toBeGreaterThan(sizes[i - 1])
    expect(sizes[0]).toBeLessThan(HEADER_BYTES + 13 + 2)
    expect(sizes[5]).toBeLessThan(fullPacketBytes(100))
  })

  it("delta size grows with baseline age, tracking the predicted changed share", () => {
    const n = 200
    const share = 0.15
    const sim = new DeltaSim({ n, share, loss: 0, seed: 6, hitChance: 0 })
    const history: Uint16Array[] = []
    const ages = [1, 2, 4, 8, 16]
    const bytes = ages.map(() => 0)
    const changed = ages.map(() => 0)
    const out = new Uint8Array(maxPacketBytes(n))
    const flags = new Uint8Array(n)
    let samples = 0
    for (let t = 0; t < 4000; t++) {
      sim.step()
      history.push(sim.state.slice())
      if (t < 200) continue
      ages.forEach((age, i) => {
        bytes[i] += encodeDelta(
          history[t - age],
          sim.state,
          n,
          t,
          age,
          out,
          flags
        )
        changed[i] += flags.reduce((a, b) => a + b, 0) / n
      })
      samples++
    }
    for (let i = 1; i < ages.length; i++)
      expect(bytes[i]).toBeGreaterThan(bytes[i - 1])
    ages.forEach((age, i) => {
      expect(changed[i] / samples).toBeCloseTo(
        expectedChangedShare(share, age),
        1
      )
    })
  })

  it("falls back to a full snapshot once the baseline is too old, then recovers", () => {
    const from = 30
    const to = from + MAX_BASELINE_AGE + 10
    const { sim, wrongTicks } = runChecked(
      {
        n: 100,
        share: 0.15,
        loss: 0,
        drop: (tick, direction) =>
          direction === "down" && tick >= from && tick < to,
      },
      to + 6
    )
    expect(wrongTicks).toBe(0)
    expect(sim.tooOldFallbacks).toBeGreaterThan(0)
    expect(sim.lastKind).toBe("delta")
    expect(sim.client.rejected).toBe(0)
  })

  it("never sends a delta against a baseline older than the limit", () => {
    for (const seed of [1, 2, 3]) {
      const sim = new DeltaSim({ n: 60, share: 0.2, loss: 0.5, seed })
      let fallbacks = 0
      for (let i = 0; i < 3000; i++) {
        const hadTooOld = sim.tooOldFallbacks
        sim.step()
        if (sim.tooOldFallbacks > hadTooOld) fallbacks++
        expect(sim.lastAge).toBeLessThanOrEqual(MAX_BASELINE_AGE)
      }
      expect(fallbacks).toBeGreaterThan(0)
    }
  })

  it("plays the default run the sheet describes: a burst, then two fallbacks", () => {
    const sim = new DeltaSim({ n: 100, share: 0.15, loss: 0.1 })
    const bytes: number[] = []
    const lost: boolean[] = []
    const kinds: string[] = []
    for (let i = 0; i < 40; i++) {
      sim.step()
      bytes.push(sim.lastBytes)
      lost.push((sim.recordFlags(0) & LOST) !== 0)
      kinds.push(sim.lastKind)
    }
    expect(lost.indexOf(true)).toBe(21)
    expect(lost.lastIndexOf(true)).toBe(36)
    expect(bytes[21]).toBe(122)
    expect(bytes[36]).toBe(397)
    expect(kinds.slice(37, 39)).toEqual(["full-too-old", "full-too-old"])
    expect(kinds[39]).toBe("delta")
  })

  it("sends only full snapshots with delta off, and never uses them as deltas", () => {
    const sim = new DeltaSim({ n: 100, share: 0.15, loss: 0.1, delta: false })
    for (let i = 0; i < 100; i++) {
      sim.step()
      expect(sim.lastKind).toBe("full-delta-off")
      expect(sim.lastBytes).toBe(fullPacketBytes(100))
    }
    expect(sim.rates().saving).toBeCloseTo(0, 10)
  })

  it("is deterministic, and motion ignores the loss setting", () => {
    const run = (loss: number) => {
      const sim = new DeltaSim({ n: 80, share: 0.2, loss, seed: 9 })
      for (let i = 0; i < 300; i++) sim.step()
      return sim
    }
    expect(run(0.2).totalBytes).toBe(run(0.2).totalBytes)
    expect(run(0.3).state).toEqual(run(0).state)
  })

  it("hits the requested average share and loss", () => {
    const sim = new DeltaSim({
      n: 200,
      share: 0.25,
      loss: 0.1,
      seed: 12,
      hitChance: 0,
    })
    let moving = 0
    const ticks = 20000
    for (let i = 0; i < ticks; i++) {
      sim.step()
      moving += sim.changedNow.reduce((a, b) => a + b, 0) / sim.n
    }
    expect(moving / ticks).toBeCloseTo(0.25, 1)
    expect(sim.lostPackets / sim.sentPackets).toBeCloseTo(0.1, 1)
  })
})
