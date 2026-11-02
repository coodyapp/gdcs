/**
 * Rollback netcode, reduced to its logic: a deterministic two-player world and
 * a peer that predicts the other player, then repairs its state when the real
 * input turns up. Pure and framework-free; everything is integer arithmetic so
 * the same inputs always give bit-identical states.
 */

export type Input = -1 | 0 | 1
export type Player = 0 | 1
export type InputSource = (frame: number) => Input

/** The whole game state: this is what a save slot holds. */
export interface WorldState {
  /** Frames simulated so far, so also the next frame to run. */
  frame: number
  /** Track position of each player, in whole units. */
  positions: readonly [number, number]
  /** Frames spent touching. Depends on the path taken, not only on the end. */
  contacts: number
}

/** Positions are clamped to ±TRACK_LIMIT, which also makes order matter. */
export const TRACK_LIMIT = 12
const CONTACT_RANGE = 1

export const initialWorld = (): WorldState => ({
  frame: 0,
  positions: [-TRACK_LIMIT / 2, TRACK_LIMIT / 2],
  contacts: 0,
})

const clampToTrack = (x: number) =>
  Math.max(-TRACK_LIMIT, Math.min(TRACK_LIMIT, x))

/** Advance the world one frame. Same state + same inputs = same result. */
export function stepWorld(
  s: WorldState,
  input0: Input,
  input1: Input
): WorldState {
  const a = clampToTrack(s.positions[0] + input0)
  const b = clampToTrack(s.positions[1] + input1)
  return {
    frame: s.frame + 1,
    positions: [a, b],
    contacts: s.contacts + (Math.abs(a - b) <= CONTACT_RANGE ? 1 : 0),
  }
}

/** FNV-1a over the state's integers. Equal states always hash equal. */
export function checksum(s: WorldState): number {
  let h = 0x811c9dc5
  for (const value of [s.frame, s.positions[0], s.positions[1], s.contacts]) {
    h = Math.imul(h ^ (value | 0), 0x01000193)
  }
  return h >>> 0
}

export const sameState = (a: WorldState, b: WorldState) =>
  a.frame === b.frame &&
  a.positions[0] === b.positions[0] &&
  a.positions[1] === b.positions[1] &&
  a.contacts === b.contacts

/** The answer key: run frames 0..frames-1 from scratch with the given inputs. */
export function simulateFresh(
  frames: number,
  input0: InputSource,
  input1: InputSource
): WorldState {
  let s = initialWorld()
  for (let f = 0; f < frames; f++) s = stepWorld(s, input0(f), input1(f))
  return s
}

/** Small integer hash for scripted inputs. */
function mix(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 1, 0xc2b2ae35)
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  return (h ^ (h >>> 13)) >>> 0
}

/**
 * A player who walks left or right and turns around about `changesPerSecond`
 * times per 60 frames: exactly one turn in each block of round(60/rate) frames,
 * at a seeded spot in that block. Stateless, so any frame can be asked for.
 */
export function scriptedInput(
  seed: number,
  changesPerSecond: number
): InputSource {
  if (changesPerSecond <= 0) return () => 1
  const block = Math.max(1, Math.round(60 / changesPerSecond))
  return (frame) => {
    const k = Math.floor(frame / block)
    const turn = k * block + (mix(seed, k) % block)
    return (k + (frame >= turn ? 1 : 0)) % 2 === 0 ? -1 : 1
  }
}

export interface PeerOptions {
  /** One-way latency in frames: a packet sent on tick t arrives on tick t+L. */
  latency: number
  /** Frames between sampling an input and the frame it applies to. */
  inputDelay: number
  /** True inputs, indexed by the frame they apply to. */
  inputs: readonly [InputSource, InputSource]
  /** Which player is local. Never mispredicted. */
  local?: Player
  /** The step function. Replace it in tests to inject a determinism bug. */
  step?: typeof stepWorld
}

export interface TickResult {
  /** Frame this tick simulated for the first time. */
  frame: number
  /** Frames rewound and re-simulated this tick. 0 means no rollback. */
  rollbackDepth: number
  /** The frame whose prediction proved wrong, or -1. */
  mispredictedFrame: number
  /** The state on show before the repair, for frame `frame - 1`. */
  beforeRollback: WorldState | null
  /** Newest frame all of whose inputs are now true (-1 when none). */
  confirmedFrame: number
  /** Checksum of the state after `confirmedFrame`; only this one is comparable. */
  confirmedChecksum: number
}

/**
 * One player's machine. Each tick: take in the input that arrived, roll back if
 * it contradicts the prediction used for its frame, then simulate the new frame.
 * Peers are assumed to tick in step, so the input for frame f arrives on tick
 * f - inputDelay + latency.
 */
export class RollbackPeer {
  state = initialWorld()
  /** Frames with a wrong prediction, since construction. */
  mispredictions = 0
  /** Frames simulated a second time, since construction. */
  resimulated = 0

  private readonly opts: Required<PeerOptions>
  /** savedStates.get(f) is the state just before frame f ran. */
  private readonly savedStates = new Map<number, WorldState>()
  /** The remote input each unconfirmed frame was last simulated with. */
  private readonly usedRemote = new Map<number, Input>()
  private confirmed = -1

  constructor(options: PeerOptions) {
    this.opts = { local: 0, step: stepWorld, ...options }
  }

  private get remotePlayer(): Player {
    return this.opts.local === 0 ? 1 : 0
  }

  /** Real input if it has arrived by this tick, else repeat the newest known. */
  private remoteInputFor(frame: number, newestKnown: number): Input {
    const source = this.opts.inputs[this.remotePlayer]
    if (newestKnown < 0) return 0
    return source(Math.min(frame, newestKnown))
  }

  private advance(frame: number, newestKnown: number) {
    const remote = this.remoteInputFor(frame, newestKnown)
    const local = this.opts.inputs[this.opts.local](frame)
    this.savedStates.set(frame, this.state)
    this.usedRemote.set(frame, remote)
    this.state =
      this.opts.local === 0
        ? this.opts.step(this.state, local, remote)
        : this.opts.step(this.state, remote, local)
  }

  tick(): TickResult {
    const { latency, inputDelay, inputs } = this.opts
    const tick = this.state.frame
    const newestKnown = tick + inputDelay - latency
    const source = inputs[this.remotePlayer]

    // Compare what just arrived with what those frames were simulated with.
    let firstWrong = -1
    for (let f = this.confirmed + 1; f < tick && f <= newestKnown; f++) {
      if (this.usedRemote.get(f) !== source(f)) {
        firstWrong = f
        break
      }
    }

    let depth = 0
    let beforeRollback: WorldState | null = null
    if (firstWrong >= 0) {
      beforeRollback = this.state
      depth = tick - firstWrong
      this.state = this.savedStates.get(firstWrong)!
      for (let f = firstWrong; f < tick; f++) this.advance(f, newestKnown)
      this.mispredictions += 1
      this.resimulated += depth
    }

    this.advance(tick, newestKnown)

    // Only confirmed states match on every peer, so only those are hashed.
    const confirmed = Math.min(newestKnown, tick)
    if (confirmed > this.confirmed) this.confirmed = confirmed
    for (const f of this.savedStates.keys()) {
      if (f > this.confirmed) break
      this.savedStates.delete(f)
      this.usedRemote.delete(f)
    }

    const after = this.savedStates.get(this.confirmed + 1) ?? this.state
    return {
      frame: tick,
      rollbackDepth: depth,
      mispredictedFrame: firstWrong,
      beforeRollback,
      confirmedFrame: this.confirmed,
      confirmedChecksum: checksum(after),
    }
  }
}
