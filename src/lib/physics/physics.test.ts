import { describe, it, expect } from "vite-plus/test"
import { Vector3 } from "three"
import { PHYSICS_CONSTANTS } from "@/lib/physics/constants"
import {
  calculateGravitationalForce,
  calculateGravitationalAcceleration,
  schwarzschildRadius,
  escapeVelocity,
  calculateBinarySystem,
  calculateBinaryPotentialProxy,
  calculateSpacetimeCurvatureSimple,
  calculatePotentialWellProxy,
  type CelestialBody,
} from "@/lib/physics/gravity"
import {
  calculateGravitationalWaveAmplitude,
  calculateStrainTensor,
  type WaveSource,
} from "@/lib/physics/gravitational"
import {
  calculateAngularPhase,
  calculateBarycentricPositions,
  calculateBarycentricRadii,
} from "@/lib/physics/binary-orbit"
import { calculateBoltzmannAcceptance } from "@/lib/physics/boltzmann"
import { GravitationalWavesService } from "@/lib/physics/gravitational-waves.service"
import { PhysicsService } from "@/lib/physics/physics.service"
import {
  SpacetimeService,
  GravitationalWaveService,
} from "@/lib/physics/spacetime"

const { G, c, M_sun, R_earth } = PHYSICS_CONSTANTS

function body(pos: [number, number, number], mass: number): CelestialBody {
  return {
    position: new Vector3(...pos),
    velocity: new Vector3(),
    mass,
    radius: 1,
  }
}

describe("PHYSICS_CONSTANTS", () => {
  it("uses current CODATA values", () => {
    expect(G).toBeCloseTo(6.6743e-11, 4)
    expect(c).toBe(299792458)
    expect(M_sun).toBeCloseTo(1.989e30, 0)
  })
})

describe("gravity — Newtonian gravity", () => {
  it("calculateGravitationalForce follows F = G m1 m2 / r^2", () => {
    const b1 = body([0, 0, 0], 1e10)
    const b2 = body([100, 0, 0], 2e10)
    const f = calculateGravitationalForce(b1, b2)
    const expected = (G * 1e10 * 2e10) / 100 ** 2
    expect(f.length()).toBeCloseTo(expected, 6)
    // Force on body1 points toward body2 (positive x).
    expect(f.x).toBeGreaterThan(0)
    expect(Math.abs(f.y)).toBeCloseTo(0, 10)
    expect(Math.abs(f.z)).toBeCloseTo(0, 10)
  })

  it("returns zero force below the softening threshold", () => {
    const b1 = body([0, 0, 0], 1)
    const b2 = body([0.0005, 0, 0], 1)
    expect(calculateGravitationalForce(b1, b2).length()).toBe(0)
  })

  it("calculateGravitationalAcceleration computes a = F / m", () => {
    const b = body([0, 0, 0], 5)
    const f = new Vector3(10, 0, 0)
    const a = calculateGravitationalAcceleration(b, f)
    expect(a.x).toBeCloseTo(2, 10)
  })

  it("rejects invalid masses, radii, and non-finite coordinates", () => {
    expect(() =>
      calculateGravitationalAcceleration(
        body([0, 0, 0], 0),
        new Vector3(1, 0, 0)
      )
    ).toThrow()
    expect(() => escapeVelocity(1, 0)).toThrow()
    expect(() =>
      calculateGravitationalForce(body([NaN, 0, 0], 1), body([1, 0, 0], 1))
    ).toThrow()
  })

  it("schwarzschildRadius matches the Sun (~2954 m)", () => {
    const rs = schwarzschildRadius(M_sun)
    expect(rs).toBeCloseTo(2954, -2)
  })

  it("escapeVelocity matches Earth's (~11.2 km/s)", () => {
    const v = escapeVelocity(5.972e24, R_earth)
    expect(v).toBeCloseTo(11186, -2)
  })
})

