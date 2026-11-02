/**
 * Impulse-based collision response along one axis. The contact normal runs
 * from body `a` to body `b` (the +x direction). A body with `invMass` 0 has
 * infinite mass: it is static and no impulse can move it.
 */

export interface Body1D {
  v: number
  invMass: number
}

/** 1/m, with 0 for infinite or non-positive mass (a static body). */
export const inverseMass = (mass: number) =>
  Number.isFinite(mass) && mass > 0 ? 1 / mass : 0

/**
 * Apply j = -(1 + e)(v_rel · n) / (1/m1 + 1/m2) to both bodies, equal and
 * opposite, and return j. Does nothing if they are already separating or if
 * both are static, so calling it twice for one contact is safe.
 */
export function resolveCollision(a: Body1D, b: Body1D, e: number) {
  const invSum = a.invMass + b.invMass
  const vRel = b.v - a.v
  if (invSum === 0 || vRel >= 0) return 0
  const j = (-(1 + e) * vRel) / invSum
  a.v -= j * a.invMass
  b.v += j * b.invMass
  return j
}

export interface HeadOnReport {
  vA: number
  vB: number
  /** Impulse magnitude delivered at contact. */
  j: number
  pBefore: number
  pAfter: number
  /** Momentum of body A alone, before and after. */
  pABefore: number
  pAAfter: number
  keBefore: number
  keAfter: number
  keLost: number
}

/**
 * Run the head-on collision the visual animates: A moves at +speed, B at
 * -speed. All "after" totals are measured from the resolved velocities.
 */
export function headOnCollision(
  massA: number,
  massB: number,
  e: number,
  speed: number
): HeadOnReport {
  const a = { v: speed, invMass: inverseMass(massA) }
  const b = { v: -speed, invMass: inverseMass(massB) }
  const pABefore = massA * a.v
  const pBefore = pABefore + massB * b.v
  const keBefore = 0.5 * (massA * a.v * a.v + massB * b.v * b.v)
  const j = resolveCollision(a, b, e)
  const pAAfter = massA * a.v
  const keAfter = 0.5 * (massA * a.v * a.v + massB * b.v * b.v)
  return {
    vA: a.v,
    vB: b.v,
    j,
    pBefore,
    pAfter: pAAfter + massB * b.v,
    pABefore,
    pAAfter,
    keBefore,
    keAfter,
    keLost: keBefore - keAfter,
  }
}
