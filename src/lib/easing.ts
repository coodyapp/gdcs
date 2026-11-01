/**
 * Easing functions: map normalized progress t in [0, 1] to eased progress.
 * Every function satisfies f(0) = 0 and f(1) = 1. "Back" and "elastic"
 * overshoot past 1 in between, which is the point of them.
 */
export type Easing = (t: number) => number

const { PI, cos, sin, pow } = Math

export const linear: Easing = (t) => t

export const inQuad: Easing = (t) => t * t
export const outQuad: Easing = (t) => 1 - (1 - t) * (1 - t)
export const inOutQuad: Easing = (t) =>
  t < 0.5 ? 2 * t * t : 1 - pow(-2 * t + 2, 2) / 2

export const inCubic: Easing = (t) => t * t * t
export const outCubic: Easing = (t) => 1 - pow(1 - t, 3)
export const inOutCubic: Easing = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - pow(-2 * t + 2, 3) / 2

export const inOutSine: Easing = (t) => -(cos(PI * t) - 1) / 2

export const outExpo: Easing = (t) => (t >= 1 ? 1 : 1 - pow(2, -10 * t))

/** Smoothstep: 3t² − 2t³, zero slope at both ends. */
export const smoothstep: Easing = (t) => t * t * (3 - 2 * t)

/** Overshoots by ~10% before settling (s = 1.70158 is the classic tension). */
export const outBack: Easing = (t) => {
  const s = 1.70158
  const u = t - 1
  return 1 + (s + 1) * u * u * u + s * u * u
}

/** Decaying sine wobble around 1. */
export const outElastic: Easing = (t) => {
  if (t <= 0) return 0
  if (t >= 1) return 1
  return pow(2, -10 * t) * sin((t * 10 - 0.75) * ((2 * PI) / 3)) + 1
}

/** Piecewise parabolas that mimic a ball bouncing to rest. */
export const outBounce: Easing = (t) => {
  const n = 7.5625
  const d = 2.75
  if (t < 1 / d) return n * t * t
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375
  return n * (t -= 2.625 / d) * t + 0.984375
}

/** Turns any ease-in into its ease-out mirror: out(t) = 1 − in(1 − t). */
export const reverse =
  (f: Easing): Easing =>
  (t) =>
    1 - f(1 - t)

export const easings = {
  linear,
  inQuad,
  outQuad,
  inOutQuad,
  inCubic,
  outCubic,
  inOutCubic,
  inOutSine,
  outExpo,
  smoothstep,
  outBack,
  outElastic,
  outBounce,
} satisfies Record<string, Easing>

export type EasingName = keyof typeof easings

/** Clamped interpolation from a to b with an easing curve. */
export const ease = (f: Easing, a: number, b: number, t: number) =>
  a + (b - a) * f(Math.min(1, Math.max(0, t)))

/** Numerical slope, handy for checking "starts slow" / "ends slow". */
export const slope = (f: Easing, t: number, h = 1e-4) =>
  (f(Math.min(1, t + h)) - f(Math.max(0, t - h))) /
  (Math.min(1, t + h) - Math.max(0, t - h))