describe("gravity — visualization helpers", () => {
  it("calculateBinarySystem is symmetric under mass swap and negative at the centre well", () => {
    const phase = 0
    const v = calculateBinarySystem(1, 0, 2, 5, 5, phase)
    const vSwap = calculateBinarySystem(-1, 0, 5, 2, 5, phase)
    expect(v).toBeCloseTo(vSwap, 10)
    // Potential is negative (a well).
    expect(v).toBeLessThan(0)
  })

  it("calculates barycentric radii and positions for unequal masses", () => {
    const mass1 = 2
    const mass2 = 6
    const separation = 8
    const radii = calculateBarycentricRadii(mass1, mass2, separation)
    const positions = calculateBarycentricPositions(mass1, mass2, separation, 0)

    expect(radii.body1).toBeCloseTo(6, 10)
    expect(radii.body2).toBeCloseTo(2, 10)
    expect(mass1 * positions.body1.x + mass2 * positions.body2.x).toBeCloseTo(
      0,
      10
    )
    expect(positions.body1.x - positions.body2.x).toBeCloseTo(separation, 10)
  })

  it("converts frequency in Hz to angular phase", () => {
    expect(calculateAngularPhase(0.25, 1)).toBeCloseTo(Math.PI / 2, 10)
  })

  it("rejects invalid binary-orbit inputs", () => {
    expect(() => calculateAngularPhase(NaN, 1)).toThrow()
    expect(() => calculateAngularPhase(0, -1)).toThrow()
    expect(() => calculateBarycentricRadii(0, 1, 1)).toThrow()
    expect(() => calculateBarycentricRadii(1, 1, Infinity)).toThrow()
    expect(() => calculateBarycentricPositions(1, 1, 1, Infinity)).toThrow()
  })

  it("keeps compatibility aliases for visualization proxies", () => {
    expect(calculateBinarySystem(1, 2, 3, 4, 5, 0)).toBe(
      calculateBinaryPotentialProxy(1, 2, 3, 4, 5, 0)
    )
    expect(calculateSpacetimeCurvatureSimple(1, 2, 3)).toBe(
      calculatePotentialWellProxy(1, 2, 3)
    )
  })

  it("calculateSpacetimeCurvatureSimple falls off with distance and is negative", () => {
    const near = calculateSpacetimeCurvatureSimple(1, 0, 1)
    const far = calculateSpacetimeCurvatureSimple(10, 0, 1)
    expect(near).toBeLessThan(0)
    expect(Math.abs(far)).toBeLessThan(Math.abs(near))
  })
})

describe("gravitational — gravitational waves", () => {
  const baseSource: WaveSource = {
    position: new Vector3(0, 0, 0),
    mass1: 1.4 * M_sun,
    mass2: 1.4 * M_sun,
    orbitalRadius: 1e6,
    orbitalFrequency: 100,
  }

  it("uses the circular-binary quadrupole formula", () => {
    const r = 1e20
    const orbitalFrequency = 100
    const h0 = calculateGravitationalWaveAmplitude(
      { ...baseSource, orbitalFrequency },
      new Vector3(r, 0, 0),
      0
    )
    const reducedMass = baseSource.mass1 / 2
    const expected =
      (4 *
        G *
        reducedMass *
        baseSource.orbitalRadius ** 2 *
        (2 * Math.PI * orbitalFrequency) ** 2) /
      (c ** 4 * r)
    expect(h0 / expected).toBeCloseTo(1, 10)
  })

  it("amplitude scales as 1 / distance", () => {
    const r1 = 1e20
    const r2 = 2e20
    const h1 = Math.abs(
      calculateGravitationalWaveAmplitude(baseSource, new Vector3(r1, 0, 0), 0)
    )
    const h2 = Math.abs(
      calculateGravitationalWaveAmplitude(baseSource, new Vector3(r2, 0, 0), 0)
    )
    expect(h1 / h2).toBeCloseTo(2, 6)
  })

  it("amplitude oscillates at twice the orbital frequency", () => {
    const f = baseSource.orbitalFrequency
    const observer = new Vector3(1e20, 0, 0)
    const h0 = calculateGravitationalWaveAmplitude(baseSource, observer, 0)
    const hQuarterWave = calculateGravitationalWaveAmplitude(
      baseSource,
      observer,
      1 / (8 * f)
    )
    const hQuarterOrbit = calculateGravitationalWaveAmplitude(
      baseSource,
      observer,
      1 / (4 * f)
    )
    // cos(0) = 1, cos(pi/2) = 0.
    expect(Math.abs(h0)).toBeGreaterThan(0)
    expect(Math.abs(hQuarterWave)).toBeCloseTo(0, 6)
    expect(hQuarterOrbit / h0).toBeCloseTo(-1, 6)
  })

  it("calculateStrainTensor builds plus and cross polarizations", () => {
    const plus = calculateStrainTensor(1, "plus")
    const cross = calculateStrainTensor(1, "cross")
    expect(plus[0][0]).toBe(1)
    expect(plus[1][1]).toBe(-1)
    expect(cross[0][1]).toBe(1)
    expect(cross[1][0]).toBe(1)
  })

  it("rejects coincident observers and invalid source parameters", () => {
    expect(() =>
      calculateGravitationalWaveAmplitude(baseSource, baseSource.position, 0)
    ).toThrow()
    expect(() =>
      calculateGravitationalWaveAmplitude(
        { ...baseSource, mass1: Infinity },
        new Vector3(1, 0, 0),
        0
      )
    ).toThrow()
    expect(() => calculateStrainTensor(NaN, "plus")).toThrow()
    expect(() =>
      calculateGravitationalWaveAmplitude(
        { ...baseSource, orbitalRadius: 0 },
        new Vector3(1, 0, 0),
        0
      )
    ).toThrow()
  })

  it("uses binary separation in the quadrupole amplitude", () => {
    const observer = new Vector3(1e20, 0, 0)
    const first = calculateGravitationalWaveAmplitude(baseSource, observer, 0)
    const doubled = calculateGravitationalWaveAmplitude(
      { ...baseSource, orbitalRadius: baseSource.orbitalRadius * 2 },
      observer,
      0
    )
    expect(doubled / first).toBeCloseTo(4, 8)
  })
})

