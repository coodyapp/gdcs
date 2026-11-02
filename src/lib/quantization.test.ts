import { describe, expect, it } from "vite-plus/test"

import { angleBetween, normalize, type Quat } from "./quat"
import {
  bitsFor,
  decodeQuat,
  dequantize,
  encodeQuat,
  FLOAT_POSE_BITS,
  poseBits,
  quantize,
  randomQuat,
  SMALLEST_THREE_MAX,
  stepSize,
  worstAngleError,
} from "./quantization"
import { mulberry32 } from "./weighted-random"

const DEG = 180 / Math.PI
const M = SMALLEST_THREE_MAX
const roundTrip = (x: number, min: number, max: number, bits: number) =>
  dequantize(quantize(x, min, max, bits), min, max, bits)
const quatTrip = (q: Quat, bits: number) =>
  decodeQuat(encodeQuat(q, bits), bits)
const negate = (q: Quat): Quat => [-q[0], -q[1], -q[2], -q[3]]

describe("quantize", () => {
  it("never errs by more than half a step inside the range", () => {
    const random = mulberry32(1)
    for (const [min, max] of [
      [-4, 4],
      [0, 1],
      [-256, 256],
      [-M, M],
    ])
      for (let bits = 1; bits <= 24; bits++) {
        const half = stepSize(min, max, bits) / 2
        let worst = 0
        for (let i = 0; i < 2000; i++) {
          const x = min + random() * (max - min)
          worst = Math.max(worst, Math.abs(roundTrip(x, min, max, bits) - x))
        }
        expect(worst).toBeLessThanOrEqual(half + 1e-9)
        // The bound is tight, not just safe.
        expect(worst).toBeGreaterThan(half * 0.98)
      }
  })

  it("clamps at the range edges and keeps indices in range", () => {
    expect(quantize(-100, -4, 4, 4)).toBe(0)
    expect(quantize(-4, -4, 4, 4)).toBe(0)
    expect(quantize(4, -4, 4, 4)).toBe(15)
    expect(quantize(100, -4, 4, 4)).toBe(15)
    expect(quantize(Infinity, -4, 4, 4)).toBe(15)
    expect(quantize(-Infinity, -4, 4, 4)).toBe(0)
    expect(quantize(NaN, -4, 4, 4)).toBe(0)
    // The edges themselves are still within half a step.
    expect(Math.abs(roundTrip(4, -4, 4, 4) - 4)).toBeCloseTo(0.25, 12)
    expect(Math.abs(roundTrip(-4, -4, 4, 4) + 4)).toBeCloseTo(0.25, 12)
    // Beyond the edge the error is no longer bounded: it grows with distance.
    expect(roundTrip(5, -4, 4, 10)).toBeCloseTo(3.99609375, 9)
    expect(roundTrip(500, -4, 4, 10)).toBeCloseTo(3.99609375, 9)
  })

  it("flips a full step when noise crosses a bin edge", () => {
    expect(roundTrip(1 - 1e-6, -4, 4, 4)).toBe(0.75)
    expect(roundTrip(1 + 1e-6, -4, 4, 4)).toBe(1.25)
  })

  it("needs encoder and decoder to agree on range and bits", () => {
    const sent = quantize(3, -4, 4, 10)
    expect(dequantize(sent, -4, 4, 10)).toBeCloseTo(3.00390625, 9)
    expect(dequantize(sent, -8, 8, 10)).toBeCloseTo(6.0078125, 9)
    expect(dequantize(sent, -4, 4, 11)).toBeCloseTo(-0.498046875, 9)
  })
})

