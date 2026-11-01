import { describe, expect, it } from "vite-plus/test"

import {
  focalSweptArea,
  harmonicPendulumAngle,
  histogram,
  leverNetTorque,
  pendulumPeriod,
  projectileSamples,
  sampleStats,
  solveKepler,
  stepBuoyancy,
  stepDrivenOscillator,
  stepPendulum,
  steadyStateAmplitude,
  submergedFraction,
} from "./mechanics-labs"

describe("driven oscillator", () => {
  it("settles to the analytic steady-state amplitude", () => {
    const s = { x: 0, v: 0, t: 0 }
    const [k, c, f0, w] = [1.4, 0.35, 0.4, 1.2]
    let peak = 0
    for (let i = 0; i < 120 * 120; i++) {
      stepDrivenOscillator(s, k, c, f0, w, 1 / 120)
      if (i > 100 * 120) peak = Math.max(peak, Math.abs(s.x))
    }
    expect(peak).toBeCloseTo(steadyStateAmplitude(k, c, f0, w), 1)
  })
})

describe("pendulum", () => {
  it("matches the small-angle period for tiny swings", () => {
    const s = { theta: 0.01, omega: 0, t: 0 }
    let crossings = 0
    let last = s.theta
    let firstT = 0
    let lastT = 0
    while (crossings < 5) {
      stepPendulum(s, 9.8, 1, 0, 1 / 1000)
      if (last > 0 && s.theta <= 0) {
        crossings++
        if (crossings === 1) firstT = s.t
        lastT = s.t
      }
      last = s.theta
    }
    expect((lastT - firstT) / 4).toBeCloseTo(pendulumPeriod(1, 9.8), 2)
  })

  it("lengthens the period at large amplitude", () => {
    expect(pendulumPeriod(1, 9.8, 1)).toBeGreaterThan(pendulumPeriod(1, 9.8))
  })

  it("linear model starts at θ0 and decays", () => {
    expect(harmonicPendulumAngle(0.5, 9.8, 1, 0.2, 0)).toBeCloseTo(0.5)
    expect(Math.abs(harmonicPendulumAngle(0.5, 9.8, 1, 0.2, 30))).toBeLessThan(
      0.05
    )
  })
})

describe("Kepler", () => {
  it("solves M = E − e sin E even at high eccentricity", () => {
    for (const e of [0, 0.3, 0.85, 0.95]) {
      for (let M = -3; M <= 3; M += 0.25) {
        const E = solveKepler(M, e)
        expect(E - e * Math.sin(E)).toBeCloseTo(M, 9)
      }
    }
  })

  it("sweeps equal areas in equal times", () => {
    const e = 0.6
    const areas = [0, 1, 2, 3].map((i) => {
      const E1 = solveKepler((i * Math.PI) / 2, e)
      const E2 = solveKepler(((i + 1) * Math.PI) / 2, e)
      const unwrap = E2 < E1 ? E2 + 2 * Math.PI : E2
      return focalSweptArea(4, e, E1, unwrap)
    })
    for (const a of areas) expect(a).toBeCloseTo(areas[0], 9)
  })
})

describe("lever", () => {
  it("balances when m1·r1 = m2·r2", () => {
    expect(leverNetTorque(3, 2, 2, 3)).toBeCloseTo(0)
    expect(leverNetTorque(4, 2, 2, 3)).toBeGreaterThan(0)
  })
})

describe("projectile samples", () => {
  it("is deterministic, centred and bounded by the spread", () => {
    const xs = projectileSamples(45, 24, 8, 20)
    expect(xs).toEqual(projectileSamples(45, 24, 8, 20))
    const ideal = (24 * 24) / 9.81
    const { mean, min, max } = sampleStats(xs)
    expect(min).toBeGreaterThan(ideal * 0.92 ** 2 - 1e-9)
    expect(max).toBeLessThan(ideal * 1.08 ** 2 + 1e-9)
    // R ∝ v² is convex, so the mean range exceeds the range of the mean speed.
    expect(mean).toBeGreaterThan(ideal)
  })

  it("has no spread with zero error", () => {
    expect(sampleStats(projectileSamples(30, 20, 0, 10)).std).toBeCloseTo(0)
  })

  it("histograms every sample", () => {
    const xs = projectileSamples(45, 24, 8, 40)
    const { min, max } = sampleStats(xs)
    const h = histogram(xs, 10, min, max)
    expect(h.reduce((a, b) => a + b, 0)).toBe(40)
    expect(histogram([5, 5], 4, 5, 5)).toEqual([2, 0, 0, 0])
  })
})

describe("buoyancy", () => {
  it("computes the submerged fraction", () => {
    expect(submergedFraction(10, 1, 0)).toBe(0)
    expect(submergedFraction(0, 1, 0)).toBe(0.5)
    expect(submergedFraction(-10, 1, 0)).toBe(1)
  })

  it("floats at ρo/ρf submerged and sinks when denser", () => {
    const s = { y: 2, v: 0 }
    for (let i = 0; i < 120 * 30; i++)
      stepBuoyancy(s, 650, 1000, 1.4, 0, -5, 1.8, 1 / 120)
    expect(submergedFraction(s.y, 1.4, 0)).toBeCloseTo(0.65, 2)
    const d = { y: 2, v: 0 }
    for (let i = 0; i < 120 * 30; i++)
      stepBuoyancy(d, 1500, 1000, 1.4, 0, -5, 1.8, 1 / 120)
    expect(d.y).toBe(-5)
  })
})
