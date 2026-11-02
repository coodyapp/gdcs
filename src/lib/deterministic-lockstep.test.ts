import { describe, expect, it } from "vite-plus/test"

import {
  bandwidth,
  createWorld,
  effectiveTurnMs,
  type ExecRecord,
  laggyPeerLatency,
  LockstepSim,
  type LockstepOptions,
  scriptedCommand,
  stallFreeDelay,
  stepWorld,
  worldChecksum,
} from "./deterministic-lockstep"

const SPIKE = { extraMs: 300, everyMs: 2000, lastsMs: 600 }

function run(overrides: Partial<LockstepOptions> = {}, turns = 400) {
  const sim = new LockstepSim({
    peers: 3,
    units: 90,
    seed: 7,
    turnMs: 100,
    delayTurns: 2,
    latency: laggyPeerLatency(3, 20, 100, SPIKE),
    trace: true,
    ...overrides,
  })
  sim.runUntilTurn(turns)
  return sim
}

const execsOf = (sim: LockstepSim, peer: number, upTo: number) =>
  sim.execs
    .filter((e) => e.peer === peer && e.turn <= upTo)
    .sort((a, b) => a.turn - b.turn)

const stallOver = (sim: LockstepSim, peer: number, upTo: number) =>
  execsOf(sim, peer, upTo).reduce((sum, e) => sum + e.stallMs, 0)

describe("identical worlds", () => {
  it.each([2, 3])(
    "%i peers produce identical checksums on every turn",
    (peers) => {
      const sim = run({
        peers,
        latency: laggyPeerLatency(peers, 20, 130, SPIKE),
      })
      const base = execsOf(sim, 0, 400)
      expect(base).toHaveLength(401)
      for (let p = 1; p < peers; p++) {
        const other = execsOf(sim, p, 400)
        expect(other.map((e) => e.checksum)).toEqual(
          base.map((e) => e.checksum)
        )
      }
      expect(sim.firstMismatch).toBeNull()
    }
  )

  it("gives the same world at any latency: timing never reaches the sim", () => {
    const a = run({ latency: laggyPeerLatency(3, 5, 40) })
    const b = run({ latency: laggyPeerLatency(3, 40, 700, SPIKE) })
    expect(execsOf(a, 2, 400).map((e) => e.checksum)).toEqual(
      execsOf(b, 2, 400).map((e) => e.checksum)
    )
  })

  it("rebuilds the same world from the inputs alone, as a replay does", () => {
    const sim = run()
    const replay = createWorld(90, 3, 7)
    for (const e of execsOf(sim, 1, 400)) {
      stepWorld(replay, e.inputs)
      expect(worldChecksum(replay)).toBe(e.checksum)
    }
  })

  it("is sensitive to its seed, so the checks above are not vacuous", () => {
    const a = run({}, 50)
    const b = run({ seed: 8 }, 50)
    expect(execsOf(a, 0, 50).at(-1)!.checksum).not.toBe(
      execsOf(b, 0, 50).at(-1)!.checksum
    )
  })
})

