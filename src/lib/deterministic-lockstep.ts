/**
 * Deterministic lockstep, reduced to its logic: peers exchange only inputs,
 * each scheduled a few turns ahead, and no peer runs a turn until it holds the
 * input of every peer for that turn. Pure and framework-free. All world state
 * is integers, and time is whole milliseconds, so a seeded run is exact.
 */

/** Half-size of the world, in its own integer units. */
export const WORLD_W = 1600
export const WORLD_H = 920

const UNIT_SPEED = 120
const SLOT_SPACING = 64
/** A peer issues a real command on about one turn in this many. */
const COMMAND_EVERY = 10
const HISTORY = 256

function mix(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 1, 0xc2b2ae35)
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  return (h ^ (h >>> 13)) >>> 0
}

const encodeTarget = (x: number, y: number) =>
  (((x + WORLD_W + 1) << 16) | (y + WORLD_H + 1)) >>> 0

function hashToTarget(h: number): [number, number] {
  const marginX = WORLD_W - 260
  const marginY = WORLD_H - 260
  const x = ((h >>> 12) % (2 * marginX + 1)) - marginX
  const y = ((h & 0xfff) * 7) % (2 * marginY + 1)
  return [x, y - marginY]
}

/**
 * What a player does on a turn: 0 for nothing, otherwise a move order for that
 * player's squad. Stateless and keyed by turn, so timing can never change it.
 */
export function scriptedCommand(
  seed: number,
  peer: number,
  turn: number
): number {
  const h = mix(mix(seed, peer), turn)
  if (h % COMMAND_EVERY !== 0) return 0
  const [x, y] = hashToTarget(mix(h, 1))
  return encodeTarget(x, y)
}

/** The full game state. A checksum covers all of it. */
export interface World {
  /** Turns simulated so far. */
  turn: number
  x: Int32Array
  y: Int32Array
  /** Positions before the latest turn. Kept for drawing, not part of the game. */
  prevX: Int32Array
  prevY: Int32Array
  /** Move order of each squad, as x0, y0, x1, y1... */
  targets: Int32Array
  /** Formation offset of each unit. Never changes after creation. */
  offsetX: Int32Array
  offsetY: Int32Array
}

export const squadOf = (unit: number, squads: number) => unit % squads

export function createWorld(
  units: number,
  squads: number,
  seed: number
): World {
  const side = Math.ceil(Math.sqrt(units / squads))
  const w: World = {
    turn: 0,
    x: new Int32Array(units),
    y: new Int32Array(units),
    prevX: new Int32Array(units),
    prevY: new Int32Array(units),
    targets: new Int32Array(squads * 2),
    offsetX: new Int32Array(units),
    offsetY: new Int32Array(units),
  }
  for (let p = 0; p < squads; p++) {
    const [x, y] = hashToTarget(mix(seed + 11, p))
    w.targets[p * 2] = x
    w.targets[p * 2 + 1] = y
  }
  for (let i = 0; i < units; i++) {
    const squad = squadOf(i, squads)
    const slot = Math.floor(i / squads)
    w.offsetX[i] = ((slot % side) - (side >> 1)) * SLOT_SPACING
    w.offsetY[i] = (Math.floor(slot / side) - (side >> 1)) * SLOT_SPACING
    w.x[i] = w.targets[squad * 2] + w.offsetX[i]
    w.y[i] = w.targets[squad * 2 + 1] + w.offsetY[i]
  }
  w.prevX.set(w.x)
  w.prevY.set(w.y)
  return w
}

const clampInt = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v

/**
 * Advance one turn. Inputs are applied in peer order, never arrival order. Each
 * unit's wobble hashes itself and two other units, so a one-bit difference
 * reaches more units every turn, the way real desyncs spread.
 */
