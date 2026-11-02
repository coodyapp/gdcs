/**
 * Per-client bandwidth budget for a game server.
 *
 * Each send tick the server may spend budget / sendHz bytes on the wire, minus
 * the IP and UDP headers, and never more than one MTU-safe packet. Entities
 * compete for that space in priority order. With the accumulator on, every
 * entity's priority grows each tick and resets when it is sent, so waiting
 * raises its rank. With it off, the same top entities win forever.
 *
 * Everything is integer bytes and whole ticks, so a run replays exactly.
 */
import { mulberry32 } from "./noise"

/** IPv4 (20, no options) + UDP (8). Link-layer framing is not counted. */
export const IPV4_UDP_HEADER = 28
/** IPv6 (40, no extension headers) + UDP (8). */
export const IPV6_UDP_HEADER = 48
/** A common conservative payload limit. The real limit is the path's MTU. */
export const SAFE_PAYLOAD = 1200
/** Game packet preamble: sequence, ack, entity count. Counts as payload. */
export const GAME_HEADER = 8
/** Age the visual flags as stale. A judgement call, not a standard. */
export const STALE_LIMIT_MS = 1000

const MIN_STATE = 16
const STATE_SPREAD = 17 // sizes run from 16 to 32 bytes

export const kbitToBytes = (kbitPerSecond: number) => (kbitPerSecond * 1000) / 8

/** Bytes per second on the wire for fixed-size packets. */
export const wireRate = (
  payload: number,
  sendHz: number,
  header = IPV4_UDP_HEADER
) => (payload + header) * sendHz

/** Fraction of the wire rate spent on IP and UDP headers. */
export const headerShare = (payload: number, header = IPV4_UDP_HEADER) =>
  header / (payload + header)

/** Whole bytes one send tick may use on the wire. */
export const tickAllowance = (budget: number, sendHz: number) =>
  Math.floor(budget / sendHz)

/** Largest payload one tick can carry: limited by budget or MTU, whichever is lower. */
export const packetCapacity = (
  budget: number,
  sendHz: number,
  header = IPV4_UDP_HEADER,
  mtuPayload = SAFE_PAYLOAD
) => Math.max(0, Math.min(tickAllowance(budget, sendHz) - header, mtuPayload))

/** Server egress in bytes for `clients` receiving `rate` bytes per second. */
export const egressBytes = (clients: number, rate: number, seconds: number) =>
  clients * rate * seconds

export interface Entities {
  /** Base priority per tick, highest first: 1 down to 0.1, evenly on a log scale. */
  priority: Float64Array
  /** Serialized state size in bytes, 16 to 32. */
  size: Int32Array
}

export function makeEntities(count: number, seed = 11): Entities {
  const priority = new Float64Array(count)
  const size = new Int32Array(count)
  const random = mulberry32(seed)
  for (let i = 0; i < count; i++) {
    priority[i] = count > 1 ? Math.pow(10, -i / (count - 1)) : 1
    size[i] = MIN_STATE + Math.floor(random() * STATE_SPREAD)
  }
  return { priority, size }
}

/**
 * Steady-state ticks between sends of entity i with the accumulator on. All
 * entities are sent at about the same accumulated priority θ, so entity i waits
 * θ / p_i ticks. Bytes sent per tick must equal the capacity for state C, which
 * gives θ = Σ(p_j s_j) / C.
 */
export function refreshEstimate(
  { priority, size }: Entities,
  i: number,
  stateCapacity: number
) {
  let sum = 0
  for (let j = 0; j < priority.length; j++) sum += priority[j] * size[j]
  return sum / (stateCapacity * priority[i])
}

export interface BudgetConfig {
  /** Wire budget in bytes per second. */
  budget: number
  sendHz: number
  count: number
  accumulator: boolean
  header?: number
  mtuPayload?: number
  seed?: number
}

export class BudgetSim {
  readonly entities: Entities
  readonly sendHz: number
  readonly accumulator: boolean
  readonly header: number
  /** Wire bytes one tick may spend. */
  readonly allowance: number
  /** Payload limit per packet: budget or MTU, whichever is lower. */
  readonly capacity: number
  readonly count: number

  tick = 0
  /** Priority each entity holds; with the accumulator off it is the base value. */
  readonly accumulated: Float64Array
  /** Whole ticks since each entity was last sent. Zero if sent this tick. */
  readonly age: Int32Array
  /** The accumulated priority it was sent at, for drawing; zero when waiting. */
  readonly sentAt: Float64Array
  /** 1 if sent this tick. */
  readonly sent: Uint8Array
  /** Total sends per entity. */
  readonly sends: Int32Array
  /** Entities in this tick's packet, in the order they were written. */
  readonly packet: Int32Array
  packetCount = 0
  /** Payload bytes of this tick's packet, game header included. Zero if none sent. */
  payload = 0
  /** Wire bytes of this tick's packet. Zero if none sent. */
  wire = 0
  /** Largest age seen just before a send decision, in ticks. */
  peakAge = 0
  packetsSent = 0
  updatesSent = 0
  totalWire = 0

  /** The last second of wire bytes. */
  private readonly windowWire: Int32Array
  private readonly windowUpdates: Int32Array
  private readonly windowPackets: Uint8Array
  private readonly order: Int32Array
  private windowWireSum = 0
  private windowUpdateSum = 0
  private windowPacketSum = 0

