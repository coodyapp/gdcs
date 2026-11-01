/**
 * Small, frame-rate independent helpers behind the game-feel sheets:
 * approach/damping, jump grace timers, hit stop, invulnerability, squash and
 * stretch, camera deadzones and trauma-based shake. Pure functions only.
 */

/** Move `current` toward `target` by at most `maxDelta` (never overshoots). */
export function moveTowards(current: number, target: number, maxDelta: number) {
  const d = target - current
  if (Math.abs(d) <= maxDelta) return target
  return current + Math.sign(d) * maxDelta
}

/**
 * Exponential smoothing that gives the same curve at any frame rate:
 * closes the fraction 1 - e^(-rate·dt) of the remaining gap each step.
 */
export function damp(
  current: number,
  target: number,
  rate: number,
  dt: number
) {
  return target + (current - target) * Math.exp(-rate * dt)
}

/**
 * One step of horizontal movement. `input` is -1..1. Accelerates toward
 * input·maxSpeed and uses `decel` when there is no input or the player is
 * turning around.
 */
export function stepVelocity(
  v: number,
  input: number,
  dt: number,
  cfg: {
    accel: number
    decel: number
    maxSpeed: number
    model?: "linear" | "damped" | "instant"
  }
) {
  const target = input * cfg.maxSpeed
  const braking = input === 0 || Math.sign(input) !== Math.sign(v)
  const rate = braking && v !== 0 ? cfg.decel : cfg.accel
  switch (cfg.model ?? "linear") {
    case "instant":
      return target
    case "damped":
      // Rate chosen so the initial slope matches the linear version.
      return damp(v, target, rate / cfg.maxSpeed, dt)
    default:
      return moveTowards(v, target, rate * dt)
  }
}

export interface JumpTimers {
  /** Seconds of coyote time left since the feet left the ground. */
  coyote: number
  /** Seconds a buffered jump press stays valid. */
  buffer: number
}

/**
 * Coyote time + input buffering in one step. Returns the new timers and
 * whether a jump fires this frame. A jump consumes both timers.
 */
export function stepJumpTimers(
  timers: JumpTimers,
  input: { grounded: boolean; pressed: boolean },
  dt: number,
  cfg: { coyote: number; buffer: number }
): { timers: JumpTimers; jump: boolean } {
  const coyote = input.grounded ? cfg.coyote : Math.max(0, timers.coyote - dt)
  const buffer = input.pressed ? cfg.buffer : Math.max(0, timers.buffer - dt)
  const canJump = input.grounded || coyote > 0
  const wantsJump = input.pressed || buffer > 0
  if (canJump && wantsJump)
    return { timers: { coyote: 0, buffer: 0 }, jump: true }
  return { timers: { coyote, buffer }, jump: false }
}

/**
 * Hit stop: while `remaining` > 0 game time is frozen. Returns the new
 * remaining freeze and how much game time this frame should simulate
 * (leftover real time after the freeze ends is not lost).
 */
export function consumeHitStop(remaining: number, dt: number) {
  if (remaining <= 0) return { remaining: 0, gameDt: dt }
  if (remaining >= dt) return { remaining: remaining - dt, gameDt: 0 }
  return { remaining: 0, gameDt: dt - remaining }
}

/**
 * Invulnerability window. `remaining` counts down; a hit only lands when it
 * is zero and then restarts the window.
 */
export function tryHit(remaining: number, duration: number) {
  if (remaining > 0) return { hit: false, remaining }
  return { hit: true, remaining: duration }
}

/** Blink on/off at `hz` while invulnerable (true = visible). */
export function blinkVisible(timeLeft: number, hz: number) {
  if (timeLeft <= 0) return true
  return Math.floor(timeLeft * hz * 2) % 2 === 0
}

/**
 * Volume-preserving stretch along the velocity axis. Returns the scale
 * along the motion and the scale on the two perpendicular axes, so that
 * along · across² = 1.
 */
export function stretchScale(speed: number, amount: number, maxStretch = 1.8) {
  const along = Math.min(maxStretch, 1 + amount * speed)
  return { along, across: 1 / Math.sqrt(along) }
}

/** Squash on impact (along < 1), same volume rule. */
export function squashScale(squash: number) {
  const along = Math.max(0.2, 1 - squash)
  return { along, across: 1 / Math.sqrt(along) }
}

/**
 * Camera deadzone on one axis: the camera only moves when the target
 * leaves [camera - half, camera + half], and then just enough to keep it on
 * the edge.
 */
export function deadzoneAxis(camera: number, target: number, half: number) {
  if (target > camera + half) return target - half
  if (target < camera - half) return target + half
  return camera
}

/** Linear trauma decay, clamped to 0..1. */
export function decayTrauma(trauma: number, rate: number, dt: number) {
  return Math.min(1, Math.max(0, trauma - rate * dt))
}

/** Add trauma from a hit, clamped to 1. */
export function addTrauma(trauma: number, amount: number) {
  return Math.min(1, Math.max(0, trauma + amount))
}

function hash1(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return (s - Math.floor(s)) * 2 - 1
}

/** Smooth 1D value noise in -1..1. Different `seed`s give independent channels. */
export function smoothNoise(x: number, seed = 0) {
  const i = Math.floor(x)
  const f = x - i
  const u = f * f * (3 - 2 * f)
  const a = hash1(i + seed * 57.3)
  const b = hash1(i + 1 + seed * 57.3)
  return a + (b - a) * u
}

/** Shake offset: trauma² (or trauma^power) times a noise channel. */
export function shakeAmount(trauma: number, power = 2) {
  return Math.pow(Math.max(0, trauma), power)
}

/** Run `step(dt)` at a fixed fps for `seconds`; handy for tests and previews. */
export function simulate(
  fps: number,
  seconds: number,
  step: (dt: number, t: number) => void
) {
  const dt = 1 / fps
  const frames = Math.round(seconds * fps)
  for (let i = 0; i < frames; i++) step(dt, i * dt)
}