export function stepWorld(w: World, inputs: ArrayLike<number>) {
  for (let p = 0; p < inputs.length; p++) {
    const c = inputs[p]
    if (c === 0) continue
    w.targets[p * 2] = (c >>> 16) - WORLD_W - 1
    w.targets[p * 2 + 1] = (c & 0xffff) - WORLD_H - 1
  }
  const px = w.x
  const py = w.y
  const nx = w.prevX
  const ny = w.prevY
  const n = px.length
  const squads = inputs.length
  for (let i = 0; i < n; i++) {
    const squad = i % squads
    const a = i >> 1
    const b = (i + n - 1) % n
    const h = mix(
      px[i] ^ Math.imul(py[a], 2053) ^ Math.imul(px[b], 433),
      px[a] ^ Math.imul(py[i], 31) ^ Math.imul(py[b], 8191)
    )
    const gx = w.targets[squad * 2] + w.offsetX[i]
    const gy = w.targets[squad * 2 + 1] + w.offsetY[i]
    const wobbleX = (h & 15) - 7
    const wobbleY = ((h >>> 4) & 15) - 7
    nx[i] = clampInt(
      px[i] + clampInt(gx - px[i], -UNIT_SPEED, UNIT_SPEED) + wobbleX,
      -WORLD_W,
      WORLD_W
    )
    ny[i] = clampInt(
      py[i] + clampInt(gy - py[i], -UNIT_SPEED, UNIT_SPEED) + wobbleY,
      -WORLD_H,
      WORLD_H
    )
  }
  w.x = nx
  w.y = ny
  w.prevX = px
  w.prevY = py
  w.turn += 1
}

/** FNV-1a over every integer of game state. Drawing data is left out. */
export function worldChecksum(w: World): number {
  let h = 0x811c9dc5
  const add = (v: number) => {
    h = Math.imul(h ^ v, 0x01000193)
  }
  add(w.turn)
  for (let i = 0; i < w.targets.length; i++) add(w.targets[i])
  for (let i = 0; i < w.x.length; i++) {
    add(w.x[i])
    add(w.y[i])
  }
  return h >>> 0
}

export type LatencyFn = (from: number, to: number, sentAt: number) => number

export interface Spike {
  /** Added to every link touching the laggy peer. */
  extraMs: number
  everyMs: number
  lastsMs: number
}

/**
 * All peers sit `fastMs` apart, except the last peer, which is `slowMs` from
 * everyone and is the one a spike hits.
 */
export function laggyPeerLatency(
  peers: number,
  fastMs: number,
  slowMs: number,
  spike?: Spike
): LatencyFn {
  const laggy = peers - 1
  return (from, to, sentAt) => {
    if (from !== laggy && to !== laggy) return fastMs
    const spiking = spike && sentAt % spike.everyMs < spike.lastsMs
    return slowMs + (spiking ? spike.extraMs : 0)
  }
}

export interface LockstepOptions {
  peers: number
  units: number
  seed: number
  turnMs: number
  /** Turns between issuing an input and the turn it executes on. At least 1. */
  delayTurns: number
  latency: LatencyFn
  /** Per-peer minimum time per turn: a slow CPU. Defaults to turnMs for all. */
  minTurnMs?: readonly number[]
  /** Nudge one unit on this peer right after it runs this turn. */
  desync?: { peer: number; turn: number } | null
  /** Exchange a checksum on turns divisible by this. Default 1: every turn. */
  checksumEvery?: number
  /** Record every send and execution, for tests. */
  trace?: boolean
}

export interface SendRecord {
  from: number
  to: number
  turn: number
  command: number
  sentAt: number
  arrivesAt: number
}

export interface ExecRecord {
  peer: number
  turn: number
  at: number
  stallMs: number
  checksum: number
  inputs: number[]
}

export interface Mismatch {
  /** The earliest turn whose checksums were seen to differ. */
  turn: number
  detectedAt: number
  detectedBy: number
}

interface Message {
  to: number
  from: number
  turn: number
  command: number
  arrivesAt: number
  hashTurn: number
  hash: number
}

interface Peer {
  world: World
  /** Newest executed turn, -1 before the first. */
  turn: number
  startedAt: number
  /** Earliest time the next turn may start. */
  readyAt: number
  totalStallMs: number
  /** Stall before each past turn, in a ring indexed by turn. */
  stalls: Int32Array
  /** Inbox rings, per sender: the turn stored in each slot, and its command. */
  heldTurn: Int32Array[]
  heldCommand: Int32Array[]
  /** What this peer knows of each peer's checksums, same layout. */
  hashTurn: Int32Array[]
  hash: Uint32Array[]
}

export type CellState =
  | "executed"
  | "stalled"
  | "stalling"
  | "ready"
  | "waiting"
  | "none"

/** Every peer's machine plus the network between them, stepped in milliseconds. */
export class LockstepSim {
  /** The next millisecond to process. */
  now = 0
  firstMismatch: Mismatch | null = null
  readonly sends: SendRecord[] = []
  readonly execs: ExecRecord[] = []

