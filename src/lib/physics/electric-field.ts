/** Planar point charges (k = 1) and field-line tracing. */
export interface PointCharge {
  x: number
  y: number
  q: number
}

export interface Vec2 {
  x: number
  y: number
}

/**
 * Net Coulomb field E = Σ q (r − rᵢ) / |r − rᵢ|³ at (x, y), written into `out`.
 * `softening` caps the field near a charge so tracing never divides by zero.
 */
export function fieldAt(
  charges: readonly PointCharge[],
  x: number,
  y: number,
  out: Vec2,
  softening = 0.12
): Vec2 {
  out.x = 0
  out.y = 0
  for (const c of charges) {
    const dx = x - c.x
    const dy = y - c.y
    const r2 = Math.max(dx * dx + dy * dy, softening)
    const s = c.q / (r2 * Math.sqrt(r2))
    out.x += dx * s
    out.y += dy * s
  }
  return out
}

export interface TraceOptions {
  step?: number
  maxSteps?: number
  /** Distance from the seed charge where the line starts. */
  startRadius?: number
  /** Stop when this close to another charge. */
  stopRadius?: number
  /** Stop when farther than this from the origin. */
  bound?: number
}

/**
 * Traces one field line from charge `seed` leaving at `angle`. Lines run
 * along E from positive charges and against E from negative ones.
 * Returns a flat [x, y, 0, x, y, 0, ...] polyline.
 */
export function traceFieldLine(
  charges: readonly PointCharge[],
  seed: number,
  angle: number,
  {
    step = 0.11,
    maxSteps = 90,
    startRadius = 0.36,
    stopRadius = 0.42,
    bound = 6,
  }: TraceOptions = {}
): number[] {
  const c = charges[seed]
  const dir = c.q >= 0 ? 1 : -1
  let x = c.x + Math.cos(angle) * startRadius
  let y = c.y + Math.sin(angle) * startRadius
  const out = [x, y, 0]
  const e: Vec2 = { x: 0, y: 0 }
  for (let i = 0; i < maxSteps; i++) {
    fieldAt(charges, x, y, e)
    const len = Math.hypot(e.x, e.y)
    if (len < 1e-4) break
    x += (dir * step * e.x) / len
    y += (dir * step * e.y) / len
    out.push(x, y, 0)
    if (Math.hypot(x, y) > bound) break
    let hit = false
    for (let j = 0; j < charges.length; j++) {
      if (
        j !== seed &&
        Math.hypot(x - charges[j].x, y - charges[j].y) < stopRadius
      )
        hit = true
    }
    if (hit) break
  }
  return out
}

/**
 * Field lines for a whole configuration. Seeds come from positive charges
 * (or from every charge if none is positive), with a line count
 * proportional to |q| so line density tracks field strength.
 */
export function traceAllLines(
  charges: readonly PointCharge[],
  linesPerUnitCharge = 12,
  options?: TraceOptions
): { seed: number; points: number[] }[] {
  const active = charges.filter((c) => Math.abs(c.q) > 1e-6)
  const anyPositive = active.some((c) => c.q > 0)
  const lines: { seed: number; points: number[] }[] = []
  active.forEach((c, seed) => {
    if (anyPositive && c.q < 0) return
    const n = Math.max(4, Math.round(linesPerUnitCharge * Math.abs(c.q)))
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2
      lines.push({ seed, points: traceFieldLine(active, seed, angle, options) })
    }
  })
  return lines
}
