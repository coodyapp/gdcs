/**
 * 2D inverse kinematics: forward kinematics, analytic two-bone IK (law of
 * cosines) and FABRIK for longer chains. Points are [x, y] tuples.
 */

export type P2 = [number, number]

const dist = (a: P2, b: P2) => Math.hypot(b[0] - a[0], b[1] - a[1])

/** Forward kinematics: relative joint angles → joint positions (base first). */
export function forwardKinematics(
  base: P2,
  lengths: number[],
  angles: number[]
): P2[] {
  const out: P2[] = [[base[0], base[1]]]
  let a = 0
  let [x, y] = base
  for (let i = 0; i < lengths.length; i++) {
    a += angles[i]
    x += Math.cos(a) * lengths[i]
    y += Math.sin(a) * lengths[i]
    out.push([x, y])
  }
  return out
}

export interface TwoBoneResult {
  /** Shoulder angle (world) and elbow angle (relative to the upper bone). */
  angles: [number, number]
  /** Base, elbow and end effector positions. */
  joints: [P2, P2, P2]
  reached: boolean
}

/**
 * Analytic two-bone IK. `bend` (+1 or -1) picks which side the elbow goes,
 * the 2D version of a pole vector. Unreachable targets are clamped to the
 * reachable annulus |l1 − l2| ≤ d ≤ l1 + l2, so the arm points straight at
 * them (or folds) instead of producing NaN.
 */
export function twoBoneIK(
  base: P2,
  l1: number,
  l2: number,
  target: P2,
  bend: 1 | -1 = 1
): TwoBoneResult {
  const dx = target[0] - base[0]
  const dy = target[1] - base[1]
  const raw = Math.hypot(dx, dy)
  const min = Math.abs(l1 - l2)
  const max = l1 + l2
  const d = Math.min(Math.max(raw, min), max)
  const reached = raw >= min - 1e-9 && raw <= max + 1e-9
  // Law of cosines for the elbow: d² = l1² + l2² + 2·l1·l2·cos(elbow).
  const cosElbow = Math.min(
    1,
    Math.max(-1, (d * d - l1 * l1 - l2 * l2) / (2 * l1 * l2))
  )
  const elbow = bend * Math.acos(cosElbow)
  const toTarget = raw > 1e-12 ? Math.atan2(dy, dx) : 0
  const shoulder =
    toTarget - Math.atan2(l2 * Math.sin(elbow), l1 + l2 * Math.cos(elbow))
  const [b, e, end] = forwardKinematics(base, [l1, l2], [shoulder, elbow])
  return { angles: [shoulder, elbow], joints: [b, e, end], reached }
}

export interface FabrikResult {
  iterations: number
  /** Final distance from the end effector to the target. */
  error: number
  reached: boolean
}

/**
 * FABRIK (Forward And Backward Reaching IK). Mutates `joints` in place
 * (joints[0] is the fixed base). Each iteration drags the chain to the
 * target from the tip, then back to the base, keeping every bone length.
 */
export function fabrik(
  joints: P2[],
  target: P2,
  tolerance = 1e-4,
  maxIterations = 20,
  lengths = joints.slice(1).map((j, i) => dist(joints[i], j))
): FabrikResult {
  const n = joints.length
  const base: P2 = [joints[0][0], joints[0][1]]
  const total = lengths.reduce((s, l) => s + l, 0)
  const place = (from: P2, toward: P2, len: number, out: P2) => {
    const d = dist(from, toward) || 1e-12
    const t = len / d
    out[0] = from[0] + (toward[0] - from[0]) * t
    out[1] = from[1] + (toward[1] - from[1]) * t
  }
  if (dist(base, target) >= total) {
    // Unreachable: stretch the chain straight at the target.
    for (let i = 1; i < n; i++)
      place(joints[i - 1], target, lengths[i - 1], joints[i])
    return { iterations: 0, error: dist(joints[n - 1], target), reached: false }
  }
  let it = 0
  let error = dist(joints[n - 1], target)
  while (error > tolerance && it < maxIterations) {
    // Backward pass: pin the tip on the target, walk to the base.
    joints[n - 1][0] = target[0]
    joints[n - 1][1] = target[1]
    for (let i = n - 2; i >= 0; i--)
      place(joints[i + 1], joints[i], lengths[i], joints[i])
    // Forward pass: pin the base again, walk to the tip.
    joints[0][0] = base[0]
    joints[0][1] = base[1]
    for (let i = 1; i < n; i++)
      place(joints[i - 1], joints[i], lengths[i - 1], joints[i])
    error = dist(joints[n - 1], target)
    it++
  }
  return { iterations: it, error, reached: error <= tolerance }
}
