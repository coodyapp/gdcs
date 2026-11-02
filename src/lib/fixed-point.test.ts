import { describe, expect, it, vi } from "vite-plus/test"

import {
  ARENA_X,
  ARENA_Y,
  bitsOf,
  checksum,
  FX_MAX,
  FX_MIN,
  FX_ONE,
  fxAdd,
  fxDiv,
  fxFromFloat,
  fxMul,
  fxSub,
  fxToFloat,
  measureSplit,
  nudgeUlps,
  ownSin,
  PEG_HIT_RADIUS,
  PEGS,
  startOf,
  stepFixed,
  TwinRun,
  ulpOf,
} from "./fixed-point"

// The 1000-seed and 200000-step runs can pass 5 s on a busy machine.
vi.setConfig({ testTimeout: 60000 })

const DEFAULT_SEED = 86

/** A small integer PRNG, so the test inputs involve no engine math. */
function rng(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return (t ^ (t >>> 14)) | 0
  }
}

const mulOracle = (a: number, b: number) =>
  Number(BigInt.asIntN(32, (BigInt(a) * BigInt(b)) >> 16n))

describe("float rounding", () => {
  it("is not associative: (a + b) + c differs from a + (b + c)", () => {
    const left = 0.1 + 0.2 + 0.3
    const right = 0.1 + (0.2 + 0.3)
    expect(left).toBe(0.6000000000000001)
    expect(right).toBe(0.6)
    expect(nudgeUlps(right, 1)).toBe(left)
  })

  it("makes a sum depend on iteration order", () => {
    const values: number[] = []
    for (let i = 0; i < 1000; i++) {
      const [x, y] = startOf(i)
      values.push(x * 0.7 + y / 3)
    }
    const forward = values.reduce((sum, v) => sum + v, 0)
    const backward = values.toReversed().reduce((sum, v) => sum + v, 0)
    expect(forward).not.toBe(backward)
    expect(Math.abs(forward - backward)).toBeLessThan(1e-11)
  })

  it("gives a*b+c a different answer if the multiply is not rounded first", () => {
    const a = 1 + 2 ** -27
    const b = 1 - 2 ** -27
    // Two roundings, which ECMAScript requires for this expression.
    expect(a * b - 1).toBe(0)
    // One rounding, as a fused multiply-add does: computed exactly in integers.
    const scale = 2n ** 27n
    const exact =
      BigInt(a * Number(scale)) * BigInt(b * Number(scale)) - scale * scale
    expect(exact).toBe(-1n)
    expect(Number(exact) * 2 ** -54).toBe(-(2 ** -54))
  })

  it("moves by exactly one representable step", () => {
    expect(nudgeUlps(1, 1) - 1).toBe(Number.EPSILON)
    expect(ulpOf(1)).toBe(Number.EPSILON)
    expect(nudgeUlps(-1, 1)).toBe(-1 - Number.EPSILON)
    expect(nudgeUlps(nudgeUlps(0.3, 5), -5)).toBe(0.3)
  })

  it("builds a sine close to Math.sin from basic operators", () => {
    expect(ownSin(0)).toBe(0)
    let worst = 0
    for (let i = 0; i <= 200000; i++) {
      const x = -20 + (i * 40) / 200000
      worst = Math.max(worst, Math.abs(ownSin(x) - Math.sin(x)))
    }
    expect(worst).toBeLessThan(5.7e-8)
  })
})