describe("waiting for inputs", () => {
  const setups: [string, Partial<LockstepOptions>][] = [
    ["default", {}],
    ["long latency", { latency: laggyPeerLatency(3, 80, 650) }],
    ["delay 1", { delayTurns: 1 }],
    ["delay 6", { delayTurns: 6 }],
    ["2 peers", { peers: 2, latency: laggyPeerLatency(2, 20, 180, SPIKE) }],
  ]

  it.each(setups)(
    "%s: no peer runs a turn before every input reached it",
    (_, setup) => {
      const sim = run(setup)
      const { peers, delayTurns } = sim.opts
      const arrivals = new Map(
        sim.sends.map((s) => [`${s.from}>${s.to}@${s.turn}`, s])
      )
      let checked = 0
      for (const e of sim.execs) {
        if (e.turn < (delayTurns ?? 0)) continue
        for (let from = 0; from < peers; from++) {
          if (from === e.peer) {
            // Its own input was issued delayTurns earlier, on its own machine.
            const own = sim.execs.find(
              (o: ExecRecord) =>
                o.peer === from && o.turn === e.turn - delayTurns
            )!
            expect(own.at).toBeLessThanOrEqual(e.at)
          } else {
            const s = arrivals.get(`${from}>${e.peer}@${e.turn}`)!
            expect(s, `${from} to ${e.peer} turn ${e.turn}`).toBeDefined()
            expect(s.arrivesAt).toBeLessThanOrEqual(e.at)
            checked++
          }
          // And it used exactly the command that was issued.
          expect(e.inputs[from]).toBe(scriptedCommand(7, from, e.turn))
        }
      }
      expect(checked).toBeGreaterThan(300)
    }
  )

  it("never runs turns out of order, or faster than the turn length", () => {
    const sim = run({ latency: laggyPeerLatency(3, 5, 10) })
    for (let p = 0; p < 3; p++) {
      const list = execsOf(sim, p, 400)
      list.forEach((e, i) => {
        expect(e.turn).toBe(i)
        if (i > 0) expect(e.at - list[i - 1].at).toBeGreaterThanOrEqual(100)
      })
    }
  })

  it("reports the first turn it cannot run yet as waiting, then stalling", () => {
    const sim = new LockstepSim({
      peers: 3,
      units: 30,
      seed: 7,
      turnMs: 100,
      delayTurns: 2,
      latency: laggyPeerLatency(3, 20, 500),
    })
    // Turn 2 needs inputs sent at t=0, which take 500 ms. Turn 1 ran at t=100.
    sim.advance(150)
    expect(sim.turnOf(0)).toBe(1)
    expect(sim.cellState(0, 1)).toBe("executed")
    expect(sim.cellState(0, 2)).toBe("waiting")
    sim.advance(100)
    expect(sim.turnOf(0)).toBe(1)
    expect(sim.cellState(0, 2)).toBe("stalling")
    expect(sim.cellState(0, 4)).toBe("none")
    sim.advance(300)
    expect(sim.turnOf(0)).toBe(2)
    expect(sim.cellState(0, 2)).toBe("stalled")
  })
})

describe("pace", () => {
  it("runs with no stall when latency fits the delay budget", () => {
    const sim = run({
      delayTurns: stallFreeDelay(200, 100),
      latency: laggyPeerLatency(3, 20, 200),
    })
    for (let p = 0; p < 3; p++) expect(stallOver(sim, p, 400)).toBe(0)
  })

  it("stalls from one millisecond over the budget", () => {
    const sim = run({ latency: laggyPeerLatency(3, 20, 201) })
    expect(stallOver(sim, 0, 400)).toBeGreaterThan(0)
  })

  it.each([
    [300, 2, 150],
    [500, 2, 250],
    [550, 5, 110],
    [150, 2, 100],
  ])(
    "at %i ms and delay %i, a turn settles at %i ms",
    (latency, delayTurns, expected) => {
      const sim = run({
        delayTurns,
        latency: laggyPeerLatency(3, 20, latency),
      })
      expect(effectiveTurnMs(latency, 100, delayTurns)).toBe(expected)
      for (let p = 0; p < 3; p++) {
        const list = execsOf(sim, p, 400)
        const span = list[400].at - list[300].at
        expect(span / 100).toBe(expected)
      }
    }
  )

  it("one laggy peer slows the two peers with a fast link to each other", () => {
    const sim = run({ latency: laggyPeerLatency(3, 20, 300) })
    const fast = execsOf(sim, 0, 400)
    expect(fast[400].at).toBeGreaterThan(400 * 140)
    expect(stallOver(sim, 1, 400)).toBeGreaterThan(0)
  })

  it("one slow CPU sets everyone's pace", () => {
    const sim = run({
      minTurnMs: [100, 100, 160],
      latency: laggyPeerLatency(3, 20, 60),
    })
    for (let p = 0; p < 3; p++) {
      const list = execsOf(sim, p, 400)
      expect((list[400].at - list[300].at) / 100).toBe(160)
    }
    // The healthy peers do the waiting. The slow one is never blocked.
    expect(stallOver(sim, 0, 400)).toBeGreaterThan(20000)
    expect(stallOver(sim, 2, 400)).toBeLessThan(stallOver(sim, 0, 400))
  })

  it("a higher scheduling delay reduces stalls at a given latency", () => {
    const totals = [1, 2, 3, 4, 5, 6].map((delayTurns) =>
      stallOver(run({ delayTurns }, 400), 0, 400)
    )
    for (let i = 1; i < totals.length; i++)
      expect(totals[i]).toBeLessThanOrEqual(totals[i - 1])
    expect(totals[1]).toBeLessThan(totals[0])
    expect(totals[3]).toBeLessThan(totals[1])
    expect(totals[5]).toBe(0)
  })
})

