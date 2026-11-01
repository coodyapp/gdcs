import { describe, it, expect } from "vite-plus/test"
import { Vector3 } from "three"
import { PHYSICS_CONSTANTS } from "@/lib/physics/constants"
import {
  advanceOrbitState,
  calculateOrbitalPeriod,
  calculatePrecessionPerOrbit,
  calculateRealPrecessionPerOrbit,
  calculateOrbitalVelocity,
  stepOrbitInPlace,
} from "@/lib/physics/mercury"

const { M_sun } = PHYSICS_CONSTANTS
const RAD_TO_ARCSEC = (180 * 3600) / Math.PI

describe("Mercury precession — real SI reference", () => {
  // Mercury: a = 5.791e10 m, e = 0.206, ~415 orbits per century.
  const mercuryA = 5.791e10
  const mercuryE = 0.206
  const orbitsPerCentury = 415

  it("recovers Mercury's ~43 arcsec/century anomalous precession", () => {
    const radPerOrbit = calculateRealPrecessionPerOrbit(
      M_sun,
      mercuryA,
      mercuryE
    )
    const arcsecPerCentury = radPerOrbit * RAD_TO_ARCSEC * orbitsPerCentury
    // The observed value is 42.98 arcsec/century.
    expect(arcsecPerCentury).toBeCloseTo(42.98, 0)
  })

  it("gives ~0.103 arcsec per orbit", () => {
    const radPerOrbit = calculateRealPrecessionPerOrbit(
      M_sun,
      mercuryA,
      mercuryE
    )
    expect(radPerOrbit * RAD_TO_ARCSEC).toBeCloseTo(0.1035, 2)
  })

  it("scales linearly with central mass (Δω ∝ M)", () => {
    const r1 = calculateRealPrecessionPerOrbit(M_sun, mercuryA, mercuryE)
    const r2 = calculateRealPrecessionPerOrbit(2 * M_sun, mercuryA, mercuryE)
    expect(r2 / r1).toBeCloseTo(2, 6)
  })

  it("increases with eccentricity (1/(1-e^2) factor)", () => {
    const low = calculateRealPrecessionPerOrbit(M_sun, mercuryA, 0.1)
    const high = calculateRealPrecessionPerOrbit(M_sun, mercuryA, 0.5)
    expect(high).toBeGreaterThan(low)
  })
})