  constructor(config: BudgetConfig) {
    const { budget, sendHz, count, accumulator, seed } = config
    this.entities = makeEntities(count, seed)
    this.sendHz = sendHz
    this.count = count
    this.accumulator = accumulator
    this.header = config.header ?? IPV4_UDP_HEADER
    this.allowance = tickAllowance(budget, sendHz)
    this.capacity = packetCapacity(
      budget,
      sendHz,
      this.header,
      config.mtuPayload ?? SAFE_PAYLOAD
    )
    this.accumulated = new Float64Array(count)
    if (!accumulator) this.accumulated.set(this.entities.priority)
    this.age = new Int32Array(count)
    this.sentAt = new Float64Array(count)
    this.sent = new Uint8Array(count)
    this.sends = new Int32Array(count)
    this.packet = new Int32Array(count)
    this.order = new Int32Array(count)
    for (let i = 0; i < count; i++) this.order[i] = i
    this.windowWire = new Int32Array(sendHz)
    this.windowUpdates = new Int32Array(sendHz)
    this.windowPackets = new Uint8Array(sendHz)
  }

  /** One send tick. Allocates nothing. */
  step() {
    const { accumulated, age, sent, sentAt, order, packet, count } = this
    const { priority, size } = this.entities
    this.tick++
    for (let i = 0; i < count; i++) {
      if (this.accumulator) accumulated[i] += priority[i]
      age[i]++
      if (age[i] > this.peakAge) this.peakAge = age[i]
      sent[i] = 0
      sentAt[i] = 0
    }

    // Insertion sort, highest first, ties by id. The order barely changes
    // between ticks, and this keeps a run identical on every engine.
    for (let i = 1; i < count; i++) {
      const id = order[i]
      let j = i - 1
      while (j >= 0 && this.ranksBelow(order[j], id)) {
        order[j + 1] = order[j]
        j--
      }
      order[j + 1] = id
    }

    // Walk everything. What does not fit is skipped and keeps its priority.
    let used = GAME_HEADER
    let written = 0
    for (let k = 0; k < count; k++) {
      const id = order[k]
      if (used + size[id] > this.capacity) continue
      used += size[id]
      packet[written++] = id
      sent[id] = 1
      sentAt[id] = accumulated[id]
      age[id] = 0
      this.sends[id]++
      if (this.accumulator) accumulated[id] = 0
    }

    // An empty packet carries nothing here, so it is not sent.
    this.packetCount = written
    this.payload = written > 0 ? used : 0
    this.wire = written > 0 ? used + this.header : 0
    if (written > 0) this.packetsSent++
    this.updatesSent += written
    this.totalWire += this.wire

    const slot = this.tick % this.sendHz
    this.windowWireSum += this.wire - this.windowWire[slot]
    this.windowUpdateSum += written - this.windowUpdates[slot]
    const packets = written > 0 ? 1 : 0
    this.windowPacketSum += packets - this.windowPackets[slot]
    this.windowWire[slot] = this.wire
    this.windowUpdates[slot] = written
    this.windowPackets[slot] = packets
  }

  private ranksBelow(a: number, b: number) {
    const pa = this.accumulated[a]
    const pb = this.accumulated[b]
    return pa < pb || (pa === pb && a > b)
  }

  /** Wire bytes in the last send-rate ticks, which is the last second. */
  get bytesPerSecond() {
    return this.windowWireSum
  }

  /** IP and UDP header share of the last second, 0 to 1. */
  get headerFraction() {
    if (this.windowWireSum === 0) return 0
    return (this.windowPacketSum * this.header) / this.windowWireSum
  }

  /** Average entities per packet over the last second. */
  get entitiesPerPacket() {
    if (this.windowPacketSum === 0) return 0
    return this.windowUpdateSum / this.windowPacketSum
  }

  /** Oldest entity right now, in ticks. */
  get oldestAge() {
    let worst = 0
    for (let i = 0; i < this.count; i++)
      if (this.age[i] > worst) worst = this.age[i]
    return worst
  }

  ticksToMs(ticks: number) {
    return (ticks * 1000) / this.sendHz
  }
}

export interface BudgetSummary {
  bytesPerSecond: number
  updatesPerSecond: number
  entitiesPerPacket: number
  headerFraction: number
  /** Largest age of any entity during the run. */
  worstStalenessMs: number
  /** Entities that were never sent. */
  starved: number
  maxWire: number
  maxPayload: number
}

/** Runs a config for `seconds` of simulated time and sums it up. */
export function measure(config: BudgetConfig, seconds: number): BudgetSummary {
  const sim = new BudgetSim(config)
  let maxWire = 0
  let maxPayload = 0
  const ticks = seconds * config.sendHz
  for (let t = 0; t < ticks; t++) {
    sim.step()
    if (sim.wire > maxWire) maxWire = sim.wire
    if (sim.payload > maxPayload) maxPayload = sim.payload
  }
  let starved = 0
  for (let i = 0; i < sim.count; i++) if (sim.sends[i] === 0) starved++
  return {
    bytesPerSecond: sim.totalWire / seconds,
    updatesPerSecond: sim.updatesSent / seconds,
    entitiesPerPacket:
      sim.packetsSent === 0 ? 0 : sim.updatesSent / sim.packetsSent,
    headerFraction:
      sim.totalWire === 0 ? 0 : (sim.packetsSent * sim.header) / sim.totalWire,
    worstStalenessMs: sim.ticksToMs(sim.peakAge),
    starved,
    maxWire,
    maxPayload,
  }
}