describe("GravitationalWavesService", () => {
  it("rejects singular and non-finite inputs", () => {
    expect(() =>
      GravitationalWavesService.calculateWaveAmplitude(1, 1, 0, 1)
    ).toThrow()
    expect(() =>
      GravitationalWavesService.calculateFrequency(1, 1, Infinity)
    ).toThrow()
    expect(() =>
      GravitationalWavesService.calculateFrequency(1, 1, 0)
    ).toThrow()
  })

  it("calculateFrequency follows Kepler's third law f = sqrt(GM/a^3) / (2 pi)", () => {
    const f = GravitationalWavesService.calculateFrequency(M_sun, M_sun, 1e9)
    const expected = Math.sqrt((G * (2 * M_sun)) / 1e9 ** 3) / (2 * Math.PI)
    expect(f).toBeCloseTo(expected, 8)
  })

  it("strain amplitude scales as 1 / distance and as M_c^(5/3)", () => {
    const a1 = GravitationalWavesService.calculateStrainAmplitude(
      1.4 * M_sun,
      1.4 * M_sun,
      1e20,
      100
    )
    const a2 = GravitationalWavesService.calculateStrainAmplitude(
      1.4 * M_sun,
      1.4 * M_sun,
      2e20,
      100
    )
    expect(a1 / a2).toBeCloseTo(2, 6)

    // Double the chirp mass (equal-mass doubling) -> amplitude grows by 2^(5/3).
    const aSingle = GravitationalWavesService.calculateStrainAmplitude(
      M_sun,
      M_sun,
      1e20,
      100
    )
    const aDouble = GravitationalWavesService.calculateStrainAmplitude(
      2 * M_sun,
      2 * M_sun,
      1e20,
      100
    )
    // M_c scales linearly with mass for fixed mass ratio, so ratio = 2^(5/3).
    expect(aDouble / aSingle).toBeCloseTo(Math.pow(2, 5 / 3), 6)
  })

  it("avoids intermediate overflow for extreme finite masses", () => {
    const amplitude = GravitationalWavesService.calculateWaveAmplitude(
      1e200,
      2e200,
      1e250,
      1e-100
    )
    const frequency = GravitationalWavesService.calculateFrequency(
      1e300,
      1e300,
      1e150
    )
    expect(amplitude).toBeGreaterThan(0)
    expect(amplitude).toBeLessThan(Infinity)
    expect(frequency).toBeGreaterThan(0)
    expect(frequency).toBeLessThan(Infinity)
  })
})

