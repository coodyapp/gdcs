import { describe, expect, it } from "vite-plus/test"

import {
  checksum,
  type Input,
  type InputSource,
  RollbackPeer,
  sameState,
  scriptedInput,
  simulateFresh,
  stepWorld,
  TRACK_LIMIT,
} from "./rollback-netcode"

/** Seeded per-frame noise: changes as often as every frame, with all 3 values. */
function noisyInput(seed: number, frames: number, holdChance = 0.7) {
  const out: Input[] = []
  let x = seed >>> 0 || 1
  const next = () => {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    x >>>= 0
    return x / 2 ** 32
  }
  let current: Input = 0
  for (let f = 0; f < frames; f++) {
    if (next() > holdChance) current = (Math.floor(next() * 3) - 1) as Input
    out.push(current)
  }
  return (frame: number) => out[frame]
}

const SETUPS: [latency: number, delay: number][] = [
  [1, 0],
  [3, 1],
  [6, 1],
  [8, 2],
  [8, 0],
  [4, 4],
  [2, 5],
  [0, 0],
]

const peerFor = (
  latency: number,
  inputDelay: number,
  a: InputSource,
  b: InputSource
) => new RollbackPeer({ latency, inputDelay, inputs: [a, b] })

/** Frames whose true input differs from the one before (frame -1 is neutral). */
function changesUpTo(source: InputSource, lastFrame: number) {
  let n = 0
  for (let f = 0; f <= lastFrame; f++)
    if (source(f) !== (f === 0 ? 0 : source(f - 1))) n++
  return n
}

describe("stepWorld", () => {
  it("is pure: same state and inputs give an identical result", () => {
    const start = simulateFresh(
      10,
      () => 1,
      () => -1
    )
    const copy = JSON.stringify(start)
    expect(stepWorld(start, 1, -1)).toEqual(stepWorld(start, 1, -1))
    expect(JSON.stringify(start)).toBe(copy)
  })

  it("clamps to the track, so input order changes the result", () => {
    const toWall = simulateFresh(
      40,
      () => 1,
      () => 1
    )
    expect(toWall.positions[0]).toBe(TRACK_LIMIT)
    const rightThenLeft = simulateFresh(
      40,
      (f) => (f < 30 ? 1 : -1),
      () => 0
    )
    const leftThenRight = simulateFresh(
      40,
      (f) => (f < 10 ? -1 : 1),
      () => 0
    )
    expect(rightThenLeft.positions[0]).not.toBe(leftThenRight.positions[0])
  })
})

describe("RollbackPeer: the key property", () => {
  it.each(SETUPS)(
    "after every tick the state equals a fresh sim of what is known (L=%i, D=%i)",
    (latency, delay) => {
      for (const seed of [1, 7, 42, 1234]) {
        const local = noisyInput(seed, 600)
        const remote = noisyInput(seed * 31 + 5, 600)
        const peer = peerFor(latency, delay, local, remote)
        for (let tick = 0; tick < 600; tick++) {
          peer.tick()
          const newest = tick + delay - latency
          const believed: InputSource = (f) =>
            newest < 0 ? 0 : remote(Math.min(f, newest))
          const expected = simulateFresh(tick + 1, local, believed)
          expect(sameState(peer.state, expected), `tick ${tick}`).toBe(true)
        }
      }
    }
  )

  it.each(SETUPS)(
    "confirmed checksums equal a fresh sim with the true inputs (L=%i, D=%i)",
    (latency, delay) => {
      const local = noisyInput(11, 400)
      const remote = noisyInput(99, 400)
      const peer = peerFor(latency, delay, local, remote)
      for (let tick = 0; tick < 400; tick++) {
        const r = peer.tick()
        if (r.confirmedFrame < 0) continue
        const truth = simulateFresh(r.confirmedFrame + 1, local, remote)
        expect(r.confirmedChecksum, `tick ${tick}`).toBe(checksum(truth))
      }
    }
  )

  it("converges on the true world once the last late input lands", () => {
    const script = noisyInput(5, 300)
    const remote: InputSource = (f) => (f < 300 ? script(f) : 1)
    const local = scriptedInput(3, 2)
    const peer = peerFor(7, 2, local, remote)
    for (let tick = 0; tick < 320; tick++) peer.tick()
    expect(sameState(peer.state, simulateFresh(320, local, remote))).toBe(true)
  })
})