describe("the numbers quoted on the sheet", () => {
  it("stalls 43.2, 25.2, 11.2 and 0 s over 1000 turns at delays 1 to 4", () => {
    const seconds = [1, 2, 3, 4].map(
      (delayTurns) => stallOver(run({ delayTurns }, 1000), 0, 1000) / 1000
    )
    expect(seconds).toEqual([43.2, 25.2, 11.2, 0])
  })
})

describe("desync detection", () => {
  it.each([
    [1, 0, 60],
    [2, 2, 25],
    [3, 1, 137],
    [2, 0, 300],
  ])(
    "delay %i: a difference on peer %i at turn %i is found at that turn",
    (delayTurns, peer, turn) => {
      const sim = run({ delayTurns, desync: { peer, turn } })
      expect(sim.firstMismatch?.turn).toBe(turn)
      const clean = execsOf(sim, peer === 0 ? 1 : 0, 400)
      const broken = execsOf(sim, peer, 400)
      expect(broken[turn - 1].checksum).toBe(clean[turn - 1].checksum)
      expect(broken[turn].checksum).not.toBe(clean[turn].checksum)
    }
  )

  it("detection comes after the turn, by about one latency", () => {
    const sim = run({
      desync: { peer: 2, turn: 60 },
      latency: laggyPeerLatency(3, 20, 100),
    })
    const ran = sim.execs.find((e) => e.peer === 2 && e.turn === 60)!
    const found = sim.firstMismatch!
    expect(found.detectedAt).toBeGreaterThan(ran.at)
    expect(found.detectedAt - ran.at).toBeLessThanOrEqual(200)
  })

  it("checking every N turns finds it only at the next checked turn", () => {
    const sim = run({ desync: { peer: 2, turn: 61 }, checksumEvery: 10 })
    expect(sim.firstMismatch?.turn).toBe(70)
  })

  it("a clean run reports nothing even with sparse checks", () => {
    expect(run({ checksumEvery: 7 }).firstMismatch).toBeNull()
  })

  it("the difference spreads to most units within a few turns", () => {
    const a = createWorld(300, 3, 7)
    const b = createWorld(300, 3, 7)
    const none = [0, 0, 0]
    b.x[0] += 1
    for (let i = 0; i < 12; i++) {
      stepWorld(a, none)
      stepWorld(b, none)
    }
    let differing = 0
    for (let i = 0; i < 300; i++) if (a.x[i] !== b.x[i]) differing++
    expect(differing).toBeGreaterThan(270)
  })
})

describe("bandwidth", () => {
  it("input cost ignores unit count; state cost scales with it", () => {
    const small = bandwidth({ units: 300, peers: 3, turnMs: 100 })
    const big = bandwidth({ units: 3000, peers: 3, turnMs: 100 })
    expect(small.inputBytesPerSecond).toBe(800)
    expect(big.inputBytesPerSecond).toBe(800)
    expect(small.stateBytesPerSecond).toBe(72560)
    expect(big.stateBytesPerSecond).toBe(720560)
  })
})
