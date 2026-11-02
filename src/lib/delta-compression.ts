/**
 * Delta compressed state sync over an unreliable channel, for one client.
 *
 * Packets are really encoded to bytes and decoded on the other side, so the
 * sizes below are measured, not estimated. The server diffs against the newest
 * snapshot the client has acknowledged, keeps a history of what it sent so that
 * baseline is still available, and falls back to a full snapshot when there is
 * no acknowledgement, the baseline is too old, or the delta would be larger.
 *
 * Packet layout, little endian:
 *   tick u32 · baseline back u8 (0 = full snapshot) · entity count u16
 *   full:  N × (x u16, y u16, heading u16, health u8)
 *   delta: changed bitmask ceil(N / 8) bytes, then for each set bit one field
 *          mask byte followed by the fields it names
 *
 * Everything is seeded and independent streams drive motion and each direction
 * of the network, so changing the loss never changes what the world does.
 */
import { mulberry32 } from "./noise"

export const TICK_HZ = 10
/** Network delay each way, in ticks: 200 ms round trip at 10 Hz. */
export const ONE_WAY_TICKS = 1
/** Oldest baseline the server will still diff against, in ticks. */
export const MAX_BASELINE_AGE = 16

export const FIELDS = 4
/** Encoded size of x, y, heading and health. */
export const FIELD_BYTES = [2, 2, 2, 1] as const
export const ENTITY_BYTES = 7
export const HEADER_BYTES = 7

/** Mean length of a walk, in ticks. */
export const MEAN_BOUT = 4
/** Mean length of a run of lost packets, in ticks. */
export const MEAN_BURST = 6
/** Chance per tick that a moving entity also turns. */
const TURN_CHANCE = 0.3
/** Chance per tick that any entity's health changes. */
const DEFAULT_HIT_CHANCE = 0.002
/** Ticks kept for the strip and the rolling rates. */
export const RECORD_TICKS = 64
const RATE_TICKS = TICK_HZ * 5
/** Its first long loss burst starts about 2 s in, so the visual shows it early. */
export const DEFAULT_SEED = 3

export const LOST = 1
export const FULL = 2

export type PacketKind =
  | "delta"
  | "full-delta-off"
  | "full-no-ack"
  | "full-too-old"
  | "full-smaller"

export type BaselinePolicy =
  /** Diff against the newest snapshot the client has confirmed. */
  | "acknowledged"
  /** The broken version: assume the previous packet arrived. */
  | "last-sent"

export type ReceiveResult = "applied" | "stale" | "no-baseline"

export const fullPacketBytes = (n: number) => HEADER_BYTES + n * ENTITY_BYTES
export const maskBytes = (n: number) => Math.ceil(n / 8)
/** Every field of every entity changed: the largest a delta can be. */
export const maxPacketBytes = (n: number) =>
  HEADER_BYTES + maskBytes(n) + n * (1 + ENTITY_BYTES)

/**
 * Share of entities that differ from a baseline k ticks old, for walks that
 * start and stop as this module's world does. `share` of them are walking now,
 * and each tick more start: 1 − (1 − p)(1 − a)^(k − 1). Ignores health changes
 * and an entity returning to exactly its old value.
 */
export function expectedChangedShare(share: number, ageTicks: number) {
  if (ageTicks <= 0) return 0
  return 1 - (1 - share) * (1 - walkRates(share).start) ** (ageTicks - 1)
}

/** Start and stop chances that keep `share` of entities walking on average. */
function walkRates(share: number) {
  if (share <= 0) return { start: 0, stop: 1 }
  if (share >= 1) return { start: 1, stop: 0 }
  const start = Math.min(1, ((1 / MEAN_BOUT) * share) / (1 - share))
  return { start, stop: (start * (1 - share)) / share }
}

function writeHeader(
  out: Uint8Array,
  tick: number,
  back: number,
  count: number
) {
  out[0] = tick & 255
  out[1] = (tick >>> 8) & 255
  out[2] = (tick >>> 16) & 255
  out[3] = (tick >>> 24) & 255
  out[4] = back
  out[5] = count & 255
  out[6] = (count >>> 8) & 255
}

export const packetTick = (p: Uint8Array) =>
  (p[0] | (p[1] << 8) | (p[2] << 16) | (p[3] << 24)) >>> 0
/** How many ticks before this packet its baseline is. 0 means a full snapshot. */
export const packetBack = (p: Uint8Array) => p[4]
export const packetCount = (p: Uint8Array) => p[5] | (p[6] << 8)

function writeField(
  out: Uint8Array,
  at: number,
  field: number,
  value: number
): number {
  out[at++] = value & 255
  if (FIELD_BYTES[field] === 2) out[at++] = (value >>> 8) & 255
  return at
}

