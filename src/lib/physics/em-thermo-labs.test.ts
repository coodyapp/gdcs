import { describe, expect, it } from "vite-plus/test"

import { calculateBoltzmannAcceptance } from "./boltzmann"
import { fieldAt, traceAllLines, traceFieldLine } from "./electric-field"
import { createFdtd, fdtdEnergy, stepFdtd } from "./fdtd"
import { heatStep, maxStableDt } from "./heat-diffusion"
import {
  createGas,
  idealPressure,
  kineticTemperature,
  stepGas,
} from "./ideal-gas"
import {
  borisStep,
  eulerStep,
  exbDriftSpeed,
  larmorRadius,
  rk4Step,
  type LorentzStepper,
  type ParticleState,
} from "./lorentz"
import {
  energyDensity,
  gammaFunction,
  meanThermalEnergy,
  metropolisAcceptance,
  metropolisSweep,
} from "./metropolis"
import { mulberry32 } from "./seeded-random"

describe("electric field", () => {
  const dipole = [
    { x: -1, y: 0, q: 1 },
    { x: 1, y: 0, q: -1 },
  ]

  it("points from + to − between a dipole's charges", () => {
    const e = fieldAt(dipole, 0, 0, { x: 0, y: 0 })
    expect(e.x).toBeGreaterThan(0)
    expect(Math.abs(e.y)).toBeLessThan(1e-12)
  })

  it("falls off as 1/r² from a single charge", () => {
    const one = [{ x: 0, y: 0, q: 1 }]
    const a = fieldAt(one, 2, 0, { x: 0, y: 0 }).x
    const b = fieldAt(one, 4, 0, { x: 0, y: 0 }).x
    expect(a / b).toBeCloseTo(4, 6)
  })

  it("traces a line from + that ends on −", () => {
    const pts = traceFieldLine(dipole, 0, 0.4, { maxSteps: 200 })
    const x = pts[pts.length - 3]
    const y = pts[pts.length - 2]
    expect(Math.hypot(x - 1, y)).toBeLessThan(0.45)
  })

  it("seeds line counts proportional to charge", () => {
    expect(traceAllLines([{ x: 0, y: 0, q: 2 }], 6)).toHaveLength(12)
  })
})

describe("Lorentz steppers", () => {
  const E0 = [0, 0, 0] as const
  const B = [0, 0, 1.5] as const
  const start = (): ParticleState => ({ x: 0, y: 0, z: 0, vx: 1, vy: 0, vz: 0 })

  function run(
    step: LorentzStepper,
    E: readonly [number, number, number],
    steps: number,
    dt: number
  ) {
    const s = start()
    let minY = 0
    let maxY = 0
    let sumVx = 0
    for (let i = 0; i < steps; i++) {
      step(s, E, B, 1, dt)
      minY = Math.min(minY, s.y)
      maxY = Math.max(maxY, s.y)
      sumVx += s.vx
    }
    return { s, diameter: maxY - minY, meanVx: sumVx / steps }
  }

  it("RK4 orbits at the Larmor radius with tiny energy error", () => {
    const { s, diameter } = run(rk4Step, E0, 4000, 1 / 120)
    expect(diameter / 2).toBeCloseTo(larmorRadius(1, 1.5, 1), 3)
    expect(Math.abs(Math.hypot(s.vx, s.vy) - 1)).toBeLessThan(1e-6)
  })

  it("Boris conserves speed to round-off in a pure B field", () => {
    const { s } = run(borisStep, E0, 20000, 1 / 30)
    expect(Math.abs(Math.hypot(s.vx, s.vy) - 1)).toBeLessThan(1e-12)
  })

  it("explicit Euler gains energy", () => {
    const { s } = run(eulerStep, E0, 2000, 1 / 60)
    expect(Math.hypot(s.vx, s.vy)).toBeGreaterThan(1.1)
  })

  it("crossed fields drift at E/B along E × B", () => {
    // E = +y, B = +z  →  E × B points along +x.
    // Average over a whole number of gyro periods (T = 2π/1.5).
    const steps = Math.round((20 * 2 * Math.PI * 120) / 1.5)
    const { meanVx } = run(borisStep, [0, 0.3, 0], steps, 1 / 120)
    expect(meanVx).toBeCloseTo(exbDriftSpeed(0.3, 1.5), 2)
  })
})

