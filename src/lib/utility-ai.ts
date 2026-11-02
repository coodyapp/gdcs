/**
 * Utility AI: each action scores itself from normalized inputs pushed through
 * response curves, the scores of its considerations multiply, and the best
 * action wins. Everything here is pure or takes its random source as an
 * argument, so a seeded run replays exactly.
 */
import { mulberry32, weightedPick, type Rand } from "./weighted-random"

export type CurveKind = "linear" | "quadratic" | "logistic"

const LOGISTIC_K = 10
const LOGISTIC_MID = 0.5
const rawLogistic = (x: number) =>
  1 / (1 + Math.exp(-LOGISTIC_K * (x - LOGISTIC_MID)))
const LOGISTIC_0 = rawLogistic(0)
const LOGISTIC_1 = rawLogistic(1)

/** Clamp to 0..1. NaN counts as 0, so a broken input vetoes instead of spreading. */
export function clamp01(x: number) {
  if (Number.isNaN(x)) return 0
  return Math.min(1, Math.max(0, x))
}

/** Textbook logistic, unscaled: it never quite reaches 0 or 1. */
export const unscaledLogistic = (x: number) => rawLogistic(clamp01(x))

/**
 * Maps a normalized input to a normalized score. All three curves return
 * exactly 0 at 0 and exactly 1 at 1; the logistic is rescaled to do so,
 * otherwise an input of 0 would score about 0.0067 and could never veto.
 */
export function responseCurve(kind: CurveKind, input: number) {
  const x = clamp01(input)
  if (kind === "linear") return x
  if (kind === "quadratic") return x * x
  return clamp01((rawLogistic(x) - LOGISTIC_0) / (LOGISTIC_1 - LOGISTIC_0))
}

/**
 * Dave Mark's compensation for one consideration of an action that has `count`
 * considerations: `s + (1 - s) * (1 - 1 / count) * s`. It offsets part of the
 * shrink from multiplying `count` numbers below 1. It leaves 0 and 1 alone and
 * changes nothing when `count` is 1.
 */
export function compensate(score: number, count: number) {
  const s = clamp01(score)
  const n = Math.max(1, count)
  return s + (1 - s) * (1 - 1 / n) * s
}

/**
 * Multiplies considerations, optionally compensated. A zero vetoes the action
 * and an action with no considerations scores 0: it has no reason to run.
 */
export function scoreAction(
  considerations: readonly number[],
  useCompensation = true
) {
  const n = considerations.length
  if (n === 0) return 0
  let product = 1
  for (let i = 0; i < n; i++) {
    const s = clamp01(considerations[i])
    if (s === 0) return 0
    product *= useCompensation ? compensate(s, n) : s
  }
  return product
}

/**
 * Index of the best action, or -1 when every score is 0. The current action's
 * score is multiplied by `1 + bonus`, so a vetoed action cannot hold on. Ties go
 * to the current action, then to the lowest index.
 */
export function chooseBest(scores: ArrayLike<number>, current = -1, bonus = 0) {
  let best = -1
  let bestScore = 0
  for (let i = 0; i < scores.length; i++) {
    const s = i === current ? scores[i] * (1 + bonus) : scores[i]
    if (s > bestScore || (s === bestScore && s > 0 && i === current)) {
      best = i
      bestScore = s
    }
  }
  return best
}

/**
 * Weighted pick among the `topCount` highest scores, in proportion to score.
 * Equal scores rank by index. Returns -1 when every score is 0.
 */
export function pickAmongTop(
  scores: readonly number[],
  topCount: number,
  rand: Rand
) {
  const ranked = scores
    .map((score, index) => ({ score, index }))
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(1, topCount))
  if (ranked.length === 0) return -1
  return ranked[
    weightedPick(
      ranked.map((a) => a.score),
      rand
    )
  ].index
}

/**
 * Smallest multiplicative bonus that stops noise alone from flipping two
 * actions whose scores both sit within `true ± noise`.
 */
export const bonusToAbsorbNoise = (score: number, noise: number) =>
  (score + noise) / (score - noise) - 1

// A small world: an agent choosing between food, cover and wandering.

export const EAT = 0
export const HIDE = 1
export const WANDER = 2
export const ACTION_COUNT = 3
export const ACTION_NAMES = ["Eat", "Hide", "Wander"] as const

export const FOOD = { x: -0.7, y: -0.55 } as const
export const COVER = { x: 0.7, y: -0.55 } as const

/** Decisions per second, and how many of them the history keeps (30 s). */
export const DECISION_HZ = 10
export const HISTORY = 300

const AGENT_SPEED = 0.7
const EAT_RANGE = 0.08
const EAT_RATE = 0.22
const SENSOR_NOISE = 0.05
const WANDER_APPEAL = 0.35

export interface WorldParams {
  /** Mean danger, 0..1. */
  danger: number
  /** Hunger gained per second. */
  hungerRate: number
  /** Multiplicative bonus for the action already running: 0.2 means +20%. */
  bonus: number
  curve: CurveKind
}