describe("bitsFor", () => {
  it("yields the error asked for, and one bit fewer does not", () => {
    const random = mulberry32(2)
    for (let i = 0; i < 2000; i++) {
      const range = 1 + random() * 1000
      const asked = range / (4 + random() * 1e6)
      const bits = bitsFor(range, asked)
      expect(stepSize(0, range, bits) / 2).toBeLessThanOrEqual(
        asked * (1 + 1e-12)
      )
      expect(stepSize(0, range, bits - 1) / 2).toBeGreaterThan(asked)
    }
  })

  it("gives the figures the sheet quotes", () => {
    expect(bitsFor(64, 0.001)).toBe(15)
    expect(stepSize(-32, 32, 15) / 2).toBeCloseTo(0.0009765625, 12)
    expect(bitsFor(128, 0.001)).toBe(16)
    expect(bitsFor(64, 0.0005)).toBe(16)
    expect(bitsFor(1024, 0.5)).toBe(10)
    expect(poseBits(15, 9)).toBe(74)
    expect(FLOAT_POSE_BITS).toBe(224)
    // A range no wider than the tolerance needs nothing on the wire.
    expect(bitsFor(1, 1)).toBe(0)
    expect(Math.abs(roundTrip(0.9, 0, 1, 0) - 0.9)).toBeLessThanOrEqual(1)
  })

  it("is one bit short for the round(t * (2^b - 1)) mapping", () => {
    // That variant hits both ends exactly, but its step is range / (2^b - 1).
    expect(1024 / (2 ** bitsFor(1024, 0.5) - 1) / 2).toBeGreaterThan(0.5)
    expect(Math.ceil(Math.log2(1024 / (2 * 0.5) + 1))).toBe(11)
  })

  it("measures the worst 3D position error at √3 half-steps", () => {
    const half = stepSize(-32, 32, 15) / 2
    const just = 1e-9
    const edge = -32 + 20000 * 2 * half + just
    const x = roundTrip(edge, -32, 32, 15) - edge
    expect(Math.hypot(x, x, x)).toBeCloseTo(Math.sqrt(3) * half, 7)
    expect(Math.sqrt(3) * half * 1000).toBeCloseTo(1.691, 3)
  })
})