describe("RollbackPeer: cost of a rollback", () => {
  it("does no re-simulation when every prediction is right", () => {
    const peer = peerFor(6, 1, scriptedInput(1, 4), () => 0)
    for (let i = 0; i < 500; i++) expect(peer.tick().rollbackDepth).toBe(0)
    expect(peer.mispredictions).toBe(0)
    expect(peer.resimulated).toBe(0)
  })

  it.each([
    [1, 0],
    [3, 1],
    [6, 1],
    [8, 2],
    [8, 0],
  ])("every rollback is exactly L - D frames deep (L=%i, D=%i)", (l, d) => {
    const peer = peerFor(l, d, () => 0, noisyInput(77, 800))
    let rollbacks = 0
    for (let i = 0; i < 800; i++) {
      const r = peer.tick()
      if (r.mispredictedFrame >= 0) {
        rollbacks++
        expect(r.rollbackDepth).toBe(l - d)
        expect(r.mispredictedFrame).toBe(r.frame - (l - d))
      } else expect(r.rollbackDepth).toBe(0)
    }
    expect(rollbacks).toBeGreaterThan(50)
  })

  it.each([
    [4, 4],
    [2, 5],
    [0, 0],
    [0, 3],
  ])("never rolls back when delay covers latency (L=%i, D=%i)", (l, d) => {
    const local = noisyInput(3, 500)
    const remote = noisyInput(8, 500)
    const peer = peerFor(l, d, local, remote)
    for (let tick = 0; tick < 500; tick++) {
      expect(peer.tick().rollbackDepth).toBe(0)
      expect(
        sameState(peer.state, simulateFresh(tick + 1, local, remote))
      ).toBe(true)
    }
    expect(peer.resimulated).toBe(0)
  })

  it("mispredicts once per input change, however close together they are", () => {
    const remote = noisyInput(21, 700)
    const peer = peerFor(6, 1, () => 0, remote)
    let confirmed = -1
    for (let i = 0; i < 700; i++) confirmed = peer.tick().confirmedFrame
    expect(peer.mispredictions).toBe(changesUpTo(remote, confirmed))
    expect(peer.resimulated).toBe(peer.mispredictions * 5)
  })

  it("re-simulates changes-per-second × (L - D) frames per second", () => {
    for (const rate of [1, 2, 4, 6, 10]) {
      const peer = peerFor(6, 1, () => 0, scriptedInput(9, rate))
      const seconds = 100
      for (let i = 0; i < seconds * 60 + 5; i++) peer.tick()
      // One turn per block; frame 0's neutral guess may add one more rollback.
      expect(peer.mispredictions - rate * seconds).toBeGreaterThanOrEqual(0)
      expect(peer.mispredictions - rate * seconds).toBeLessThanOrEqual(1)
      expect(peer.resimulated).toBe(peer.mispredictions * 5)
    }
  })

  it("adds nothing to delay beyond latency: same zero rollback, more lag", () => {
    const remote = noisyInput(4, 300)
    const atLatency = peerFor(3, 3, () => 0, remote)
    const beyond = peerFor(3, 6, () => 0, remote)
    for (let i = 0; i < 300; i++) {
      atLatency.tick()
      beyond.tick()
    }
    expect(atLatency.resimulated).toBe(0)
    expect(beyond.resimulated).toBe(0)
    expect(sameState(atLatency.state, beyond.state)).toBe(true)
  })
})

describe("scriptedInput", () => {
  it("makes one change per block and is repeatable", () => {
    const a = scriptedInput(5, 4)
    const b = scriptedInput(5, 4)
    let changes = 0
    for (let f = 1; f < 600; f++) {
      expect(a(f)).toBe(b(f))
      if (a(f) !== a(f - 1)) changes++
    }
    expect(changes).toBeGreaterThanOrEqual(38)
    expect(changes).toBeLessThanOrEqual(40)
  })

  it("holds still at a rate of zero", () => {
    const s = scriptedInput(5, 0)
    for (let f = 0; f < 50; f++) expect(s(f)).toBe(s(0))
  })
})

describe("desync detection", () => {
  const a = noisyInput(13, 400)
  const b = noisyInput(14, 400)

  it("confirmed checksums agree although the predicted states do not", () => {
    const p0 = new RollbackPeer({ latency: 6, inputDelay: 1, inputs: [a, b] })
    const p1 = new RollbackPeer({
      latency: 6,
      inputDelay: 1,
      inputs: [a, b],
      local: 1,
    })
    let predictedDiffered = 0
    for (let i = 0; i < 400; i++) {
      const r0 = p0.tick()
      const r1 = p1.tick()
      expect(r0.confirmedFrame).toBe(r1.confirmedFrame)
      expect(r0.confirmedChecksum).toBe(r1.confirmedChecksum)
      if (checksum(p0.state) !== checksum(p1.state)) predictedDiffered++
    }
    expect(predictedDiffered).toBeGreaterThan(100)
  })

  it("flags a determinism bug at the first frame it touches", () => {
    const BUG_FRAME = 200
    const buggy: typeof stepWorld = (s, i0, i1) => {
      const next = stepWorld(s, i0, i1)
      if (s.frame !== BUG_FRAME) return next
      return { ...next, contacts: next.contacts + 1 }
    }
    const good = new RollbackPeer({ latency: 6, inputDelay: 1, inputs: [a, b] })
    const bad = new RollbackPeer({
      latency: 6,
      inputDelay: 1,
      inputs: [a, b],
      local: 1,
      step: buggy,
    })
    let firstMismatch = -1
    for (let i = 0; i < 400 && firstMismatch < 0; i++) {
      const rg = good.tick()
      const rb = bad.tick()
      if (rg.confirmedChecksum !== rb.confirmedChecksum)
        firstMismatch = rg.confirmedFrame
    }
    expect(firstMismatch).toBe(BUG_FRAME)
  })
})