/** Encodes every entity. Returns the packet length. */
export function encodeFull(
  state: Uint16Array,
  n: number,
  tick: number,
  out: Uint8Array
) {
  writeHeader(out, tick, 0, n)
  let at = HEADER_BYTES
  for (let i = 0; i < n * FIELDS; i++)
    at = writeField(out, at, i % FIELDS, state[i])
  return at
}

/**
 * Encodes what differs from `base`, which is `back` ticks old (1 to 255).
 * Returns the packet length. If `changed` is given it receives 1 per entity
 * that made it into the packet.
 */
export function encodeDelta(
  base: Uint16Array,
  state: Uint16Array,
  n: number,
  tick: number,
  back: number,
  out: Uint8Array,
  changed?: Uint8Array
) {
  writeHeader(out, tick, back, n)
  const maskStart = HEADER_BYTES
  const bytes = maskBytes(n)
  out.fill(0, maskStart, maskStart + bytes)
  let at = maskStart + bytes
  for (let e = 0; e < n; e++) {
    const o = e * FIELDS
    let fieldMask = 0
    for (let f = 0; f < FIELDS; f++)
      if (state[o + f] !== base[o + f]) fieldMask |= 1 << f
    if (changed) changed[e] = fieldMask === 0 ? 0 : 1
    if (fieldMask === 0) continue
    out[maskStart + (e >>> 3)] |= 1 << (e & 7)
    out[at++] = fieldMask
    for (let f = 0; f < FIELDS; f++)
      if (fieldMask & (1 << f)) at = writeField(out, at, f, state[o + f])
  }
  return at
}

function readField(packet: Uint8Array, at: number, field: number) {
  return FIELD_BYTES[field] === 2
    ? packet[at] | (packet[at + 1] << 8)
    : packet[at]
}

/** Decodes into `out`. Deltas start from `base`; a full snapshot ignores it. */
export function decodePacket(
  packet: Uint8Array,
  base: Uint16Array | null,
  out: Uint16Array
) {
  const n = packetCount(packet)
  let at = HEADER_BYTES
  if (packetBack(packet) === 0) {
    for (let i = 0; i < n * FIELDS; i++) {
      const field = i % FIELDS
      out[i] = readField(packet, at, field)
      at += FIELD_BYTES[field]
    }
    return
  }
  if (!base) throw new Error("A delta needs its baseline")
  out.set(base.subarray(0, n * FIELDS))
  const maskStart = at
  at += maskBytes(n)
  for (let e = 0; e < n; e++) {
    if (!(packet[maskStart + (e >>> 3)] & (1 << (e & 7)))) continue
    const fieldMask = packet[at++]
    for (let f = 0; f < FIELDS; f++) {
      if (!(fieldMask & (1 << f))) continue
      out[e * FIELDS + f] = readField(packet, at, f)
      at += FIELD_BYTES[f]
    }
  }
}

/** Ring of past snapshots, indexed by tick. Allocates only on construction. */
export class SnapshotHistory {
  private readonly ticks: Int32Array
  private readonly slots: Uint16Array[]

  constructor(
    n: number,
    readonly capacity: number
  ) {
    this.ticks = new Int32Array(capacity).fill(-1)
    this.slots = Array.from(
      { length: capacity },
      () => new Uint16Array(n * FIELDS)
    )
  }

  /** The slot for `tick`, which evicts whatever was stored there. */
  claim(tick: number) {
    const slot = tick % this.capacity
    this.ticks[slot] = tick
    return this.slots[slot]
  }

  /** The snapshot for `tick`, or null if it was never stored or was evicted. */
  get(tick: number) {
    if (tick < 0) return null
    const slot = tick % this.capacity
    return this.ticks[slot] === tick ? this.slots[slot] : null
  }
}

/** The client's side: applies packets and remembers them as future baselines. */
export class Client {
  readonly history: SnapshotHistory
  private readonly scratch: Uint16Array
  newestTick = -1
  applied = 0
  stale = 0
  rejected = 0

  constructor(
    readonly n: number,
    historySize = MAX_BASELINE_AGE + 1,
    private readonly policy: BaselinePolicy = "acknowledged"
  ) {
    this.history = new SnapshotHistory(n, historySize)
    this.scratch = new Uint16Array(n * FIELDS)
  }

  get state() {
    return this.history.get(this.newestTick)
  }

  receive(packet: Uint8Array): ReceiveResult {
    const tick = packetTick(packet)
    if (tick <= this.newestTick) {
      this.stale++
      return "stale"
    }
    const back = packetBack(packet)
    // The broken policy has no acknowledged baseline to look up.
    const base =
      back === 0
        ? null
        : this.policy === "last-sent"
          ? this.state
          : this.history.get(tick - back)
    if (back !== 0 && !base) {
      this.rejected++
      return "no-baseline"
    }
    // Decode beside the history first, as the slot may be the baseline's own.
    decodePacket(packet, base, this.scratch)
    this.history.claim(tick).set(this.scratch)
    this.newestTick = tick
    this.applied++
    return "applied"
  }
}

