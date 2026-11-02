/**
 * Quantization: send a float in a known range as a small integer, and a unit
 * quaternion as "smallest three". Pure functions on plain numbers and tuples.
 *
 * The range is cut into 2^bits equal bins and a value decodes to the centre of
 * its bin, so the error inside the range is at most half a bin.
 */
import { angleBetween, type Quat } from "./quat"
import { mulberry32 } from "./weighted-random"

/** Largest possible second-biggest component of a unit quaternion: 1/√2. */
export const SMALLEST_THREE_MAX = Math.SQRT1_2
/** Bits a 32-bit float pose costs: 3 for position plus 4 for rotation. */
export const FLOAT_POSE_BITS = 7 * 32

export const stepSize = (min: number, max: number, bits: number) =>
  (max - min) / 2 ** bits

/** Bin index for x. Values outside [min, max] clamp to the first or last bin. */
export function quantize(x: number, min: number, max: number, bits: number) {
  const n = 2 ** bits
  const t = (x - min) / (max - min)
  // Written so that NaN lands in bin 0 instead of poisoning the bit writer.
  if (!(t > 0)) return 0
  return Math.min(n - 1, Math.floor(t * n))
}

/** Centre of bin i. */
export const dequantize = (i: number, min: number, max: number, bits: number) =>
  min + (i + 0.5) * stepSize(min, max, bits)

/** Fewest bits whose error stays within maxError: ⌈log₂(range / 2e)⌉. */
export const bitsFor = (range: number, maxError: number) =>
  Math.max(0, Math.ceil(Math.log2(range / (2 * maxError))))

export interface EncodedQuat {
  /** Which component was dropped: 0 = x, 1 = y, 2 = z, 3 = w. */
  dropped: number
  /** Bin indices of the other three, in x, y, z, w order. */
  values: [number, number, number]
}

export const newEncodedQuat = (): EncodedQuat => ({
  dropped: 3,
  values: [0, 0, 0],
})

/** Pass `out` to avoid allocating when this runs every frame. */
export function encodeQuat(
  q: Quat,
  bits: number,
  out: EncodedQuat = newEncodedQuat()
): EncodedQuat {
  let dropped = 0
  for (let i = 1; i < 4; i++)
    if (Math.abs(q[i]) > Math.abs(q[dropped])) dropped = i
  const length = Math.hypot(q[0], q[1], q[2], q[3]) || 1
  // The decoder rebuilds the dropped component as a positive root, so send -q
  // when it is negative: that is the same rotation.
  const scale = (q[dropped] < 0 ? -1 : 1) / length
  let n = 0
  for (let i = 0; i < 4; i++) {
    if (i === dropped) continue
    out.values[n++] = quantize(
      q[i] * scale,
      -SMALLEST_THREE_MAX,
      SMALLEST_THREE_MAX,
      bits
    )
  }
  out.dropped = dropped
  return out
}

/** Pass `out` to avoid allocating when this runs every frame. */
export function decodeQuat(
  e: EncodedQuat,
  bits: number,
  out: Quat = [0, 0, 0, 1]
): Quat {
  let n = 0
  let sum = 0
  for (let i = 0; i < 4; i++) {
    if (i === e.dropped) continue
    const c = dequantize(
      e.values[n++],
      -SMALLEST_THREE_MAX,
      SMALLEST_THREE_MAX,
      bits
    )
    out[i] = c
    sum += c * c
  }
  // Rounding can push the three past length 1, so the root is clamped and the
  // result rescaled to stay a unit quaternion.
  out[e.dropped] = Math.sqrt(Math.max(0, 1 - sum))
  const length = Math.hypot(out[0], out[1], out[2], out[3]) || 1
  for (let i = 0; i < 4; i++) out[i] /= length
  return out
}

/** Uniformly random unit quaternions (Shoemake's method). */
export function randomQuat(random: () => number): Quat {
  const u = random()
  const a = Math.sqrt(1 - u)
  const b = Math.sqrt(u)
  const t1 = 2 * Math.PI * random()
  const t2 = 2 * Math.PI * random()
  return [
    a * Math.sin(t1),
    a * Math.cos(t1),
    b * Math.sin(t2),
    b * Math.cos(t2),
  ]
}

const roundTripAngle = (q: Quat, bits: number) =>
  angleBetween(q, decodeQuat(encodeQuat(q, bits), bits))

/**
 * Largest angular error (radians) found by a seeded search. Uniform samples
 * rarely reach the worst case, which sits where all four components are close
 * to 1/2: the dropped one then amplifies all three errors at once. So the
 * search also tries every combination of bin edges around 1/2.
 */
export function worstAngleError(bits: number, samples = 20000, seed = 1) {
  const random = mulberry32(seed)
  const step = stepSize(-SMALLEST_THREE_MAX, SMALLEST_THREE_MAX, bits)
  const home = Math.floor((0.5 + SMALLEST_THREE_MAX) / step)
  const edge = (shift: number, side: number) =>
    (home + shift) * step - SMALLEST_THREE_MAX + side * 1e-9
  let worst = 0
  for (let i = 0; i < samples; i++)
    worst = Math.max(worst, roundTripAngle(randomQuat(random), bits))
  for (const side of [-1, 1])
    for (let a = -2; a <= 2; a++)
      for (let b = -2; b <= 2; b++)
        for (let c = -2; c <= 2; c++) {
          const x = edge(a, side)
          const y = edge(b, side)
          const z = edge(c, side)
          const rest = 1 - x * x - y * y - z * z
          if (rest <= 0) continue
          const w = Math.sqrt(rest)
          worst = Math.max(worst, roundTripAngle([x, y, z, w], bits))
        }
  return worst
}

/** Pose cost on the wire: three position axes, then index plus three values. */
export const poseBits = (positionBits: number, rotationBits: number) =>
  3 * positionBits + 2 + 3 * rotationBits