describe("smallest three", () => {
  const cases: Quat[] = [
    [0, 0, 0, 1],
    [0, 0, 0, -1],
    [1, 0, 0, 0],
    [0, -1, 0, 0],
    [M, M, 0, 0],
    [M, -M, 0, 0],
    [-M, 0, 0, M],
    [0.5, 0.5, 0.5, 0.5],
    [-0.5, 0.5, -0.5, 0.5],
    normalize([0.1, 0.2, 0.3, -0.9]),
  ]

  it("round-trips to the same rotation, given q or -q", () => {
    const random = mulberry32(3)
    const all = [
      ...cases,
      ...Array.from({ length: 5000 }, () => randomQuat(random)),
    ]
    for (const bits of [4, 9, 12]) {
      const limit = worstAngleError(bits)
      for (const q of all) {
        const a = quatTrip(q, bits)
        const b = quatTrip(negate(q), bits)
        expect(angleBetween(q, a)).toBeLessThanOrEqual(limit + 1e-9)
        expect(angleBetween(q, b)).toBeLessThanOrEqual(limit + 1e-9)
        // Same wire data for q and -q, unless two components tie for largest.
        expect(angleBetween(a, b)).toBeLessThanOrEqual(2 * limit)
      }
    }
  })

  it("sends identical bits for q and -q when one component is largest", () => {
    const q = normalize([0.1, 0.2, 0.3, -0.9])
    expect(encodeQuat(negate(q), 9)).toEqual(encodeQuat(q, 9))
    expect(encodeQuat(q, 9).dropped).toBe(3)
  })

  it("returns unit quaternions, also from a slightly long input", () => {
    const random = mulberry32(4)
    for (let i = 0; i < 2000; i++) {
      const r = quatTrip(randomQuat(random), 3)
      expect(Math.hypot(...r)).toBeCloseTo(1, 12)
    }
    const long: Quat = [0, 0, 0, 1.01]
    expect(angleBetween([0, 0, 0, 1], quatTrip(long, 9))).toBeLessThan(0.01)
  })

  it("never needs a kept component beyond 1/√2", () => {
    const random = mulberry32(5)
    let largest = 0
    for (let i = 0; i < 100000; i++) {
      const q = randomQuat(random)
        .map(Math.abs)
        .sort((a, b) => b - a)
      largest = Math.max(largest, q[1])
    }
    expect(largest).toBeLessThanOrEqual(M)
    expect(largest).toBeGreaterThan(0.69)
  })

  it("measures the worst-case angle the sheet quotes", () => {
    expect(worstAngleError(4) * DEG).toBeCloseTo(17.58, 2)
    expect(worstAngleError(9) * DEG).toBeCloseTo(0.55, 2)
    expect(worstAngleError(10) * DEG).toBeCloseTo(0.275, 3)
    expect(worstAngleError(12) * DEG).toBeCloseTo(0.069, 3)
    // A coarse lattice is far from the formula below: 45° at 3 bits, not 35°.
    expect(worstAngleError(3) * DEG).toBeCloseTo(45.27, 2)
  })

  it("matches 2√6 / 2^b within 1% from 4 bits up", () => {
    for (let bits = 4; bits <= 14; bits++) {
      const formula = (2 * Math.sqrt(6)) / 2 ** bits
      expect(Math.abs(worstAngleError(bits) / formula - 1)).toBeLessThan(0.01)
    }
  })

  it("finds a worse case than random or dense sampling does", () => {
    for (const bits of [4, 9, 12]) {
      const worst = worstAngleError(bits)
      const random = mulberry32(6)
      const step = stepSize(-M, M, bits)
      let uniform = 0
      let dense = 0
      for (let i = 0; i < 200000; i++) {
        const q = randomQuat(random)
        uniform = Math.max(uniform, angleBetween(q, quatTrip(q, bits)))
        const near = () => 0.5 + (random() - 0.5) * 10 * step
        const [x, y, z] = [near(), near(), near()]
        const rest = 1 - x * x - y * y - z * z
        if (rest <= 0) continue
        const n: Quat = [x, y, z, Math.sqrt(rest)]
        dense = Math.max(dense, angleBetween(n, quatTrip(n, bits)))
      }
      expect(uniform).toBeLessThan(worst)
      expect(dense).toBeLessThan(worst)
    }
  })

  it("beats 8.8.8.8 and costs fewer bits", () => {
    const random = mulberry32(3)
    let packed = 0
    let three = 0
    for (let i = 0; i < 1_000_000; i++) {
      const q = randomQuat(random)
      const e = normalize([
        roundTrip(q[0], -1, 1, 8),
        roundTrip(q[1], -1, 1, 8),
        roundTrip(q[2], -1, 1, 8),
        roundTrip(q[3], -1, 1, 8),
      ])
      packed = Math.max(packed, angleBetween(q, e))
      three = Math.max(three, angleBetween(q, quatTrip(q, 9)))
    }
    expect(packed * DEG).toBeCloseTo(0.87, 2)
    expect(three * DEG).toBeCloseTo(0.47, 2)
  })

  it("loses the rotation without the sign flip", () => {
    const q = normalize([0.1, 0.2, 0.3, -0.9])
    const [a, b, c] = [q[0], q[1], q[2]].map((v) => roundTrip(v, -M, M, 9))
    const wrong = normalize([a, b, c, Math.sqrt(1 - a * a - b * b - c * c)])
    expect(angleBetween(q, wrong) * DEG).toBeCloseTo(90.39, 2)
    expect(angleBetween(q, quatTrip(q, 9)) * DEG).toBeCloseTo(0.137, 3)
  })

  it("is worse when always dropping w, even with one more bit", () => {
    const random = mulberry32(4)
    let worst = 0
    for (let i = 0; i < 1_000_000; i++) {
      const q = randomQuat(random)
      const s = q[3] < 0 ? -1 : 1
      const x = roundTrip(q[0] * s, -1, 1, 10)
      const y = roundTrip(q[1] * s, -1, 1, 10)
      const z = roundTrip(q[2] * s, -1, 1, 10)
      const w = Math.sqrt(Math.max(0, 1 - x * x - y * y - z * z))
      worst = Math.max(worst, angleBetween(q, normalize([x, y, z, w])))
    }
    expect(worst * DEG).toBeCloseTo(6.3, 1)
    expect(worst).toBeGreaterThan(10 * worstAngleError(9))
  })

  it("writes into the output objects it is given", () => {
    const q = normalize([0.3, -0.4, 0.5, 0.2])
    const encoded = encodeQuat(q, 9)
    const out: Quat = [0, 0, 0, 0]
    expect(encodeQuat(q, 9, encoded)).toBe(encoded)
    expect(decodeQuat(encoded, 9, out)).toBe(out)
    expect(angleBetween(q, out)).toBeLessThan(worstAngleError(9))
  })
})