export interface WorldSim {
  rand: Rand
  time: number
  sinceDecision: number
  hunger: number
  danger: number
  x: number
  y: number
  /** Index of the running action. */
  action: number
  /** Latest score per action, before the commitment bonus. */
  scores: Float64Array
  /** Circular log of the action chosen at each decision. */
  history: Int8Array
  /** Decisions made so far; the next one is stored at `decisions % HISTORY`. */
  decisions: number
  switches: number
  /** Value of `time` at the most recent switch. */
  lastSwitch: number
}

export function createWorld(seed: number): WorldSim {
  return {
    rand: mulberry32(seed),
    time: 0,
    sinceDecision: 0,
    hunger: 0.45,
    danger: 0,
    x: 0,
    y: 0.4,
    action: WANDER,
    scores: new Float64Array(ACTION_COUNT),
    history: new Int8Array(HISTORY),
    decisions: 0,
    switches: 0,
    lastSwitch: -Infinity,
  }
}

/** Danger drifts around its mean on two slow, unrelated waves. */
export const dangerAt = (mean: number, t: number) =>
  clamp01(
    mean +
      0.16 * Math.sin((2 * Math.PI * t) / 19) +
      0.06 * Math.sin((2 * Math.PI * t) / 5.3)
  )

/** Scores one decision from sensor readings, into `out`. */
export function scoreWorld(
  hunger: number,
  danger: number,
  curve: CurveKind,
  out: Float64Array
) {
  const safety = 1 - clamp01(danger)
  out[EAT] = compensatedPair(responseCurve(curve, hunger), safety)
  out[HIDE] = scoreOne(responseCurve(curve, danger))
  out[WANDER] = compensatedPair(WANDER_APPEAL, safety)
  return out
}

// Same results as scoreAction, without building an array per decision.
const compensatedPair = (a: number, b: number) =>
  compensate(a, 2) * compensate(b, 2)
const scoreOne = (a: number) => compensate(a, 1)

function wanderTarget(t: number, out: { x: number; y: number }) {
  out.x = 0.75 * Math.sin(t * 0.5)
  out.y = 0.45 + 0.25 * Math.sin(t * 0.83)
}
const target = { x: 0, y: 0 }

/** Advances the world by `dt` seconds, deciding at DECISION_HZ. */
export function stepWorld(sim: WorldSim, p: WorldParams, dt: number) {
  sim.time += dt
  sim.danger = dangerAt(p.danger, sim.time)

  sim.sinceDecision += dt
  const period = 1 / DECISION_HZ
  while (sim.sinceDecision >= period) {
    sim.sinceDecision -= period
    decide(sim, p)
  }

  if (sim.action === EAT) {
    target.x = FOOD.x
    target.y = FOOD.y
  } else if (sim.action === HIDE) {
    target.x = COVER.x
    target.y = COVER.y
  } else {
    wanderTarget(sim.time, target)
  }
  const dx = target.x - sim.x
  const dy = target.y - sim.y
  const d = Math.hypot(dx, dy)
  if (d > 1e-6) {
    const move = Math.min(AGENT_SPEED * dt, d)
    sim.x += (dx / d) * move
    sim.y += (dy / d) * move
  }

  const atFood = Math.hypot(FOOD.x - sim.x, FOOD.y - sim.y) < EAT_RANGE
  const eating = sim.action === EAT && atFood
  sim.hunger = clamp01(sim.hunger + (eating ? -EAT_RATE : p.hungerRate) * dt)
}

function decide(sim: WorldSim, p: WorldParams) {
  // Always two draws, so runs with different bonuses see the same noise.
  const hungerNoise = (sim.rand() * 2 - 1) * SENSOR_NOISE
  const dangerNoise = (sim.rand() * 2 - 1) * SENSOR_NOISE
  scoreWorld(
    sim.hunger + hungerNoise,
    sim.danger + dangerNoise,
    p.curve,
    sim.scores
  )
  const next = chooseBest(sim.scores, sim.action, p.bonus)
  if (next !== -1 && next !== sim.action) {
    sim.action = next
    sim.switches++
    sim.lastSwitch = sim.time
  }
  sim.history[sim.decisions % HISTORY] = sim.action
  sim.decisions++
}

/** Switches per minute over the history window (or the whole run if shorter). */
export function switchesPerMinute(sim: WorldSim) {
  const n = Math.min(sim.decisions, HISTORY)
  if (n < 2) return 0
  let count = 0
  const start = sim.decisions - n
  for (let i = start + 1; i < sim.decisions; i++) {
    if (sim.history[i % HISTORY] !== sim.history[(i - 1) % HISTORY]) count++
  }
  return (count * 60 * DECISION_HZ) / (n - 1)
}

/** Runs `seconds` of the world from a seed, without drawing anything. */
export function runWorld(
  seed: number,
  p: WorldParams,
  seconds: number,
  dt = 1 / 30
) {
  const sim = createWorld(seed)
  const steps = Math.round(seconds / dt)
  for (let i = 0; i < steps; i++) stepWorld(sim, p, dt)
  return sim
}
