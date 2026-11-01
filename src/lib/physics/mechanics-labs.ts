/**
 * Pure helpers behind the physics/mechanics sheets (spring, pendulum, Kepler,
 * lever, projectile statistics, buoyancy). No React, no three.js.
 */

export const G_EARTH = 9.81

// ── Driven, damped spring (m = 1) ───────────────────────────────────────────

export interface OscillatorState {
  x: number
  v: number
  t: number
}

/** One semi-implicit Euler step of x'' + c x' + k x = F0 sin(ω t). Mutates `s`. */
export function stepDrivenOscillator(
  s: OscillatorState,
  k: number,
  c: number,
  f0: number,
  omega: number,
  dt: number
) {
  const a = f0 * Math.sin(omega * s.t) - c * s.v - k * s.x
  s.v += a * dt
  s.x += s.v * dt
  s.t += dt
}

/** Steady-state amplitude of m x'' + c x' + k x = F0 sin(ω t). */
export function steadyStateAmplitude(
  k: number,
  c: number,
  f0: number,
  omega: number,
  m = 1
) {
  return f0 / Math.hypot(k - m * omega * omega, c * omega)
}

// ── Nonlinear damped pendulum ───────────────────────────────────────────────

export interface PendulumState {
  theta: number
  omega: number
  t: number
}

/** One semi-implicit Euler step of θ'' = −(g/L) sin θ − b θ'. Mutates `s`. */
export function stepPendulum(
  s: PendulumState,
  g: number,
  length: number,
  b: number,
  dt: number
) {
  s.omega += (-(g / length) * Math.sin(s.theta) - b * s.omega) * dt
  s.theta += s.omega * dt
  s.t += dt
}

/** Undamped period: small-angle 2π√(L/g) with the first two large-angle terms. */
export function pendulumPeriod(length: number, g: number, theta0 = 0) {
  const t0 = 2 * Math.PI * Math.sqrt(length / g)
  const a2 = theta0 * theta0
  return t0 * (1 + a2 / 16 + (11 * a2 * a2) / 3072)
}

/** Linearised (small-angle) damped pendulum released from rest at θ0. */
export function harmonicPendulumAngle(
  theta0: number,
  g: number,
  length: number,
  b: number,
  t: number
) {
  const w0 = Math.sqrt(g / length)
  const wd = Math.sqrt(Math.max(1e-9, w0 * w0 - (b * b) / 4))
  return (
    theta0 *
    Math.exp((-b * t) / 2) *
    (Math.cos(wd * t) + (b / (2 * wd)) * Math.sin(wd * t))
  )
}

// ── Kepler orbits ───────────────────────────────────────────────────────────

/** Solve Kepler's equation M = E − e sin E for the eccentric anomaly E (Newton). */
export function solveKepler(meanAnomaly: number, e: number, iterations = 12) {
  // Wrap M into [−π, π]; start at ±π for high e so Newton cannot overshoot.
  const M = Math.atan2(Math.sin(meanAnomaly), Math.cos(meanAnomaly))
  let E = e > 0.8 ? Math.sign(M || 1) * Math.PI : M
  for (let i = 0; i < iterations; i++) {
    const f = E - e * Math.sin(E) - M
    E -= f / (1 - e * Math.cos(E))
    if (Math.abs(f) < 1e-12) break
  }
  return E
}

/** Area swept from the focus between eccentric anomalies E1 and E2. */
export function focalSweptArea(a: number, e: number, E1: number, E2: number) {
  const b = a * Math.sqrt(1 - e * e)
  return ((a * b) / 2) * (E2 - E1 - e * (Math.sin(E2) - Math.sin(E1)))
}

// ── Lever on a fulcrum ──────────────────────────────────────────────────────

/** Net counter-clockwise torque (N·m) of a left and a right point load. */
export function leverNetTorque(
  leftMass: number,
  leftArm: number,
  rightMass: number,
  rightArm: number,
  g = G_EARTH
) {
  return (leftMass * leftArm - rightMass * rightArm) * g
}

// ── Projectile statistics ───────────────────────────────────────────────────

/**
 * Flat-ground ranges for `runs` launches whose speed error is spread uniformly
 * over ±spread %. Stratified quantiles keep the result deterministic.
 */
export function projectileSamples(
  angleDeg: number,
  speed: number,
  spreadPct: number,
  runs: number,
  g = G_EARTH
) {
  const s2 = Math.sin((2 * angleDeg * Math.PI) / 180)
  return Array.from({ length: runs }, (_, i) => {
    const q = (i + 0.5) / runs
    const v = speed * (1 + ((2 * q - 1) * spreadPct) / 100)
    return (v * v * s2) / g
  })
}

export function sampleStats(xs: number[]) {
  const n = xs.length
  const mean = xs.reduce((s, x) => s + x, 0) / n
  const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / n
  return {
    mean,
    std: Math.sqrt(variance),
    min: Math.min(...xs),
    max: Math.max(...xs),
  }
}

/** Counts per equal-width bin over [min, max]; the last bin is closed. */
export function histogram(
  xs: number[],
  bins: number,
  min: number,
  max: number
) {
  const counts = Array.from({ length: bins }, () => 0)
  const width = (max - min) / bins
  for (const x of xs) {
    const i = width > 0 ? Math.floor((x - min) / width) : 0
    counts[Math.min(bins - 1, Math.max(0, i))]++
  }
  return counts
}

// ── Buoyancy of a cube ──────────────────────────────────────────────────────

/** Fraction (0–1) of a box of height `size` centred at `y` below `surface`. */
export function submergedFraction(y: number, size: number, surface: number) {
  return Math.min(1, Math.max(0, (surface - (y - size / 2)) / size))
}

export interface BuoyantState {
  y: number
  v: number
}

/**
 * One semi-implicit step for a floating box: a = g(ρf/ρo · f − 1) − c v,
 * resting on a floor at `floorY` (box centre height when it touches).
 */
export function stepBuoyancy(
  s: BuoyantState,
  rhoObject: number,
  rhoFluid: number,
  size: number,
  surface: number,
  floorY: number,
  drag: number,
  dt: number,
  g = G_EARTH
) {
  const f = submergedFraction(s.y, size, surface)
  const a = g * ((rhoFluid / rhoObject) * f - 1) - drag * f * s.v
  s.v += a * dt
  s.y += s.v * dt
  if (s.y < floorY) {
    s.y = floorY
    if (s.v < 0) s.v = 0
  }
}