  readonly opts: LockstepOptions
  private readonly nodes: Peer[]
  private readonly inFlight: Message[] = []
  private readonly inputs: Int32Array

  constructor(opts: LockstepOptions) {
    if (opts.delayTurns < 1 || opts.delayTurns >= HISTORY / 2)
      throw new RangeError("delayTurns out of range")
    this.opts = opts
    this.inputs = new Int32Array(opts.peers)
    this.nodes = Array.from({ length: opts.peers }, () => {
      const rings = <T>(make: () => T) =>
        Array.from({ length: opts.peers }, make)
      const turns = () => new Int32Array(HISTORY).fill(-1)
      return {
        world: createWorld(opts.units, opts.peers, opts.seed),
        turn: -1,
        startedAt: 0,
        readyAt: 0,
        totalStallMs: 0,
        stalls: new Int32Array(HISTORY),
        heldTurn: rings(turns),
        heldCommand: rings(() => new Int32Array(HISTORY)),
        hashTurn: rings(turns),
        hash: rings(() => new Uint32Array(HISTORY)),
      }
    })
  }

  /** True once `peer` has the input of `from` for `turn`. */
  holds(peer: number, from: number, turn: number): boolean {
    // The first turns have no inputs: every peer knows they are empty.
    if (turn < this.opts.delayTurns) return true
    return this.nodes[peer].heldTurn[from][turn % HISTORY] === turn
  }

  holdsAll(peer: number, turn: number): boolean {
    for (let p = 0; p < this.opts.peers; p++)
      if (!this.holds(peer, p, turn)) return false
    return true
  }

  private noteHash(q: number, from: number, turn: number, hash: number) {
    const node = this.nodes[q]
    const slot = turn % HISTORY
    node.hashTurn[from][slot] = turn
    node.hash[from][slot] = hash
    // Compare this peer's own hash with whatever it has for this turn.
    if (node.hashTurn[q][slot] !== turn) return
    for (let p = 0; p < this.opts.peers; p++) {
      if (node.hashTurn[p][slot] !== turn) continue
      if (node.hash[p][slot] === node.hash[q][slot]) continue
      const best = this.firstMismatch
      if (!best || turn < best.turn)
        this.firstMismatch = { turn, detectedAt: this.now, detectedBy: q }
    }
  }

  private execute(q: number, turn: number) {
    const { opts, now } = this
    const node = this.nodes[q]
    const held = turn >= opts.delayTurns
    for (let p = 0; p < opts.peers; p++)
      this.inputs[p] = held ? node.heldCommand[p][turn % HISTORY] : 0
    stepWorld(node.world, this.inputs)

    const desync = opts.desync
    if (desync && desync.peer === q && desync.turn === turn) {
      node.world.x[0] = clampInt(node.world.x[0] + 96, -WORLD_W, WORLD_W)
    }
    const hash = worldChecksum(node.world)

    const stallMs = turn === 0 ? 0 : now - node.readyAt
    node.stalls[turn % HISTORY] = stallMs
    node.totalStallMs += stallMs
    node.turn = turn
    node.startedAt = now
    node.readyAt = now + (opts.minTurnMs?.[q] ?? opts.turnMs)
    if (opts.trace) {
      this.execs.push({
        peer: q,
        turn,
        at: now,
        stallMs,
        checksum: hash,
        inputs: Array.from(this.inputs),
      })
    }

    // Issue this peer's input for a later turn, and tell the others.
    const target = turn + opts.delayTurns
    const command = scriptedCommand(opts.seed, q, target)
    const slot = target % HISTORY
    node.heldTurn[q][slot] = target
    node.heldCommand[q][slot] = command
    const sendHash = turn % (opts.checksumEvery ?? 1) === 0
    if (sendHash) this.noteHash(q, q, turn, hash)
    for (let to = 0; to < opts.peers; to++) {
      if (to === q) continue
      const arrivesAt = now + Math.max(1, opts.latency(q, to, now))
      this.inFlight.push({
        to,
        from: q,
        turn: target,
        command,
        arrivesAt,
        hashTurn: sendHash ? turn : -1,
        hash,
      })
      if (opts.trace) {
        this.sends.push({
          from: q,
          to,
          turn: target,
          command,
          sentAt: now,
          arrivesAt,
        })
      }
    }
  }