describe("1D FDTD", () => {
  const pulse = (n: number, center: number) => {
    const g = createFdtd(n)
    for (let i = 0; i < n; i++) g.ey[i] = Math.exp(-(((i - center) / 4) ** 2))
    // Matching Hz (on half nodes, half a step behind) makes a one-way +x pulse.
    for (let i = 0; i < n - 1; i++)
      g.hz[i] = Math.exp(-(((i + 1 - center) / 4) ** 2))
    return g
  }
  const peak = (a: Float64Array) => a.indexOf(Math.max(...a))

  it("moves one cell per step at the magic time step S = 1", () => {
    const g = pulse(200, 50)
    for (let i = 0; i < 40; i++) stepFdtd(g, 1)
    expect(peak(g.ey)).toBe(90)
  })

  it("stays bounded for S ≤ 1 and the Mur boundary absorbs", () => {
    const g = pulse(200, 100)
    const e0 = fdtdEnergy(g)
    for (let i = 0; i < 1000; i++) stepFdtd(g, 0.5)
    expect(fdtdEnergy(g)).toBeLessThan(0.02 * e0)
  })

  it("blows up when the Courant limit is broken", () => {
    const g = pulse(200, 100)
    for (let i = 0; i < 400; i++) stepFdtd(g, 1.1)
    expect(fdtdEnergy(g)).toBeGreaterThan(1e6)
  })
})

describe("explicit heat diffusion", () => {
  const n = 21
  const hotSpot = () => {
    const T = new Float32Array(n * n)
    T[10 * n + 10] = 1
    return T
  }
  const evolve = (r: number, steps: number) => {
    let a = hotSpot()
    let b = new Float32Array(n * n)
    for (let i = 0; i < steps; i++) {
      heatStep(a, b, n, r)
      ;[a, b] = [b, a]
    }
    return a
  }

  it("gives the 2D limit Δt = Δx²/(4α)", () => {
    expect(maxStableDt(0.2, 0.1)).toBeCloseTo(0.0125, 10)
  })

  it("obeys the maximum principle when r ≤ ¼", () => {
    const T = evolve(0.25, 300)
    expect(Math.max(...T)).toBeLessThanOrEqual(1)
    expect(Math.min(...T)).toBeGreaterThanOrEqual(0)
  })

  it("oscillates and grows when r > ¼", () => {
    const T = evolve(0.3, 80)
    expect(Math.max(...T.map(Math.abs))).toBeGreaterThan(10)
    expect(Math.min(...T)).toBeLessThan(-10) // non-physical negative temperatures
  })
})

describe("ideal gas", () => {
  it("wall impulse rate matches P = NkT/V", () => {
    const half = [2, 1.5, 2] as const
    const g = createGas(300, half, 7)
    const T = 1.3
    const dt = 1 / 200
    let impulse = 0
    const steps = 40000
    for (let i = 0; i < steps; i++) impulse += stepGas(g, g.n, dt, T, half)
    const area = 8 * (half[0] * half[1] + half[1] * half[2] + half[0] * half[2])
    const measured = impulse / (steps * dt) / area
    const volume = 8 * half[0] * half[1] * half[2]
    const expected = idealPressure(g.n, kineticTemperature(g, g.n, T), volume)
    expect(Math.abs(measured / expected - 1)).toBeLessThan(0.03)
  })

  it("seeds near-Maxwellian velocities (⟨v²⟩ ≈ 3)", () => {
    const g = createGas(2000, [1, 1, 1], 3)
    expect(kineticTemperature(g, g.n, 1)).toBeCloseTo(1, 1)
  })
})

describe("Metropolis Boltzmann sampler", () => {
  it("matches the shared 3D acceptance rule for p = ½", () => {
    for (const [a, b, t] of [
      [1, 2, 0.5],
      [2, 1, 1],
      [0.3, 0.9, 2],
    ]) {
      expect(metropolisAcceptance(a, b, t, 0.5)).toBeCloseTo(
        calculateBoltzmannAcceptance(a, b, t),
        12
      )
    }
  })

  it("has a normalised density", () => {
    expect(gammaFunction(5)).toBeCloseTo(24, 8)
    let sum = 0
    const de = 0.001
    for (let e = de / 2; e < 30; e += de) sum += energyDensity(e, 1.5, 0.5) * de
    expect(sum).toBeCloseTo(1, 3)
  })

  it("converges to ⟨E⟩ = (p+1)kT", () => {
    const random = mulberry32(11)
    for (const p of [0, 0.5, 1.5]) {
      const energies = new Float32Array(4000).fill(0.05)
      let mean = 0
      for (let s = 0; s < 400; s++) {
        metropolisSweep(energies, 1.2, p, 1.2, random)
        if (s >= 200)
          mean += energies.reduce((a, b) => a + b, 0) / energies.length / 200
      }
      expect(mean / meanThermalEnergy(1.2, p)).toBeCloseTo(1, 1)
    }
  })
})