describe("two floating-point copies", () => {
  it("split at a measured step, from one rounding step", () => {
    const run = new TwinRun({ seed: DEFAULT_SEED, ulps: 1, fixed: false })
    while (run.splitStep === null) run.advance()
    expect(run.splitStep).toBe(550)
    expect(run.firstMismatch).toBe(0)
  })

  it("grow by more than a factor of a million in 250 steps", () => {
    const run = new TwinRun({ seed: DEFAULT_SEED, ulps: 1, fixed: false })
    const at: Record<number, number> = {}
    while (run.step < 550) {
      run.advance()
      at[run.step] = run.distance
    }
    expect(at[300]).toBeLessThan(1e-6)
    expect(at[300]).toBeGreaterThan(0)
    expect(at[550]).toBeGreaterThanOrEqual(3)
    expect(at[550] / at[300]).toBeGreaterThan(1e6)
  })

  it("split sooner or later for every starting difference on the slider", () => {
    for (let ulps = 1; ulps <= 16; ulps++) {
      const step = measureSplit({ seed: DEFAULT_SEED, ulps, fixed: false }, 800)
      expect(step, `${ulps} ulps`).not.toBeNull()
      expect(step, `${ulps} ulps`).toBeGreaterThan(300)
    }
  })

  it("stay identical with no difference: a single engine hides the problem", () => {
    const run = new TwinRun({ seed: DEFAULT_SEED, ulps: 0, fixed: false })
    for (let i = 0; i < 20000; i++) run.advance()
    expect(run.firstMismatch).toBeNull()
    expect(run.distance).toBe(0)
  })

  it("sometimes absorb the difference, so a clean test run proves little", () => {
    const splits: number[] = []
    let identical = 0
    for (let seed = 1; seed <= 1000; seed++) {
      const run = new TwinRun({ seed, ulps: 1, fixed: false })
      while (run.splitStep === null && run.step < 20000) run.advance()
      if (run.splitStep !== null) splits.push(run.splitStep)
      else if (run.matching) identical++
    }
    splits.sort((a, b) => a - b)
    expect(identical).toBe(196)
    expect(splits.length).toBe(804)
    expect(splits[0]).toBe(393)
    expect(splits[402]).toBe(859)
    expect(splits[803]).toBe(7960)
  })

  it("match checksums recorded under JavaScriptCore", () => {
    // Node's V8 and macOS's JavaScriptCore both gave these after 200000 steps.
    const run = new TwinRun({ seed: DEFAULT_SEED, ulps: 1, fixed: false })
    for (let i = 0; i < 200000; i++) run.advance()
    expect(run.checksumOf(0)).toBe(1055611524)
    expect(run.checksumOf(1)).toBe(184389439)
  })
})

describe("Q16.16 arithmetic", () => {
  it("matches a BigInt oracle over a seeded run", () => {
    const next = rng(1234)
    for (let i = 0; i < 100000; i++) {
      const a = next()
      const b = next()
      expect(fxMul(a, b)).toBe(mulOracle(a, b))
      expect(fxAdd(a, b)).toBe(Number(BigInt.asIntN(32, BigInt(a) + BigInt(b))))
      expect(fxSub(a, b)).toBe(Number(BigInt.asIntN(32, BigInt(a) - BigInt(b))))
    }
  })

  it("is exact where floats are not", () => {
    const tenth = fxFromFloat(0.1)
    const twoTenths = fxFromFloat(0.2)
    const threeTenths = fxFromFloat(0.3)
    expect(fxAdd(fxAdd(tenth, twoTenths), threeTenths)).toBe(
      fxAdd(tenth, fxAdd(twoTenths, threeTenths))
    )
  })

  it("wraps on overflow, the same way every time", () => {
    expect(fxAdd(FX_MAX, 1)).toBe(FX_MIN)
    expect(fxSub(FX_MIN, 1)).toBe(FX_MAX)
    // 256 × 256 = 65536, one past the range: it wraps to exactly zero.
    expect(fxMul(256 * FX_ONE, 256 * FX_ONE)).toBe(0)
    expect(fxMul(200 * FX_ONE, 400 * FX_ONE)).toBe(
      mulOracle(200 * FX_ONE, 400 * FX_ONE)
    )
    expect(fxMul(181 * FX_ONE, 181 * FX_ONE)).toBe(32761 * FX_ONE)
    expect(fxMul(182 * FX_ONE, 182 * FX_ONE)).toBeLessThan(0)
  })

  it("rounds products down and quotients toward zero", () => {
    expect(fxMul(1, 1)).toBe(0)
    expect(fxMul(-1, 1)).toBe(-1)
    expect(fxDiv(FX_ONE, 3 * FX_ONE)).toBe(21845)
    expect(fxDiv(-FX_ONE, 3 * FX_ONE)).toBe(-21845)
  })

  it("has a defined answer for every division", () => {
    expect(fxDiv(FX_ONE, 0)).toBe(FX_MAX)
    expect(fxDiv(-FX_ONE, 0)).toBe(FX_MIN)
    expect(fxDiv(0, 0)).toBe(FX_MAX)
    expect(fxDiv(FX_MIN, -FX_ONE)).toBe(FX_MIN) // +32768 wraps
    expect(fxDiv(256 * FX_ONE, 1)).toBe(0)
  })

  it("rounds a tiny float difference away, except at a boundary", () => {
    const x = startOf(DEFAULT_SEED)[2]
    expect(fxFromFloat(nudgeUlps(x, 16))).toBe(fxFromFloat(x))
    const boundary = 1.5 / FX_ONE
    expect(fxFromFloat(boundary)).toBe(2)
    expect(fxFromFloat(nudgeUlps(boundary, -1))).toBe(1)
    expect(fxToFloat(FX_ONE)).toBe(1)
  })
})

