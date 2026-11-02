/**
 * Client-side prediction and server reconciliation, as pure functions, plus a
 * deterministic 1D simulation with fake latency for the visual. Nothing here
 * mutates its arguments or reads a clock.
 */

export interface Input {
  /** Sequence number, assigned by the client in send order. */
  seq: number
  /** Displacement this input causes in one tick. */
  move: number
}

/** What the server tells the client: its position and the last input it used. */
export interface ServerState {
  position: number
  ackSeq: number
}

/** The shared movement rule. Client and server must run the same one. */
export const applyInput = (position: number, input: Input) =>
  position + input.move

export const replay = (position: number, inputs: readonly Input[]) =>
  inputs.reduce(applyInput, position)

/**
 * Rewinds to the server's state, drops every input it has acknowledged and
 * replays the rest on top. The result is the new predicted position.
 */
export function reconcile(server: ServerState, pending: readonly Input[]) {
  const kept = pending.filter((input) => input.seq > server.ackSeq)
  return { position: replay(server.position, kept), pending: kept }
}

/** Remaining visual error after `ms`, halving every `halfLifeMs`. */
export const decayError = (error: number, ms: number, halfLifeMs: number) =>
  error * 0.5 ** (ms / halfLifeMs)

// --- Simulation -------------------------------------------------------------

export const TICK_MS = 25
export const TICK_HZ = 1000 / TICK_MS
/** Units per second while the scripted input holds a direction. */
export const SPEED = 3.5
export const START = -3.5
/** The server sends a state every this many ticks (20 Hz at the 40 Hz tick). */
export const SEND_EVERY = 2
export const PUSH_SIZE = 1
export const SMOOTH_HALF_LIFE_MS = 60

const RUN_TICKS = 80
const REST_TICKS = 20
const PERIOD_TICKS = 2 * (RUN_TICKS + REST_TICKS)
const PUSH_AFTER_TICKS = 40
const RETURN_START = RUN_TICKS + REST_TICKS
/** Differences below this are float noise from summing, not disagreement. */
const CORRECTION_EPSILON = 1e-6

/** Scripted input: run right for 2 s, rest 0.5 s, run left for 2 s, rest 0.5 s. */
export function scriptedMove(tick: number) {
  const phase = tick % PERIOD_TICKS
  if (phase < RUN_TICKS) return SPEED / TICK_HZ
  if (phase < RETURN_START) return 0
  if (phase < RETURN_START + RUN_TICKS) return -SPEED / TICK_HZ
  return 0
}

/**
 * Server-only event the client cannot predict: a shove against the direction of
 * travel halfway through each run. The two shoves cancel over one period.
 */
export function scriptedPush(tick: number) {
  const phase = tick % PERIOD_TICKS
  if (phase === PUSH_AFTER_TICKS) return -PUSH_SIZE
  if (phase === RETURN_START + PUSH_AFTER_TICKS) return PUSH_SIZE
  return 0
}

export interface SimConfig {
  /** One-way delay in ticks, each way. */
  latencyTicks: number
  /** Ticks between server states. */
  sendEvery: number
  push: boolean
  /** Starting position (defaults to the left end of the track). */
  start?: number
}

export interface Correction {
  from: number
  to: number
  tick: number
}

export interface SimState {
  tick: number
  /** Authoritative position, on the server, right now. */
  server: ServerState
  /** Newest state the client has received: what it shows without prediction. */
  received: ServerState
  /** Client position with every pending input applied. */
  predicted: number
  /** Sent, applied locally, and not yet acknowledged. */
  pending: readonly Input[]
  /** Visual-only offset that hides corrections. Never fed back into the sim. */
  visualError: number
  lastCorrection: Correction | null
  inputsInFlight: readonly (Input & { arrives: number })[]
  statesInFlight: readonly (ServerState & { arrives: number })[]
}

export function createSim(config: SimConfig): SimState {
  const position = config.start ?? START
  const origin = { position, ackSeq: -1 }
  return {
    tick: 0,
    server: origin,
    received: origin,
    predicted: position,
    pending: [],
    visualError: 0,
    lastCorrection: null,
    inputsInFlight: [],
    statesInFlight: [],
  }
}

/**
 * One tick, in order: the client samples and predicts an input, the server
 * consumes what has arrived and maybe sends a state, the client reconciles.
 */
export function stepSim(state: SimState, config: SimConfig): SimState {
  const { tick } = state
  const input: Input = { seq: tick, move: scriptedMove(tick) }
  let predicted = applyInput(state.predicted, input)
  let pending: readonly Input[] = [...state.pending, input]
  let visualError = decayError(state.visualError, TICK_MS, SMOOTH_HALF_LIFE_MS)

  // Server
  const sent = [
    ...state.inputsInFlight,
    { ...input, arrives: tick + config.latencyTicks },
  ]
  let server = state.server
  for (const arrived of sent) {
    if (arrived.arrives !== tick) continue
    server = {
      position: applyInput(server.position, arrived),
      ackSeq: arrived.seq,
    }
  }
  if (config.push) {
    const position = server.position + scriptedPush(tick)
    server = { ...server, position }
  }
  const replies =
    tick % config.sendEvery === 0
      ? [
          ...state.statesInFlight,
          { ...server, arrives: tick + config.latencyTicks },
        ]
      : state.statesInFlight

  // Client
  let received = state.received
  let lastCorrection = state.lastCorrection
  for (const reply of replies) {
    if (reply.arrives !== tick) continue
    received = { position: reply.position, ackSeq: reply.ackSeq }
    const result = reconcile(received, pending)
    const error = predicted - result.position
    if (Math.abs(error) > CORRECTION_EPSILON) {
      lastCorrection = { from: predicted, to: result.position, tick }
      visualError += error
    }
    predicted = result.position
    pending = result.pending
  }

  return {
    tick: tick + 1,
    server,
    received,
    predicted,
    pending,
    visualError,
    lastCorrection,
    inputsInFlight: sent.filter((x) => x.arrives > tick),
    statesInFlight: replies.filter((x) => x.arrives > tick),
  }
}

/** Runs `ticks` steps from the start. */
export function runSim(config: SimConfig, ticks: number) {
  let state = createSim(config)
  for (let i = 0; i < ticks; i++) state = stepSim(state, config)
  return state
}
