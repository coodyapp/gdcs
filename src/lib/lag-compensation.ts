/**
 * Server-side lag compensation: keep a short history of hitboxes, rewind to the
 * moment the shooter saw, test the shot there. Everything here is pure, and
 * `simulateLane` replays one deterministic cycle so the visual and the tests
 * see the same data. Times are in seconds, distances in world units.
 */

export interface Point {
  x: number
  y: number
}

/** A hitbox position stored on one server tick. */
export interface Tick extends Point {
  time: number
}

/**
 * How old the shooter's view is when the shot reaches the server: one way down
 * plus the interpolation delay on screen, plus one way back up with the shot.
 */
export const totalDelay = (latency: number, interp: number): number =>
  latency + interp

/** The rewind actually applied: the full delay, up to the cap. */
export const clampRewind = (delay: number, maxRewind: number): number =>
  Math.min(Math.max(delay, 0), Math.max(maxRewind, 0))

/** How far a target has moved between the shooter's view and the server's present. */
export const targetOffset = (speed: number, delay: number): number =>
  Math.abs(speed) * delay

/**
 * Turns a view time claimed by the client into a rewind the server accepts. It
 * can never exceed what the measured latency explains (plus a tolerance for
 * jitter) or the cap, and it can never reach into the future.
 */
export function acceptedRewind({
  now,
  claimedViewTime,
  measuredLatency,
  interp,
  tolerance,
  maxRewind,
}: {
  now: number
  claimedViewTime: number
  measuredLatency: number
  interp: number
  tolerance: number
  maxRewind: number
}): number {
  const plausible = totalDelay(measuredLatency, interp) + tolerance
  return clampRewind(now - claimedViewTime, Math.min(plausible, maxRewind))
}

/**
 * Ticks to store so that `now - maxRewind` stays bracketed, even when the newest
 * tick is almost a full tick old.
 */
export const historyCapacity = (maxRewind: number, tickHz: number): number =>
  Math.ceil(maxRewind * tickHz - 1e-9) + 2

/** Returns a copy with `tick` appended and only the newest `capacity` ticks kept. */
export function pushTick(
  history: readonly Tick[],
  tick: Tick,
  capacity: number
): Tick[] {
  const start = Math.max(history.length + 1 - capacity, 0)
  return [...history.slice(start), tick]
}

/**
 * Position at `time`, blended between the two ticks around it. Times outside the
 * stored range hold the oldest or newest tick. Writes into `out`, so a scene can
 * call it every frame without allocating.
 */
export function sampleHistory(
  history: readonly Tick[],
  time: number,
  out: Point = { x: 0, y: 0 }
): Point {
  const last = history.length - 1
  if (last < 0) throw new Error("sampleHistory: empty history")
  let a = history[0]
  let b = history[last]
  if (time <= a.time) b = a
  else if (time >= b.time) a = b
  else {
    let lo = 0
    let hi = last
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (history[mid].time <= time) lo = mid
      else hi = mid
    }
    a = history[lo]
    b = history[hi]
  }
  const span = b.time - a.time
  const alpha = span > 0 ? (time - a.time) / span : 0
  out.x = a.x + (b.x - a.x) * alpha
  out.y = a.y + (b.y - a.y) * alpha
  return out
}

/**
 * Where a ray from `origin` through `through` enters a square hitbox, as a
 * multiple of origin→through (1 = at `through`), or -1 when it misses.
 */
export function rayEntersBox(
  origin: Point,
  through: Point,
  center: Point,
  half: number
): number {
  let near = 0
  let far = Infinity
  for (const axis of ["x", "y"] as const) {
    const d = through[axis] - origin[axis]
    const lo = center[axis] - half - origin[axis]
    const hi = center[axis] + half - origin[axis]
    if (d === 0) {
      if (lo > 0 || hi < 0) return -1
      continue
    }
    near = Math.max(near, Math.min(lo / d, hi / d))
    far = Math.min(far, Math.max(lo / d, hi / d))
  }
  return near <= far ? near : -1
}

export interface ShotResult {
  hit: boolean
  /** The rewind applied: 0 with compensation off. */
  rewind: number
  /** The hitbox position used for the test. */
  tested: Point
  /** Entry along shooter→aim, or -1 on a miss. */
  entry: number
}

/** The server's verdict on a shot, from its own history and never the client's claim. */
export function resolveShot({
  history,
  now,
  shooter,
  aim,
  rewind,
  compensation,
  half,
}: {
  history: readonly Tick[]
  now: number
  shooter: Point
  aim: Point
  rewind: number
  compensation: boolean
  half: number
}): ShotResult {
  const applied = compensation ? rewind : 0
  const tested = sampleHistory(history, now - applied)
  const entry = rayEntersBox(shooter, aim, tested, half)
  return { hit: entry >= 0, rewind: applied, tested, entry }
}

