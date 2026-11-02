/**
 * Minimal 2D rigid body (rotation about z) for teaching: mass, moment of
 * inertia, impulses at a point, semi-implicit Euler, and plane contacts
 * solved with sequential impulses (restitution + Coulomb friction).
 */

export interface Body2D {
  x: number
  y: number
  angle: number
  vx: number
  vy: number
  omega: number
  mass: number
  inertia: number
  /** Half extents of the box (local space). */
  hw: number
  hh: number
}

/** A boundary plane: the free side is p·n ≥ d (n points into the free side). */
export interface Plane2D {
  nx: number
  ny: number
  d: number
}

/** Moment of inertia of a solid box about its centre: m(w² + h²) / 12. */
export const boxInertia = (mass: number, w: number, h: number) =>
  (mass * (w * w + h * h)) / 12

/** 2D cross product (z component of a × b). */
export const cross2 = (ax: number, ay: number, bx: number, by: number) =>
  ax * by - ay * bx

export function createBox(
  w: number,
  h: number,
  mass: number,
  x = 0,
  y = 0
): Body2D {
  return {
    x,
    y,
    angle: 0,
    vx: 0,
    vy: 0,
    omega: 0,
    mass,
    inertia: boxInertia(mass, w, h),
    hw: w / 2,
    hh: h / 2,
  }
}

/**
 * Apply impulse J at world-space offset r from the centre of mass:
 * Δv = J/m, Δω = (r × J)/I.
 */
export function applyImpulse(
  b: Body2D,
  jx: number,
  jy: number,
  rx: number,
  ry: number
) {
  b.vx += jx / b.mass
  b.vy += jy / b.mass
  b.omega += cross2(rx, ry, jx, jy) / b.inertia
}

/** Semi-implicit (symplectic) Euler: update velocity first, then position. */
export function integrate(b: Body2D, dt: number, gx = 0, gy = -9.81) {
  b.vx += gx * dt
  b.vy += gy * dt
  b.x += b.vx * dt
  b.y += b.vy * dt
  b.angle += b.omega * dt
}

/** Velocity of the material point at offset r: v + ω × r. */
export function pointVelocity(b: Body2D, rx: number, ry: number) {
  return [b.vx - b.omega * ry, b.vy + b.omega * rx] as const
}

export const kineticEnergy = (b: Body2D) =>
  0.5 * b.mass * (b.vx * b.vx + b.vy * b.vy) +
  0.5 * b.inertia * b.omega * b.omega

/** World-space offsets of the four box corners from the centre. */
export function cornerOffsets(
  b: Body2D,
  out: number[] = [0, 0, 0, 0, 0, 0, 0, 0]
) {
  const c = Math.cos(b.angle)
  const s = Math.sin(b.angle)
  let k = 0
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    const lx = sx * b.hw
    const ly = sy * b.hh
    out[k++] = lx * c - ly * s
    out[k++] = lx * s + ly * c
  }
  return out
}

export interface ContactResult {
  /** Contact points (world) and the normal impulse applied at each. */
  points: { x: number; y: number; jn: number }[]
}

/**
 * Resolve the box against one plane. Penetrating corners become contacts.
 * Pass 1 is a perfectly inelastic sequential-impulse solve (accumulated
 * normal impulse ≥ 0). Pass 2 adds restitution Poisson-style: each contact
 * gets e × its normal impulse again, which cannot add energy for e ≤ 1.
 * Pass 3 applies friction, each step a partial "stop sliding" impulse. Restitution is skipped below
 * `bounceThreshold` closing speed so resting boxes don't jitter.
 */
export function resolvePlane(
  b: Body2D,
  p: Plane2D,
  restitution: number,
  friction: number,
  iterations = 8,
  bounceThreshold = 0.4
): ContactResult {
  const r = cornerOffsets(b)
  const contacts: {
    rx: number
    ry: number
    kn: number
    kt: number
    pn: number
    pt: number
  }[] = []
  let maxPen = 0
  let closing = 0
  const tx = -p.ny
  const ty = p.nx
  for (let i = 0; i < 4; i++) {
    const rx = r[2 * i]
    const ry = r[2 * i + 1]
    const pen = p.d - ((b.x + rx) * p.nx + (b.y + ry) * p.ny)
    if (pen <= 0) continue
    maxPen = Math.max(maxPen, pen)
    const [vx, vy] = pointVelocity(b, rx, ry)
    closing = Math.max(closing, -(vx * p.nx + vy * p.ny))
    const rn = cross2(rx, ry, p.nx, p.ny)
    const rt = cross2(rx, ry, tx, ty)
    contacts.push({
      rx,
      ry,
      kn: 1 / b.mass + (rn * rn) / b.inertia,
      kt: 1 / b.mass + (rt * rt) / b.inertia,
      pn: 0,
      pt: 0,
    })
  }
  // 1. Inelastic normal solve (accumulated impulse stays ≥ 0).
  for (let it = 0; it < iterations && contacts.length; it++) {
    for (const c of contacts) {
      const [vx, vy] = pointVelocity(b, c.rx, c.ry)
      const pn = Math.max(c.pn - (vx * p.nx + vy * p.ny) / c.kn, 0)
      const dn = pn - c.pn
      c.pn = pn
      applyImpulse(b, dn * p.nx, dn * p.ny, c.rx, c.ry)
    }
  }
  // 2. Restitution: repeat e × the normal impulse (Poisson's hypothesis).
  if (closing > bounceThreshold && restitution > 0) {
    for (const c of contacts) {
      const j = restitution * c.pn
      applyImpulse(b, j * p.nx, j * p.ny, c.rx, c.ry)
      c.pn += j
    }
  }
  // 3. Coulomb friction, clamped to the cone |jt| ≤ μ·jn.
  for (let it = 0; it < iterations && contacts.length; it++) {
    for (const c of contacts) {
      const [vx, vy] = pointVelocity(b, c.rx, c.ry)
      const maxF = friction * c.pn
      const pt = Math.min(
        Math.max(c.pt - (vx * tx + vy * ty) / c.kt, -maxF),
        maxF
      )
      const dt = pt - c.pt
      c.pt = pt
      applyImpulse(b, dt * tx, dt * ty, c.rx, c.ry)
    }
  }
  // Positional correction: push straight out of the plane.
  b.x += p.nx * maxPen
  b.y += p.ny * maxPen
  return {
    points: contacts.map((c) => ({
      x: b.x + c.rx,
      y: b.y + c.ry,
      jn: c.pn,
    })),
  }
}
