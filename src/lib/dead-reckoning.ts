/**
 * Dead reckoning: both ends extrapolate an entity from its last shared state,
 * and the owner only sends a new state when its own copy of that extrapolation
 * drifts past a threshold. Everything here is pure, and `simulateRun` replays
 * one deterministic run for the visual and the tests. Seconds and world units.
 */

export interface Kinematics {
  x: number
  y: number
  vx: number
  vy: number
  ax: number
  ay: number
}

/** 1 = position + velocity, 2 = position + velocity + acceleration. */
export type ModelOrder = 1 | 2

export interface Update extends Kinematics {
  /** Sender time at which the state was captured; it travels in the packet. */
  time: number
}

/** The shared model: where an update says the entity is at time `t`. */
export function extrapolate(update: Update, order: ModelOrder, t: number) {
  const dt = t - update.time
  const ax = order === 2 ? update.ax : 0
  const ay = order === 2 ? update.ay : 0
  return {
    x: update.x + update.vx * dt + 0.5 * ax * dt * dt,
    y: update.y + update.vy * dt + 0.5 * ay * dt * dt,
    vx: update.vx + ax * dt,
    vy: update.vy + ay * dt,
    ax,
    ay,
  }
}

export interface BlendStart {
  x: number
  y: number
  vx: number
  vy: number
}

/**
 * Projective velocity blending. Project from where the object was drawn using a
 * velocity that fades from the old one to the new one, then fade that projection
 * onto the corrected path. Lands exactly on `target` when `elapsed` reaches
 * `duration`, and a duration of 0 is a snap.
 */
export function blendTowards(
  start: BlendStart,
  target: Kinematics,
  elapsed: number,
  duration: number
) {
  if (duration <= 0 || elapsed >= duration)
    return { x: target.x, y: target.y, vx: target.vx, vy: target.vy }
  const k = elapsed / duration
  const vx = start.vx + (target.vx - start.vx) * k
  const vy = start.vy + (target.vy - start.vy) * k
  const half = 0.5 * elapsed * elapsed
  const px = start.x + vx * elapsed + target.ax * half
  const py = start.y + vy * elapsed + target.ay * half
  return {
    x: px + (target.x - px) * k,
    y: py + (target.y - py) * k,
    vx,
    vy,
  }
}

export interface RunOptions {
  /** The true motion, known only to the sender. */
  truth: (t: number) => Kinematics
  duration: number
  /** Sender's position error, in world units, that triggers an update. */
  threshold: number
  order: ModelOrder
  /** One-way latency in seconds. */
  latency: number
  /** Seconds spent blending onto each new model; 0 snaps. */
  blend: number
  /** Simulation and threshold-check rate. */
  hz?: number
}

/** The worst moment of one stretch where the drawn object was past the threshold. */
export interface ErrorPeak {
  time: number
  x: number
  y: number
  drawnX: number
  drawnY: number
  error: number
}

export interface Run {
  hz: number
  steps: number
  duration: number
  trueX: Float32Array
  trueY: Float32Array
  /** Where the receiver draws the object. */
  drawnX: Float32Array
  drawnY: Float32Array
  /** Drawn object against the truth at the same instant. */
  error: Float32Array
  /** The sender's own model against the truth, before any update on that tick. */
  senderError: Float32Array
  /** The receiver's unblended model against the truth. */
  modelError: Float32Array
  /** Index of the update in use on each side at each tick. */
  senderUpdate: Int32Array
  receiverUpdate: Int32Array
  updates: Update[]
  peaks: ErrorPeak[]
  updatesPerSecond: number
  maxError: number
  maxSenderError: number
  maxModelError: number
  /** Largest distance the drawn object moved in one tick: how visible a pop is. */
  maxStep: number
}