describe("two fixed-point copies", () => {
  it("stay identical at every step, for every float difference", () => {
    for (const seed of [DEFAULT_SEED, 1, 2, 3]) {
      for (const ulps of [1, 2, 8, 16]) {
        const run = new TwinRun({ seed, ulps, fixed: true })
        for (let i = 0; i < 20000; i++) run.advance()
        expect(run.firstMismatch).toBeNull()
        expect(run.distance).toBe(0)
        expect(run.splitStep).toBeNull()
      }
    }
  })

  it("repeat exactly over a seeded run, across engines", () => {
    const run = new TwinRun({ seed: DEFAULT_SEED, ulps: 1, fixed: true })
    const speed = run.speedOfA()
    for (let i = 0; i < 200000; i++) run.advance()
    // V8 and JavaScriptCore both gave this checksum.
    expect(run.checksumOf(0)).toBe(1151718245)
    expect(run.checksumOf(1)).toBe(1151718245)
    // Truncation is a bias, not noise: the ball loses about 22% of its speed.
    expect(speed).toBeCloseTo(1.41948, 5)
    expect(run.speedOfA()).toBeCloseTo(1.10188, 5)
  })

  it("stay inside the world without overflowing", () => {
    const s = Int32Array.from(startOf(DEFAULT_SEED), fxFromFloat)
    for (let i = 0; i < 20000; i++) {
      stepFixed(s)
      // One step past a wall reflects back in, so positions stay in range.
      expect(Math.abs(fxToFloat(s[0]))).toBeLessThanOrEqual(ARENA_X)
      expect(Math.abs(fxToFloat(s[1]))).toBeLessThanOrEqual(ARENA_Y)
      expect(Math.abs(fxToFloat(s[2]))).toBeLessThan(3)
      expect(Math.abs(fxToFloat(s[3]))).toBeLessThan(3)
    }
  })

  it("still fork from one lsb: integers remove the cause, not the chaos", () => {
    expect(
      measureSplit({ seed: DEFAULT_SEED, ulps: 0, fixed: true, lsb: 1 })
    ).toBe(135)
    const splits: number[] = []
    for (let seed = 1; seed <= 1000; seed++) {
      const step = measureSplit({ seed, ulps: 0, fixed: true, lsb: 1 })
      expect(step, `seed ${seed}`).not.toBeNull()
      splits.push(step ?? 0)
    }
    splits.sort((a, b) => a - b)
    expect(splits[500]).toBe(200)
  })
})

describe("checksums", () => {
  it("find the first differing step, before any distance shows", () => {
    for (const nudgeAtStep of [1, 100, 4321]) {
      const run = new TwinRun({
        seed: DEFAULT_SEED,
        ulps: 1,
        fixed: false,
        nudgeAtStep,
      })
      while (run.step < nudgeAtStep) {
        expect(run.matching, `step ${run.step}`).toBe(true)
        run.advance()
      }
      expect(run.matching).toBe(false)
      expect(run.firstMismatch).toBe(nudgeAtStep)
      // Only a velocity differs yet: the two positions are still the same bits.
      expect(run.distance).toBe(0)
    }
  })

  it("detect a change in any one word", () => {
    const next = rng(99)
    for (let i = 0; i < 2000; i++) {
      const words = Int32Array.of(next(), next(), next(), next())
      const before = checksum(words)
      words[i % 4] ^= 1 << (i % 32)
      expect(checksum(words)).not.toBe(before)
    }
  })

  it("see the difference between zeros that compare equal", () => {
    const a = Float64Array.of(0)
    const b = Float64Array.of(-0)
    expect(a[0] === b[0]).toBe(true)
    expect(checksum(bitsOf(a))).not.toBe(checksum(bitsOf(b)))
  })
})

describe("the world", () => {
  it("starts every seed clear of the pegs", () => {
    for (let seed = 0; seed < 500; seed++) {
      const [x, y] = startOf(seed)
      for (const [px, py] of PEGS) {
        const d2 = (x - px) ** 2 + (y - py) ** 2
        expect(d2).toBeGreaterThan(PEG_HIT_RADIUS ** 2)
      }
      expect(Math.abs(x)).toBeLessThanOrEqual(ARENA_X)
      expect(Math.abs(y)).toBeLessThanOrEqual(ARENA_Y)
    }
  })
})