export type SimOptions = {
  n: number
  /** Share of entities walking on average, 0 to 1. */
  share: number
  /** Average packet loss in each direction, 0 to 1. */
  loss: number
  delta?: boolean
  seed?: number
  startTick?: number
  hitChance?: number
  policy?: BaselinePolicy
  maxAge?: number
  /** Script losses in tests: return true to drop, false to deliver. */
  drop?: (tick: number, direction: "down" | "up") => boolean | undefined
}

/** Two-state burst loss: packets are lost in runs averaging MEAN_BURST. */
class BurstLoss {
  private bad = false
  private readonly random: () => number

  constructor(seed: number) {
    this.random = mulberry32(seed)
  }

  next(loss: number) {
    const recover = 1 / MEAN_BURST
    const enter = loss >= 1 ? 1 : (recover * loss) / (1 - loss)
    const roll = this.random()
    if (this.bad) this.bad = loss >= 1 || roll >= recover
    else this.bad = roll < enter
    return this.bad
  }
}

export class DeltaSim {
  readonly n: number
  readonly client: Client
  readonly state: Uint16Array
  /** 1 when the entity changed on the newest tick. */
  readonly changedNow: Uint8Array
  /** 1 when the newest packet carries the entity. */
  readonly inPacket: Uint8Array

  share: number
  loss: number
  delta: boolean
  tick: number

  /** Newest ack the server has, -1 before the first. */
  ackedTick = -1
  lastKind: PacketKind = "full-no-ack"
  /** Ticks between the newest packet and its baseline, 0 for a full snapshot. */
  lastAge = 0
  lastBytes = 0

  sentPackets = 0
  lostPackets = 0
  totalBytes = 0
  fullPackets = 0
  tooOldFallbacks = 0

  private readonly maxAge: number
  private readonly hitChance: number
  private readonly policy: BaselinePolicy
  private readonly drop: SimOptions["drop"]
  private readonly walking: Uint8Array
  private readonly worldRandom: () => number
  private readonly downLoss: BurstLoss
  private readonly upLoss: BurstLoss
  private readonly sent: SnapshotHistory
  private readonly inFlight: Uint8Array[]
  private readonly flightTick: Int32Array
  private readonly ackTick: Int32Array
  private readonly ackValue: Int32Array
  private readonly recBytes = new Int32Array(RECORD_TICKS)
  private readonly recFlags = new Uint8Array(RECORD_TICKS)
  private readonly recAge = new Int16Array(RECORD_TICKS)
  private recCount = 0

  constructor(options: SimOptions) {
    const { n, seed = DEFAULT_SEED } = options
    this.n = n
    this.share = options.share
    this.loss = options.loss
    this.delta = options.delta ?? true
    this.tick = options.startTick ?? 0
    this.maxAge = options.maxAge ?? MAX_BASELINE_AGE
    this.hitChance = options.hitChance ?? DEFAULT_HIT_CHANCE
    this.policy = options.policy ?? "acknowledged"
    this.drop = options.drop
    this.client = new Client(n, this.maxAge + 1, this.policy)
    this.sent = new SnapshotHistory(n, this.maxAge + 1)
    this.state = new Uint16Array(n * FIELDS)
    this.changedNow = new Uint8Array(n)
    this.inPacket = new Uint8Array(n)
    this.walking = new Uint8Array(n)
    this.worldRandom = mulberry32(seed)
    this.downLoss = new BurstLoss(seed + 101)
    this.upLoss = new BurstLoss(seed + 202)
    const flight = ONE_WAY_TICKS + 1
    this.inFlight = Array.from(
      { length: flight },
      () => new Uint8Array(maxPacketBytes(n))
    )
    this.flightTick = new Int32Array(flight).fill(-1)
    this.ackTick = new Int32Array(flight).fill(-1)
    this.ackValue = new Int32Array(flight).fill(-1)

    const random = this.worldRandom
    for (let e = 0; e < n; e++) {
      const o = e * FIELDS
      this.state[o] = Math.floor(random() * 65536)
      this.state[o + 1] = Math.floor(random() * 65536)
      this.state[o + 2] = Math.floor(random() * 65536)
      this.state[o + 3] = 100
      this.walking[e] = random() < this.share ? 1 : 0
    }
  }

