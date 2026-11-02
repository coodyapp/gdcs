import { describe, expect, it } from "vite-plus/test"

import {
  criticalAngle,
  f0FromIor,
  fresnel,
  metalRoughF0,
  reflect,
  refract,
  schlick,
  snell,
  type V3,
} from "./optics"

const deg = Math.PI / 180
const N: V3 = [0, 1, 0]
/** Unit ray travelling down-right at angle θ from the normal. */
const incident = (theta: number): V3 => [Math.sin(theta), -Math.cos(theta), 0]

describe("reflect", () => {
  it("is mirror-symmetric about the normal", () => {
    for (const t of [0, 10, 35, 60, 89]) {
      const I = incident(t * deg)
      const R = reflect(I, N)
      expect(R[0]).toBeCloseTo(I[0], 12) // tangential part kept
      expect(R[1]).toBeCloseTo(-I[1], 12) // normal part flipped
      expect(Math.hypot(...R)).toBeCloseTo(1, 12)
      const back = reflect(R, N)
      back.forEach((x, i) => expect(x).toBeCloseTo(I[i], 12))
    }
  })
})

describe("refract and Snell", () => {
  it("refract() bends by exactly Snell's angle", () => {
    for (const [n1, n2] of [
      [1, 1.5],
      [1, 1.33],
      [1.5, 1],
      [2.4, 1.5],
    ]) {
      for (const t of [0, 15, 30, 40]) {
        const T = refract(incident(t * deg), N, n1 / n2)
        const theta2 = snell(t * deg, n1, n2)
        if (theta2 === null) {
          expect(T).toBeNull()
          continue
        }
        expect(T).not.toBeNull()
        expect(Math.hypot(...T!)).toBeCloseTo(1, 12)
        expect(Math.asin(T![0])).toBeCloseTo(theta2, 9)
        expect(T![1]).toBeLessThan(0) // keeps travelling into medium 2
      }
    }
  })

  it("has total internal reflection above the critical angle", () => {
    const c = criticalAngle(1.5, 1)!
    expect(c).toBeCloseTo(Math.asin(1 / 1.5), 12)
    expect(snell(c - 0.01, 1.5, 1)).not.toBeNull()
    expect(snell(c + 0.01, 1.5, 1)).toBeNull()
    expect(refract(incident(c + 0.01), N, 1.5)).toBeNull()
    expect(refract(incident(c - 0.01), N, 1.5)).not.toBeNull()
    expect(fresnel(c + 0.01, 1.5, 1)).toBe(1)
    expect(criticalAngle(1, 1.5)).toBeNull()
  })
})

describe("Fresnel", () => {
  it("Schlick equals F0 head-on and tends to 1 at grazing angles", () => {
    for (const f0 of [0.02, 0.04, 0.5, 0.95]) {
      expect(schlick(1, f0)).toBeCloseTo(f0, 12)
      expect(schlick(Math.cos(90 * deg), f0)).toBeCloseTo(1, 12)
      expect(schlick(Math.cos(60 * deg), f0)).toBeGreaterThan(f0)
    }
  })

  it("glass F0 is about 4%", () => {
    expect(f0FromIor(1.5)).toBeCloseTo(0.04, 12)
    expect(fresnel(0, 1, 1.5)).toBeCloseTo(0.04, 12)
  })

  it("metal/rough F0 is 0.04 for dielectrics and the base colour for metals", () => {
    expect(metalRoughF0([0.9, 0.6, 0.2], 0)).toEqual([0.04, 0.04, 0.04])
    const m = metalRoughF0([0.9, 0.6, 0.2], 1)
    ;[0.9, 0.6, 0.2].forEach((x, i) => expect(m[i]).toBeCloseTo(x, 12))
  })
})