describe("PhysicsService", () => {
  it("rejects singular and invalid public API inputs", () => {
    expect(() => PhysicsService.calculateGravitationalForce(1, 1, 0)).toThrow()
    expect(() => PhysicsService.calculateOrbitalVelocity(1, 0)).toThrow()
    expect(() =>
      PhysicsService.calculateSpacetimeCurvature(
        1,
        new Vector3(),
        new Vector3()
      )
    ).toThrow()
    expect(() => PhysicsService.schwarzschildRadius(NaN)).toThrow()
  })

  it("computes Newtonian force, orbital & escape velocities, Schwarzschild radius", () => {
    expect(PhysicsService.calculateGravitationalForce(1, 1, 1)).toBeCloseTo(
      G,
      10
    )
    expect(PhysicsService.calculateOrbitalVelocity(M_sun, 1e9)).toBeCloseTo(
      Math.sqrt((G * M_sun) / 1e9),
      8
    )
    expect(PhysicsService.calculateEscapeVelocity(M_sun, 1e9)).toBeCloseTo(
      Math.sqrt((2 * G * M_sun) / 1e9),
      8
    )
    expect(PhysicsService.schwarzschildRadius(M_sun)).toBeCloseTo(2954, -2)
  })

  it("spacetime curvature is the Newtonian potential -rs / (2r)", () => {
    const k = PhysicsService.calculateSpacetimeCurvature(
      M_sun,
      new Vector3(1e9, 0, 0),
      new Vector3(0, 0, 0)
    )
    const rs = PhysicsService.schwarzschildRadius(M_sun)
    expect(k).toBeCloseTo(-rs / (2 * 1e9), 10)
  })
})

describe("SpacetimeService", () => {
  it("throws inside the Schwarzschild radius and builds the metric outside", () => {
    const rs = SpacetimeService.schwarzschildRadius(M_sun)
    expect(() =>
      SpacetimeService.calculateMetricTensor(new Vector3(rs / 2, 0, 0), M_sun)
    ).toThrow()
    const m = SpacetimeService.calculateMetricTensor(
      new Vector3(10 * rs, 0, 0),
      M_sun
    )
    expect(m.elements[0]).toBeCloseTo(-(1 - rs / (10 * rs)), 10) // g_tt
    expect(m.elements[5]).toBeCloseTo(1 / (1 - rs / (10 * rs)), 10) // g_rr
  })

  it("uses the Cartesian position to derive Schwarzschild angular terms", () => {
    const rs = SpacetimeService.schwarzschildRadius(M_sun)
    const r = 10 * rs
    const equatorMetric = SpacetimeService.calculateMetricTensor(
      new Vector3(r, 0, 0),
      M_sun
    )
    const polarAxisMetric = SpacetimeService.calculateMetricTensor(
      new Vector3(0, 0, r),
      M_sun
    )

    expect(equatorMetric.elements[10]).toBeCloseTo(r ** 2, 6) // g_theta_theta
    expect(equatorMetric.elements[15]).toBeCloseTo(r ** 2, 6) // g_phi_phi at theta = pi/2
    expect(polarAxisMetric.elements[15]).toBeCloseTo(0, 10) // g_phi_phi at theta = 0
  })

  it("time dilation -> 0 at the horizon and -> 1 far away", () => {
    const rs = SpacetimeService.schwarzschildRadius(M_sun)
    expect(SpacetimeService.calculateTimeDilation(rs, M_sun)).toBe(0)
    expect(SpacetimeService.calculateTimeDilation(rs / 2, M_sun)).toBe(0)
    expect(SpacetimeService.calculateTimeDilation(rs * 1.1, M_sun)).toBeCloseTo(
      Math.sqrt(1 - 1 / 1.1),
      6
    )
    expect(SpacetimeService.calculateTimeDilation(1e12, M_sun)).toBeCloseTo(
      1,
      4
    )
  })

  it("orbital velocity is sqrt(GM/r)", () => {
    expect(SpacetimeService.calculateOrbitalVelocity(1e9, M_sun)).toBeCloseTo(
      Math.sqrt((G * M_sun) / 1e9),
      8
    )
  })

  it("keeps Christoffel lower indices symmetric", () => {
    const rs = SpacetimeService.schwarzschildRadius(M_sun)
    const symbols = SpacetimeService.calculateChristoffelSymbols(
      new Vector3(10 * rs, 0, 0),
      M_sun
    )

    expect(symbols[0][1][0]).toBeCloseTo(symbols[0][0][1], 10)
  })

  it("names the intentionally partial Christoffel API explicitly", () => {
    const position = new Vector3(1e6, 2e6, 3e6)
    const partial = SpacetimeService.calculatePartialChristoffelSymbols(
      position,
      1
    )
    expect(SpacetimeService.calculateChristoffelSymbols(position, 1)).toEqual(
      partial
    )
    expect(partial.flat(2).filter((value) => value !== 0)).toHaveLength(3)
  })

  it("curvature proxy scales as M / r^3", () => {
    const near = SpacetimeService.calculateCurvatureProxy(1, 0, 1)
    const far = SpacetimeService.calculateCurvatureProxy(2, 0, 1)
    expect(near / far).toBeCloseTo(8, 6) // 1/r^3 -> 2x distance = 1/8
    expect(SpacetimeService.calculateRicciScalar(1, 0, 1)).toBe(near)
  })

  it("rejects singular and non-finite spacetime inputs", () => {
    const rs = SpacetimeService.schwarzschildRadius(M_sun)
    expect(() =>
      SpacetimeService.calculateChristoffelSymbols(new Vector3(rs, 0, 0), M_sun)
    ).toThrow()
    expect(() =>
      SpacetimeService.calculateSpacetimeCurvature(new Vector3(), M_sun)
    ).toThrow()
    expect(() => SpacetimeService.calculateTimeDilation(NaN, M_sun)).toThrow()
    expect(() =>
      GravitationalWaveService.calculateWaveDistortion(0, 0, 0, 1, Infinity)
    ).toThrow()
  })

  it("wave distortion is zero for zero amplitude and oscillates otherwise", () => {
    expect(
      GravitationalWaveService.calculateWaveDistortion(1, 0, 0, 0, 1)
    ).toBe(0)
    const a = GravitationalWaveService.calculateWaveDistortion(1, 0, 0, 1, 1)
    const b = GravitationalWaveService.calculateWaveDistortion(
      1,
      0,
      Math.PI / 2,
      1,
      1
    )
    expect(a).not.toBeCloseTo(b, 6)
  })

  it("interprets gravitational wave frequency as cycles per second", () => {
    const initial = GravitationalWaveService.calculateWaveDistortion(
      0,
      0,
      0,
      1,
      2
    )
    const quarterCycle = GravitationalWaveService.calculateWaveDistortion(
      0,
      0,
      1 / 8,
      1,
      2
    )

    expect(initial).toBeCloseTo(1, 10)
    expect(quarterCycle).toBeCloseTo(0, 10)
  })
})

