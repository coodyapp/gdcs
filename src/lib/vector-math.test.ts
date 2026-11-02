import { describe, expect, it } from "vite-plus/test"

import {
  add,
  aimAngle,
  angleBetween,
  angleDelta,
  cross,
  degToRad,
  distance,
  dot,
  length,
  lengthSq,
  normalize,
  onCircle,
  parallelogramArea,
  project,
  radToDeg,
  scale,
  sub,
  wrapAngle,
  type V3,
} from "./vector-math"

const a: V3 = [3, 4, 0]
const b: V3 = [-2, 1, 5]

describe("vector basics", () => {
  it("adds, subtracts and scales component-wise", () => {
    expect(add(a, b)).toEqual([1, 5, 5])
    expect(sub(a, b)).toEqual([5, 3, -5])
    expect(scale(a, 2)).toEqual([6, 8, 0])
  })

  it("measures length, squared length and distance", () => {
    expect(length(a)).toBe(5)
    expect(lengthSq(a)).toBe(25)
    expect(distance([1, 1, 1], [1, 1, 4])).toBe(3)
  })

  it("normalizes to length 1", () => {
    for (const v of [a, b, [0, 0, -7] as V3, [1e-6, 2e-6, 0] as V3])
      expect(length(normalize(v))).toBeCloseTo(1, 10)
  })

  it("keeps the zero vector safe (no NaN)", () => {
    expect(normalize([0, 0, 0])).toEqual([0, 0, 0])
    expect(angleBetween([0, 0, 0], a)).toBe(0)
    expect(project(a, [0, 0, 0])).toEqual([0, 0, 0])
  })
})

describe("dot and cross", () => {
  it("dot is commutative and |a|² with itself", () => {
    expect(dot(a, b)).toBe(dot(b, a))
    expect(dot(a, a)).toBe(lengthSq(a))
  })

  it("dot = |a||b|cos θ", () => {
    const theta = angleBetween(a, b)
    expect(dot(a, b)).toBeCloseTo(length(a) * length(b) * Math.cos(theta), 10)
    expect(angleBetween([1, 0, 0], [0, 1, 0])).toBeCloseTo(Math.PI / 2, 10)
  })

  it("cross is perpendicular to both inputs and anti-commutative", () => {
    const c = cross(a, b)
    expect(dot(c, a)).toBeCloseTo(0, 10)
    expect(dot(c, b)).toBeCloseTo(0, 10)
    expect(cross(b, a)).toEqual(scale(c, -1))
  })

  it("follows the right-hand rule: x × y = z", () => {
    expect(cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1])
  })

  it("|a × b| = |a||b| sin θ = parallelogram area", () => {
    const theta = angleBetween(a, b)
    expect(parallelogramArea(a, b)).toBeCloseTo(
      length(a) * length(b) * Math.sin(theta),
      10
    )
    expect(parallelogramArea([2, 0, 0], [0, 3, 0])).toBe(6)
    expect(parallelogramArea(a, scale(a, -2))).toBe(0)
  })

  it("projection leaves a perpendicular remainder", () => {
    const p = project(a, b)
    expect(dot(sub(a, p), b)).toBeCloseTo(0, 10)
  })
})

describe("angles", () => {
  it("converts degrees and radians both ways", () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI, 12)
    expect(radToDeg(Math.PI / 2)).toBeCloseTo(90, 12)
    expect(radToDeg(degToRad(37))).toBeCloseTo(37, 12)
  })

  it("aimAngle returns the right quadrant for all four", () => {
    const o: [number, number] = [0, 0]
    expect(radToDeg(aimAngle(o, [1, 1]))).toBeCloseTo(45, 10)
    expect(radToDeg(aimAngle(o, [-1, 1]))).toBeCloseTo(135, 10)
    expect(radToDeg(aimAngle(o, [-1, -1]))).toBeCloseTo(-135, 10)
    expect(radToDeg(aimAngle(o, [1, -1]))).toBeCloseTo(-45, 10)
    expect(radToDeg(aimAngle(o, [0, 2]))).toBeCloseTo(90, 10)
    expect(radToDeg(aimAngle([5, 5], [2, 5]))).toBeCloseTo(180, 10)
  })

  it("onCircle gives (cos θ, sin θ) on the unit circle", () => {
    const [x, y] = onCircle(degToRad(30))
    expect(x).toBeCloseTo(Math.sqrt(3) / 2, 12)
    expect(y).toBeCloseTo(0.5, 12)
    expect(Math.hypot(x, y)).toBeCloseTo(1, 12)
  })

  it("wrapAngle maps into (-π, π]", () => {
    expect(wrapAngle(0)).toBe(0)
    expect(wrapAngle(Math.PI)).toBeCloseTo(Math.PI, 12)
    expect(wrapAngle(-Math.PI)).toBeCloseTo(Math.PI, 12)
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 12)
    expect(wrapAngle(degToRad(370))).toBeCloseTo(degToRad(10), 12)
    expect(wrapAngle(degToRad(-190))).toBeCloseTo(degToRad(170), 12)
    for (let x = -20; x <= 20; x += 0.37) {
      const w = wrapAngle(x)
      expect(w).toBeGreaterThan(-Math.PI)
      expect(w).toBeLessThanOrEqual(Math.PI + 1e-12)
      expect(Math.cos(w)).toBeCloseTo(Math.cos(x), 10)
    }
  })

  it("angleDelta takes the short way round the seam", () => {
    expect(radToDeg(angleDelta(degToRad(170), degToRad(-170)))).toBeCloseTo(
      20,
      10
    )
    expect(radToDeg(angleDelta(degToRad(-170), degToRad(170)))).toBeCloseTo(
      -20,
      10
    )
  })
})