export function simulateRun(options: RunOptions): Run {
  const { truth, duration, threshold, order, latency, blend } = options
  const hz = options.hz ?? 60
  const h = 1 / hz
  const steps = Math.ceil(duration * hz)
  const latencyTicks = Math.round(latency * hz)
  const blendTicks = Math.round(blend * hz)

  const run: Run = {
    hz,
    steps,
    duration,
    trueX: new Float32Array(steps),
    trueY: new Float32Array(steps),
    drawnX: new Float32Array(steps),
    drawnY: new Float32Array(steps),
    error: new Float32Array(steps),
    senderError: new Float32Array(steps),
    modelError: new Float32Array(steps),
    senderUpdate: new Int32Array(steps),
    receiverUpdate: new Int32Array(steps),
    updates: [],
    peaks: [],
    updatesPerSecond: 0,
    maxError: 0,
    maxSenderError: 0,
    maxModelError: 0,
    maxStep: 0,
  }

  const updates = run.updates
  const sentAt: number[] = []
  let senderIndex = -1
  let receiverIndex = 0
  let blendFrom: BlendStart = { x: 0, y: 0, vx: 0, vy: 0 }
  let blendTick = -1
  let drawn: BlendStart = blendFrom
  let peak: ErrorPeak | null = null

  for (let i = 0; i < steps; i++) {
    const t = i * h
    const now = truth(t)

    // Sender: run the shared model and compare it with the truth.
    let senderError = 0
    if (senderIndex >= 0) {
      const model = extrapolate(updates[senderIndex], order, t)
      senderError = Math.hypot(now.x - model.x, now.y - model.y)
    }
    if (senderIndex < 0 || senderError > threshold) {
      updates.push({ ...now, time: t })
      sentAt.push(i)
      senderIndex++
    }

    // Receiver: both ends share the spawn state, so the first update needs no
    // trip. Later ones arrive a latency later and carry their send time, so the
    // model is evaluated at the same instant as on the sender.
    let arrived = false
    while (
      receiverIndex + 1 < updates.length &&
      sentAt[receiverIndex + 1] + latencyTicks <= i
    ) {
      receiverIndex++
      arrived = true
    }
    if (arrived && blendTicks > 0) {
      blendFrom = {
        x: drawn.x + drawn.vx * h,
        y: drawn.y + drawn.vy * h,
        vx: drawn.vx,
        vy: drawn.vy,
      }
      blendTick = i
    }
    const target = extrapolate(updates[receiverIndex], order, t)
    drawn =
      blendTick >= 0 && i - blendTick < blendTicks
        ? blendTowards(blendFrom, target, (i - blendTick) * h, blendTicks * h)
        : target

    const error = Math.hypot(now.x - drawn.x, now.y - drawn.y)
    const modelError = Math.hypot(now.x - target.x, now.y - target.y)

    run.trueX[i] = now.x
    run.trueY[i] = now.y
    run.drawnX[i] = drawn.x
    run.drawnY[i] = drawn.y
    run.error[i] = error
    run.senderError[i] = senderError
    run.modelError[i] = modelError
    run.senderUpdate[i] = senderIndex
    run.receiverUpdate[i] = receiverIndex
    run.maxError = Math.max(run.maxError, error)
    run.maxSenderError = Math.max(run.maxSenderError, senderError)
    run.maxModelError = Math.max(run.maxModelError, modelError)
    if (i > 0)
      run.maxStep = Math.max(
        run.maxStep,
        Math.hypot(drawn.x - run.drawnX[i - 1], drawn.y - run.drawnY[i - 1])
      )

    if (error > threshold) {
      if (!peak || error > peak.error)
        peak = {
          time: t,
          x: now.x,
          y: now.y,
          drawnX: drawn.x,
          drawnY: drawn.y,
          error,
        }
    } else if (peak) {
      run.peaks.push(peak)
      peak = null
    }
  }
  if (peak) run.peaks.push(peak)

  run.updatesPerSecond = updates.length / duration
  return run
}

/**
 * What holds for the position + velocity model with snapping: the sender keeps
 * its error at `threshold` until one tick before it sends, and the receiver then
 * uses the stale model for one latency more, drifting at no more than the two
 * velocities can differ. Assumes a constant `speed`.
 */
export function snapErrorBound(
  threshold: number,
  speed: number,
  latency: number,
  hz = 60
) {
  return threshold + 2 * speed * (latency + 1 / hz)
}

/** A closed path of straights joined by circular arcs, driven at constant speed. */
type Segment =
  | { kind: "line"; x: number; y: number; dx: number; dy: number; len: number }
  | {
      kind: "arc"
      cx: number
      cy: number
      radius: number
      from: number
      sign: number
      len: number
    }

export interface RoundedPath {
  segments: Segment[]
  length: number
  /** Arc length of the first straight's midpoint, where a lap starts. */
  start: number
}