/**
 * The most the holder can take to react and still have their shot processed
 * first. The peeker's own latency cancels: their move and their shot take the
 * same road to the server. `buffers` is all server and client buffering.
 */
export const holderReactionBudget = (
  peekerReaction: number,
  holderLatency: number,
  buffers: number
): number => peekerReaction - holderLatency - buffers

/* ---------- The lane used by the visual ---------- */

export const LANE = {
  y: 1.75,
  halfWidth: 5.5,
  speed: 5,
  tickHz: 30,
  /** Half size of the square hitbox. */
  half: 0.4,
  shooter: { x: 0, y: -2.3 } as Point,
  /** Time between shots reaching the server. */
  shotInterval: 1.1,
  /** Freeze-frame length at each shot, so the verdict can be read. */
  hold: 0.75,
} as const

const CROSSING = (2 * LANE.halfWidth) / LANE.speed
/** One return trip across the lane: the target and the shots then repeat. */
export const CYCLE = 2 * CROSSING
export const SHOTS_PER_CYCLE = Math.round(CYCLE / LANE.shotInterval)

/** The server's true target position: back and forth along the lane. */
export function targetPosition(t: number, out: Point = { x: 0, y: 0 }): Point {
  const p = ((t % CYCLE) + CYCLE) % CYCLE
  const along = p < CROSSING ? p : CYCLE - p
  out.x = LANE.speed * along - LANE.halfWidth
  out.y = LANE.y
  return out
}

/** The server's tick history, from before the first cycle's largest possible rewind. */
export function laneHistory(lead = 2): Tick[] {
  const first = -Math.ceil(lead * LANE.tickHz)
  const last = Math.ceil(CYCLE * LANE.tickHz)
  const ticks: Tick[] = []
  for (let i = first; i <= last; i++) {
    const time = i / LANE.tickHz
    ticks.push({ time, ...targetPosition(time) })
  }
  return ticks
}

export interface LaneParams {
  /** Shooter round-trip latency. */
  latency: number
  interp: number
  compensation: boolean
  maxRewind: number
}

export interface LaneShot extends ShotResult {
  time: number
  /** Where the shooter aimed: the target as they saw it. */
  aim: Point
  /** Where the target truly was when the server ran the test. */
  truth: Point
}

export interface LaneRun {
  delay: number
  rewind: number
  offset: number
  capped: boolean
  shots: LaneShot[]
  hits: number
}

/** Shots are scheduled mid-interval, so with up to 0.55 s of delay none straddles a turn. */
export const shotTime = (index: number): number =>
  (index + 0.5) * LANE.shotInterval

/** Replays one cycle: each shot is aimed perfectly at what the shooter saw. */
export function simulateLane(
  params: LaneParams,
  history: readonly Tick[] = laneHistory()
): LaneRun {
  const delay = totalDelay(params.latency, params.interp)
  const rewind = params.compensation ? clampRewind(delay, params.maxRewind) : 0
  const shots: LaneShot[] = []
  for (let i = 0; i < SHOTS_PER_CYCLE; i++) {
    const time = shotTime(i)
    const aim = targetPosition(time - delay)
    const result = resolveShot({
      history,
      now: time,
      shooter: LANE.shooter,
      aim,
      rewind,
      compensation: params.compensation,
      half: LANE.half,
    })
    shots.push({ ...result, time, aim, truth: targetPosition(time) })
  }
  return {
    delay,
    rewind,
    offset: targetOffset(LANE.speed, delay),
    capped: params.compensation && delay > params.maxRewind,
    shots,
    hits: shots.filter((s) => s.hit).length,
  }
}

const SHOT_PERIOD = LANE.shotInterval + LANE.hold

/** Maps the wall clock to simulated time, which freezes during each shot's hold. */
export function laneTime(clock: number): number {
  const lap = Math.floor(clock / SHOT_PERIOD)
  const r = clock - lap * SHOT_PERIOD
  const half = LANE.shotInterval / 2
  const inLap = r < half ? r : r < half + LANE.hold ? half : r - LANE.hold
  return lap * LANE.shotInterval + inLap
}

/** How many shots have reached the server by this clock time. */
export const shotsFired = (clock: number): number =>
  Math.floor((clock - LANE.shotInterval / 2) / SHOT_PERIOD) + 1

/** True during the freeze-frame of the latest shot. */
export const isHolding = (clock: number): boolean => {
  const fired = shotsFired(clock)
  return (
    fired > 0 &&
    clock - (LANE.shotInterval / 2 + (fired - 1) * SHOT_PERIOD) < LANE.hold
  )
}

/** Hits among the first `fired` shots, which repeat every cycle. */
export function hitsSoFar(run: LaneRun, fired: number): number {
  const laps = Math.floor(fired / SHOTS_PER_CYCLE)
  let hits = laps * run.hits
  for (let i = 0; i < fired % SHOTS_PER_CYCLE; i++) if (run.shots[i].hit) hits++
  return hits
}
