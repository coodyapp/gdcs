/**
 * Reynolds-style steering on the XZ plane (stored as x/y). Every function
 * writes into `out` so callers can reuse vectors and allocate nothing per frame.
 * THREE.Vector2 satisfies `Vec2`.
 */
export interface Vec2 {
  x: number
  y: number
}

export interface Agent {
  pos: Vec2
  vel: Vec2
}

const len = (x: number, y: number) => Math.hypot(x, y)

/** Scale (x, y) down to at most `max` length, writing into `out`. */
export function truncate(out: Vec2, max: number): Vec2 {
  const l = len(out.x, out.y)
  if (l > max && l > 0) {
    out.x *= max / l
    out.y *= max / l
  }
  return out
}

/**
 * Steering = (desired velocity − current velocity) / reactionTime.
 * Desired = full speed straight at the target. Smaller reactionTime = snappier.
 */
export function seek(
  a: Agent,
  target: Vec2,
  maxSpeed: number,
  out: Vec2,
  reactionTime = 0.25
): Vec2 {
  const dx = target.x - a.pos.x
  const dy = target.y - a.pos.y
  const d = len(dx, dy)
  const s = d > 1e-9 ? maxSpeed / d : 0
  out.x = (dx * s - a.vel.x) / reactionTime
  out.y = (dy * s - a.vel.y) / reactionTime
  return out
}

/** Like seek, but desired speed ramps down linearly inside `slowRadius`. */
export function arrive(
  a: Agent,
  target: Vec2,
  maxSpeed: number,
  slowRadius: number,
  out: Vec2,
  reactionTime = 0.25
): Vec2 {
  const dx = target.x - a.pos.x
  const dy = target.y - a.pos.y
  const d = len(dx, dy)
  const speed = maxSpeed * Math.min(1, d / slowRadius)
  const s = d > 1e-9 ? speed / d : 0
  out.x = (dx * s - a.vel.x) / reactionTime
  out.y = (dy * s - a.vel.y) / reactionTime
  return out
}

/** Push away from neighbours closer than `radius`, weighted by 1/distance. */
export function separation(
  self: number,
  agents: readonly Agent[],
  radius: number,
  out: Vec2
): Vec2 {
  out.x = 0
  out.y = 0
  const p = agents[self].pos
  for (let i = 0; i < agents.length; i++) {
    if (i === self) continue
    const dx = p.x - agents[i].pos.x
    const dy = p.y - agents[i].pos.y
    const d2 = dx * dx + dy * dy
    if (d2 > 0 && d2 < radius * radius) {
      // (dx, dy)/d² = unit direction × 1/d
      out.x += dx / d2
      out.y += dy / d2
    }
  }
  return out
}

/** Unit-mass Euler step: clamp force, add to velocity, clamp speed, move. */
export function integrate(
  a: Agent,
  force: Vec2,
  maxForce: number,
  maxSpeed: number,
  dt: number
) {
  truncate(force, maxForce)
  a.vel.x += force.x * dt
  a.vel.y += force.y * dt
  truncate(a.vel, maxSpeed)
  a.pos.x += a.vel.x * dt
  a.pos.y += a.vel.y * dt
}