  /** Runs one server tick: world, incoming ack, packet out, client in, ack out. */
  step() {
    const t = this.tick
    this.stepWorld()

    const arriving = t % this.ackTick.length
    if (this.ackTick[arriving] === t)
      this.ackedTick = Math.max(this.ackedTick, this.ackValue[arriving])

    this.send(t)

    const due = t - ONE_WAY_TICKS
    if (due >= 0) {
      const slot = due % this.inFlight.length
      if (this.flightTick[slot] === due)
        this.client.receive(this.inFlight[slot])
    }

    // The client acks every tick, in the same stream as its inputs, so losing
    // one ack costs nothing once the next one lands.
    const ackLost = this.drop?.(t, "up") ?? this.upLoss.next(this.loss)
    if (this.client.newestTick >= 0 && !ackLost) {
      const at = t + ONE_WAY_TICKS
      const slot = at % this.ackTick.length
      this.ackTick[slot] = at
      this.ackValue[slot] = this.client.newestTick
    }
    this.tick = t + 1
  }

  /** Bytes the newest `ticksBack`-old packet took, with its flags and age. */
  recordBytes(ticksBack: number) {
    return this.recBytes[this.recSlot(ticksBack)]
  }
  recordFlags(ticksBack: number) {
    return this.recFlags[this.recSlot(ticksBack)]
  }
  recordAge(ticksBack: number) {
    return this.recAge[this.recSlot(ticksBack)]
  }
  get recorded() {
    return Math.min(this.recCount, RECORD_TICKS)
  }

  /** Rolling server-to-client rates over the last 5 s, lost packets included. */
  rates() {
    const ticks = Math.min(this.recCount, RATE_TICKS)
    let bytes = 0
    for (let i = 0; i < ticks; i++) bytes += this.recordBytes(i)
    const full = fullPacketBytes(this.n)
    const bytesPerSecond = ticks ? (bytes / ticks) * TICK_HZ : 0
    const fullPerSecond = full * TICK_HZ
    return {
      bytesPerSecond,
      fullPerSecond,
      saving: ticks ? 1 - bytesPerSecond / fullPerSecond : 0,
    }
  }

  private recSlot(ticksBack: number) {
    return (this.recCount - 1 - ticksBack + RECORD_TICKS * 2) % RECORD_TICKS
  }

  private stepWorld() {
    const { state, walking, changedNow, n, hitChance } = this
    const random = this.worldRandom
    const { start, stop } = walkRates(this.share)
    for (let e = 0; e < n; e++) {
      const o = e * FIELDS
      if (walking[e]) {
        if (random() < stop) walking[e] = 0
      } else if (random() < start) walking[e] = 1
      let changed = 0
      if (walking[e]) {
        state[o] = (state[o] + 1 + Math.floor(random() * 64)) & 0xffff
        state[o + 1] = (state[o + 1] + 1 + Math.floor(random() * 64)) & 0xffff
        if (random() < TURN_CHANCE)
          state[o + 2] =
            (state[o + 2] + 1 + Math.floor(random() * 4096)) & 0xffff
        changed = 1
      }
      if (random() < hitChance) {
        state[o + 3] = (state[o + 3] + 1 + Math.floor(random() * 50)) & 0xff
        changed = 1
      }
      changedNow[e] = changed
    }
  }

  private send(t: number) {
    const { n, state, sent } = this
    sent.claim(t).set(state)
    const slot = t % this.inFlight.length
    const out = this.inFlight[slot]

    const baseTick = this.policy === "last-sent" ? t - 1 : this.ackedTick
    const base = sent.get(baseTick)
    const age = t - baseTick
    let kind: PacketKind
    let length = 0
    if (!this.delta) kind = "full-delta-off"
    else if (baseTick < 0 || (this.policy === "last-sent" && !base))
      kind = "full-no-ack"
    else if (age > this.maxAge || !base) kind = "full-too-old"
    else {
      length = encodeDelta(base, state, n, t, age, out, this.inPacket)
      kind = length < fullPacketBytes(n) ? "delta" : "full-smaller"
    }
    if (kind !== "delta") {
      length = encodeFull(state, n, t, out)
      this.inPacket.fill(1)
    }

    const lost = this.drop?.(t, "down") ?? this.downLoss.next(this.loss)
    this.flightTick[slot] = lost ? -1 : t

    this.lastKind = kind
    this.lastAge = kind === "delta" ? age : 0
    this.lastBytes = length
    this.sentPackets++
    this.totalBytes += length
    if (lost) this.lostPackets++
    if (kind !== "delta") this.fullPackets++
    if (kind === "full-too-old") this.tooOldFallbacks++

    const rec = this.recCount % RECORD_TICKS
    this.recBytes[rec] = length
    this.recFlags[rec] = (lost ? LOST : 0) | (kind !== "delta" ? FULL : 0)
    this.recAge[rec] = this.lastAge
    this.recCount++
  }
}