describe("Boltzmann sampling helpers", () => {
  it("calculates bounded Metropolis acceptance with density-of-states weighting", () => {
    const lowerEnergyWithLowerDensity = calculateBoltzmannAcceptance(
      0.1,
      0.001,
      100
    )
    const highTemperatureUphill = calculateBoltzmannAcceptance(1, 2, 5)
    const lowTemperatureUphill = calculateBoltzmannAcceptance(1, 2, 0.5)

    expect(lowerEnergyWithLowerDensity).toBeGreaterThan(0)
    expect(lowerEnergyWithLowerDensity).toBeLessThan(1)
    expect(highTemperatureUphill).toBeGreaterThan(lowTemperatureUphill)
    expect(highTemperatureUphill).toBeLessThanOrEqual(1)
  })

  it("handles exact zero-energy density without epsilon bias", () => {
    expect(calculateBoltzmannAcceptance(0, 0, 1)).toBe(1)
    expect(calculateBoltzmannAcceptance(0, 1, 1)).toBe(1)
    expect(calculateBoltzmannAcceptance(1, 0, 1)).toBe(0)
  })

  it("rejects non-positive temperatures", () => {
    expect(() => calculateBoltzmannAcceptance(1, 1, 0)).toThrow()
  })

  it("rejects invalid energies and non-finite values", () => {
    expect(() => calculateBoltzmannAcceptance(-1, 1, 1)).toThrow()
    expect(() => calculateBoltzmannAcceptance(1, Infinity, 1)).toThrow()
    expect(() => calculateBoltzmannAcceptance(1, 1, NaN)).toThrow()
  })
})