export function roundedPath(
  vertices: readonly (readonly [number, number])[],
  radius: number
): RoundedPath {
  const n = vertices.length
  const corners = vertices.map((v, i) => {
    const prev = vertices[(i + n - 1) % n]
    const next = vertices[(i + 1) % n]
    const inLen = Math.hypot(v[0] - prev[0], v[1] - prev[1])
    const outLen = Math.hypot(next[0] - v[0], next[1] - v[1])
    const inX = (v[0] - prev[0]) / inLen
    const inY = (v[1] - prev[1]) / inLen
    const outX = (next[0] - v[0]) / outLen
    const outY = (next[1] - v[1]) / outLen
    const turn = Math.atan2(inX * outY - inY * outX, inX * outX + inY * outY)
    const tan = Math.tan(Math.abs(turn) / 2)
    // A corner may use up to just under half of each neighbouring side.
    const cut = Math.min(radius * tan, 0.48 * Math.min(inLen, outLen))
    const r = cut / tan
    const sign = Math.sign(turn)
    const enterX = v[0] - inX * cut
    const enterY = v[1] - inY * cut
    const cx = enterX - inY * sign * r
    const cy = enterY + inX * sign * r
    return {
      enterX,
      enterY,
      exitX: v[0] + outX * cut,
      exitY: v[1] + outY * cut,
      cx,
      cy,
      r,
      sign,
      from: Math.atan2(enterY - cy, enterX - cx),
      sweep: Math.abs(turn),
    }
  })

  const segments: Segment[] = []
  for (let i = 0; i < n; i++) {
    const a = corners[i]
    const b = corners[(i + 1) % n]
    const dx = b.enterX - a.exitX
    const dy = b.enterY - a.exitY
    const len = Math.hypot(dx, dy)
    segments.push({
      kind: "line",
      x: a.exitX,
      y: a.exitY,
      dx: dx / len,
      dy: dy / len,
      len,
    })
    segments.push({
      kind: "arc",
      cx: b.cx,
      cy: b.cy,
      radius: b.r,
      from: b.from,
      sign: b.sign,
      len: b.r * b.sweep,
    })
  }
  return {
    segments,
    length: segments.reduce((sum, s) => sum + s.len, 0),
    start: segments[0].len / 2,
  }
}

/** State at `s` units past the lap start, moving at constant `speed`. */
export function pathState(
  path: RoundedPath,
  s: number,
  speed: number
): Kinematics {
  let rest = (path.start + s) % path.length
  if (rest < 0) rest += path.length
  for (const seg of path.segments) {
    if (rest > seg.len) {
      rest -= seg.len
      continue
    }
    if (seg.kind === "line") {
      return {
        x: seg.x + seg.dx * rest,
        y: seg.y + seg.dy * rest,
        vx: seg.dx * speed,
        vy: seg.dy * speed,
        ax: 0,
        ay: 0,
      }
    }
    const angle = seg.from + (seg.sign * rest) / seg.radius
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const central = (speed * speed) / seg.radius
    return {
      x: seg.cx + seg.radius * cos,
      y: seg.cy + seg.radius * sin,
      vx: -sin * seg.sign * speed,
      vy: cos * seg.sign * speed,
      ax: -cos * central,
      ay: -sin * central,
    }
  }
  return pathState(path, 0, speed)
}

/** The sheet's course: long straights, gentle corners and one hairpin. */
export const COURSE: readonly (readonly [number, number])[] = [
  [-5.2, -3],
  [5.2, -3],
  [5.2, 2.7],
  [1.4, 2.7],
  [0, -0.4],
  [-1.4, 2.7],
  [-5.2, 2.7],
]
export const COURSE_SPEED = 4
export const COURSE_LATENCY = 0.1

/** Sharpness 0 gives wide corners of radius 1.6, sharpness 1 near-instant 0.05 turns. */
export const cornerRadius = (sharpness: number) =>
  1.6 + (0.05 - 1.6) * sharpness

export function courseRun(options: {
  threshold: number
  order: ModelOrder
  blend: number
  sharpness: number
}) {
  const path = roundedPath(COURSE, cornerRadius(options.sharpness))
  return {
    path,
    run: simulateRun({
      truth: (t) => pathState(path, t * COURSE_SPEED, COURSE_SPEED),
      duration: path.length / COURSE_SPEED,
      threshold: options.threshold,
      order: options.order,
      latency: COURSE_LATENCY,
      blend: options.blend,
    }),
  }
}
