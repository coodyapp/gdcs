import { describe, expect, it } from "vite-plus/test"

import {
  createSim,
  decayError,
  PUSH_SIZE,
  reconcile,
  replay,
  runSim,
  scriptedMove,
  SEND_EVERY,
  SPEED,
  stepSim,
  TICK_MS,
  type Input,
  type SimConfig,
} from "./client-side-prediction"

const inputs: Input[] = [
  { seq: 1, move: 1 },
  { seq: 2, move: 2 },
  { seq: 3, move: -0.5 },
  { seq: 4, move: 4 },
]

describe("reconcile", () => {
  it("reproduces the client's prediction when client and server agree", () => {
    const predicted = replay(10, inputs)
    const server = { position: replay(10, inputs.slice(0, 2)), ackSeq: 2 }
    expect(reconcile(server, inputs).position).toBeCloseTo(predicted, 12)
  })

  it("equals the server's position once every input is acknowledged", () => {
    const server = { position: replay(10, inputs), ackSeq: 4 }
    expect(reconcile(server, inputs).position).toBe(server.position)
  })

  it("carries a server correction into the replayed position", () => {
    const agreed = replay(10, inputs.slice(0, 2))
    const server = { position: agreed + 3, ackSeq: 2 }
    expect(reconcile(server, inputs).position).toBeCloseTo(
      replay(10, inputs) + 3,
      12
    )
  })

  it("drops acknowledged inputs and keeps the rest in order", () => {
    const { pending } = reconcile({ position: 0, ackSeq: 2 }, inputs)
    expect(pending.map((i) => i.seq)).toEqual([3, 4])
  })

  it("keeps everything when nothing has been acknowledged", () => {
    const { pending } = reconcile({ position: 0, ackSeq: -1 }, inputs)
    expect(pending).toHaveLength(inputs.length)
  })

  it("does not mutate its input", () => {
    const copy = structuredClone(inputs)
    reconcile({ position: 0, ackSeq: 2 }, inputs)
    expect(inputs).toEqual(copy)
  })
})

describe("decayError", () => {
  it("halves once per half-life", () => {
    expect(decayError(1, 60, 60)).toBeCloseTo(0.5, 12)
    expect(decayError(1, 300, 60)).toBeCloseTo(1 / 32, 12)
  })
})

describe("simulation", () => {
  const config = (latencyTicks: number, push = false): SimConfig => ({
    latencyTicks,
    sendEvery: SEND_EVERY,
    push,
  })

  it("is deterministic and leaves the previous state untouched", () => {
    const before = runSim(config(6, true), 150)
    const copy = structuredClone(before)
    stepSim(before, config(6, true))
    expect(before).toEqual(copy)
    expect(runSim(config(6, true), 150)).toEqual(before)
  })

  it.each([0, 1, 6, 10])(
    "never corrects at %i ticks one-way when nothing disagrees",
    (latency) => {
      expect(runSim(config(latency), 1000).lastCorrection).toBeNull()
    }
  )

  it("carries pending inputs for about one round trip", () => {
    // 150 ms each way at 25 ms ticks, a state every 2 ticks.
    let state = runSim(config(6), 40)
    const counts = new Set<number>()
    for (let i = 0; i < 200; i++) {
      state = stepSim(state, config(6))
      counts.add(state.pending.length)
    }
    expect([...counts].sort((a, b) => a - b)).toEqual([12, 13])
  })

  it("matches the buffer size the sheet quotes for 60 Hz and 200 ms", () => {
    // 100 ms each way at a 60 Hz tick, a state every 3 ticks (20 Hz).
    const c: SimConfig = { latencyTicks: 6, sendEvery: 3, push: false }
    let state = runSim(c, 40)
    const counts = new Set<number>()
    for (let i = 0; i < 200; i++) {
      state = stepSim(state, c)
      counts.add(state.pending.length)
    }
    expect([...counts].sort((a, b) => a - b)).toEqual([12, 13, 14])
  })

  it("orders the markers: predicted, then server, then received", () => {
    // Mid-run, moving right, before the first push.
    const state = runSim(config(6), 35)
    expect(state.predicted).toBeGreaterThan(state.server.position)
    expect(state.server.position).toBeGreaterThan(state.received.position)
  })

  it("trails by RTT plus at most one state interval without prediction", () => {
    const state = runSim(config(6), 35)
    const gap = state.predicted - state.received.position
    const perTick = (SPEED * TICK_MS) / 1000
    const rtt = 12 * perTick
    expect(gap).toBeGreaterThanOrEqual(rtt - 1e-9)
    expect(gap).toBeLessThanOrEqual(rtt + (SEND_EVERY - 1) * perTick + 1e-9)
  })

  it("all three positions agree once input has been idle for a round trip", () => {
    // The rest phase starts at tick 80 and lasts 20 ticks; the push is on.
    const state = runSim(config(6, true), 95)
    expect(scriptedMove(94)).toBe(0)
    expect(state.predicted).toBeCloseTo(state.server.position, 9)
    expect(state.received.position).toBeCloseTo(state.server.position, 9)
    // Idle ticks still send inputs, but they all move nothing.
    expect(state.pending.every((input) => input.move === 0)).toBe(true)
  })

  it("corrects by the size of the push, one way after the server applies it", () => {
    const c = config(6, true)
    let state = createSim(c)
    let serverJump = -1
    while (!state.lastCorrection) {
      const next = stepSim(state, c)
      const moved = Math.abs(next.server.position - state.server.position)
      if (serverJump < 0 && moved > PUSH_SIZE / 2) serverJump = state.tick
      state = next
    }
    const { from, to, tick } = state.lastCorrection
    expect(Math.abs(from - to)).toBeCloseTo(PUSH_SIZE, 9)
    // The state leaves on the next send tick and takes 6 ticks to arrive.
    expect(tick - serverJump).toBeGreaterThanOrEqual(6)
    expect(tick - serverJump).toBeLessThan(6 + SEND_EVERY)
  })

  it("keeps a corrected prediction on the server's line, without drift", () => {
    const c = config(6, true)
    const first = runSim(c, 95)
    const later = runSim(c, 95 + 200 * 5)
    expect(later.predicted).toBeCloseTo(first.predicted, 9)
  })

  it("starts the visual error at the correction, then lets it decay", () => {
    const c = config(6, true)
    let state = createSim(c)
    while (!state.lastCorrection) state = stepSim(state, c)
    const { from, to } = state.lastCorrection
    expect(state.visualError).toBeCloseTo(from - to, 9)
    const start = Math.abs(state.visualError)
    for (let i = 0; i < 12; i++) state = stepSim(state, c) // 300 ms
    expect(Math.abs(state.visualError)).toBeCloseTo(start / 32, 9)
  })

  it("stays on the track at every latency, with or without pushes", () => {
    for (const latency of [0, 2, 6, 10]) {
      for (const push of [false, true]) {
        let state = createSim(config(latency, push))
        for (let i = 0; i < 2000; i++) {
          state = stepSim(state, config(latency, push))
          expect(Math.abs(state.predicted)).toBeLessThanOrEqual(3.5 + 1e-6)
          expect(Math.abs(state.server.position)).toBeLessThanOrEqual(
            3.5 + 1e-6
          )
        }
      }
    }
  })
})