describe("Mercury precession — simulation units", () => {
  const a = 8
  const e = 0.206

  it("produces a visible, positive precession for a 1-solar-mass star", () => {
    const rad = calculatePrecessionPerOrbit(M_sun, a, e)
    expect(rad).toBeGreaterThan(0)
    // Tuned to be a few degrees per orbit so it is visible.
    const deg = (rad * 180) / Math.PI
    expect(deg).toBeGreaterThan(0.5)
    expect(deg).toBeLessThan(10)
  })

  it("scales linearly with mass", () => {
    const r1 = calculatePrecessionPerOrbit(M_sun, a, e)
    const r3 = calculatePrecessionPerOrbit(3 * M_sun, a, e)
    expect(r3 / r1).toBeCloseTo(3, 6)
  })

  it("orbital velocity satisfies the vis-viva equation", () => {
    // Perihelion r = a(1-e); v^2 = GM(2/r - 1/a) with M = 1 solar mass in sim units.
    const r = a * (1 - e)
    const v = calculateOrbitalVelocity(M_sun, r, a)
    const expected = Math.sqrt(1 * 1 * (2 / r - 1 / a))
    expect(v).toBeCloseTo(expected, 6)
    // Weak-field: v << c_sim.
    expect(v).toBeLessThan(8)
  })

  it("orbital velocity at r = a (circular) is sqrt(GM/a)", () => {
    const v = calculateOrbitalVelocity(M_sun, a, a)
    expect(v).toBeCloseTo(Math.sqrt(1 / a), 6)
  })

  it("advances a circular orbit with RK4", () => {
    const radius = 8
    const dt = 0.1
    const next = advanceOrbitState(
      {
        position: new Vector3(radius, 0, 0),
        velocity: new Vector3(
          0,
          calculateOrbitalVelocity(M_sun, radius, radius),
          0
        ),
      },
      M_sun,
      false,
      dt
    )

    expect(next.velocity.x).toBeCloseTo(-dt / radius ** 2, 4)
  })

  it("rejects invalid orbit parameters and integration steps", () => {
    expect(() => calculatePrecessionPerOrbit(0, a, e)).toThrow()
    expect(() => calculateRealPrecessionPerOrbit(M_sun, a, 1)).toThrow()
    expect(() => calculateOrbitalVelocity(M_sun, 0, a)).toThrow()
    expect(() =>
      advanceOrbitState(
        { position: new Vector3(a, 0, 0), velocity: new Vector3(0, 1, 0) },
        M_sun,
        true,
        Infinity
      )
    ).toThrow()
  })

  it("limits long-run circular-orbit energy drift", () => {
    let state = {
      position: new Vector3(a, 0, 0),
      velocity: new Vector3(0, calculateOrbitalVelocity(M_sun, a, a), 0),
    }
    const initialEnergy =
      state.velocity.lengthSq() / 2 - 1 / state.position.length()
    for (let i = 0; i < 30_000; i++)
      state = advanceOrbitState(state, M_sun, false, 1 / 120)
    const finalEnergy =
      state.velocity.lengthSq() / 2 - 1 / state.position.length()
    expect(
      Math.abs((finalEnergy - initialEnergy) / initialEnergy)
    ).toBeLessThan(1e-8)
  })

  it("produces frame-rate-independent states when accumulated time is retained", () => {
    const run = (frameDelta: number) => {
      let state = {
        position: new Vector3(a, 0, 0),
        velocity: new Vector3(0, calculateOrbitalVelocity(M_sun, a, a), 0),
      }
      let accumulator = 0
      for (let elapsed = 0; elapsed < 2 - 1e-12; elapsed += frameDelta) {
        accumulator += Math.min(frameDelta, 2 - elapsed) * 50
        const steps = Math.floor((accumulator + 1e-12) / (1 / 120))
        accumulator -= steps / 120
        for (let i = 0; i < steps; i++)
          state = advanceOrbitState(state, M_sun, true, 1 / 120)
      }
      return state
    }
    const at30Fps = run(1 / 30)
    const at144Fps = run(1 / 144)
    expect(at30Fps.position.distanceTo(at144Fps.position)).toBeLessThan(1e-8)
    expect(at30Fps.velocity.distanceTo(at144Fps.velocity)).toBeLessThan(1e-8)
  })
})

describe("Mercury precession — integrator vs. formula", () => {
  /** Integrate until the n-th perihelion passage and return its angle. */
  function perihelionAngle(e: number, relativity: boolean, passages: number) {
    const a = 8
    const r0 = a * (1 - e)
    const s = new Float64Array([
      r0,
      0,
      0,
      0,
      calculateOrbitalVelocity(M_sun, r0, a),
      0,
    ])
    let prev2 = Infinity
    let prev = r0
    let px = r0
    let py = 0
    let found = 0
    const steps = Math.ceil(
      calculateOrbitalPeriod(M_sun, a) * (passages + 0.5) * 120
    )
    for (let i = 0; i < steps; i++) {
      const x = s[0]
      const y = s[1]
      stepOrbitInPlace(s, M_sun, relativity, 1 / 120)
      const r = Math.hypot(s[0], s[1])
      if (prev < prev2 && prev < r && i > 1) {
        found++
        px = x
        py = y
        if (found === passages) break
      }
      prev2 = prev
      prev = r
    }
    return Math.atan2(py, px)
  }

  it("classical orbit stays closed", () => {
    expect(Math.abs(perihelionAngle(0.206, false, 3))).toBeLessThan(2e-3)
  })

  it("GR orbit advances by 6πGM/(c²a(1−e²)) per orbit", () => {
    const measured = perihelionAngle(0.206, true, 3) / 3
    const predicted = calculatePrecessionPerOrbit(M_sun, 8, 0.206)
    expect(measured / predicted).toBeGreaterThan(0.95)
    expect(measured / predicted).toBeLessThan(1.05)
  })
})