  private processMillisecond() {
    const { now, inFlight } = this
    for (let i = inFlight.length - 1; i >= 0; i--) {
      const m = inFlight[i]
      if (m.arrivesAt > now) continue
      const node = this.nodes[m.to]
      const slot = m.turn % HISTORY
      node.heldTurn[m.from][slot] = m.turn
      node.heldCommand[m.from][slot] = m.command
      if (m.hashTurn >= 0) this.noteHash(m.to, m.from, m.hashTurn, m.hash)
      inFlight[i] = inFlight[inFlight.length - 1]
      inFlight.pop()
    }
    for (let q = 0; q < this.nodes.length; q++) {
      const node = this.nodes[q]
      const next = node.turn + 1
      if (now >= node.readyAt && this.holdsAll(q, next)) this.execute(q, next)
    }
    this.now = now + 1
  }

  /** Run the network and every peer for `ms` milliseconds. */
  advance(ms: number) {
    for (let i = 0; i < ms; i++) this.processMillisecond()
  }

  /** Run until every peer has executed `turn`. */
  runUntilTurn(turn: number) {
    while (this.nodes.some((n) => n.turn < turn)) this.processMillisecond()
  }

  turnOf(peer: number): number {
    return this.nodes[peer].turn
  }

  worldOf(peer: number): World {
    return this.nodes[peer].world
  }

  /** How far through its current turn a peer's drawing is, 0..1. */
  phaseOf(peer: number): number {
    const node = this.nodes[peer]
    return clampInt((this.now - node.startedAt) / this.opts.turnMs, 0, 1)
  }

  totalStallOf(peer: number): number {
    const node = this.nodes[peer]
    return node.totalStallMs + this.stallingFor(peer)
  }

  /** Milliseconds this peer has been overdue for its next turn, 0 if on time. */
  stallingFor(peer: number): number {
    const node = this.nodes[peer]
    return Math.max(0, this.now - 1 - node.readyAt)
  }

  /** Stall before a past turn, or the running stall before the next one. */
  stallBefore(peer: number, turn: number): number {
    const node = this.nodes[peer]
    return turn > node.turn
      ? this.stallingFor(peer)
      : node.stalls[turn % HISTORY]
  }

  cellState(peer: number, turn: number): CellState {
    const node = this.nodes[peer]
    if (turn < 0) return "none"
    if (turn <= node.turn) {
      if (node.turn - turn >= HISTORY) return "none"
      return node.stalls[turn % HISTORY] > 0 ? "stalled" : "executed"
    }
    if (turn > node.turn + this.opts.delayTurns) return "none"
    if (this.holdsAll(peer, turn)) return "ready"
    return turn === node.turn + 1 && this.stallingFor(peer) > 0
      ? "stalling"
      : "waiting"
  }

  /** True when all peers have run `turn` and their checksums agree. */
  turnAgrees(turn: number): boolean {
    if (turn < 0) return false
    const slot = turn % HISTORY
    const first = this.nodes[0]
    for (let q = 0; q < this.nodes.length; q++) {
      const node = this.nodes[q]
      if (node.hashTurn[q][slot] !== turn) return false
      if (node.hash[q][slot] !== first.hash[0][slot]) return false
    }
    return true
  }
}

/** Fewest turns of scheduling delay that avoid stalls at a steady latency. */
export const stallFreeDelay = (latencyMs: number, turnMs: number) =>
  Math.max(1, Math.ceil(latencyMs / turnMs))

/** Steady time per turn when `latencyMs` (both ways) sets the pace. */
export const effectiveTurnMs = (
  latencyMs: number,
  turnMs: number,
  delayTurns: number
) => Math.max(turnMs, latencyMs / delayTurns)

export interface BandwidthAssumptions {
  units: number
  peers: number
  turnMs: number
  /** Turn number, command and checksum. */
  inputBytes?: number
  /** Position, health and so on, per unit, uncompressed. */
  bytesPerUnit?: number
  /** IPv4 (20) plus UDP (8). */
  headerBytes?: number
}

/** One peer's upload per second, in a full mesh, one message per link per turn. */
export function bandwidth({
  units,
  peers,
  turnMs,
  inputBytes = 12,
  bytesPerUnit = 12,
  headerBytes = 28,
}: BandwidthAssumptions) {
  const messagesPerSecond = ((peers - 1) * 1000) / turnMs
  return {
    inputBytesPerSecond: messagesPerSecond * (headerBytes + inputBytes),
    stateBytesPerSecond:
      messagesPerSecond * (headerBytes + units * bytesPerUnit),
  }
}
