import { describe, expect, it } from "vite-plus/test"

import {
  arcLengthTable,
  bernstein,
  cubicPoint,
  cubicTangent,
  deCasteljau,
  tAtDistance,
  type Vec,
  type XYZ,
} from "./bezier"

const P: Vec[] = [
  [-4, 0, 1.5],
  [-3.6, 0, -1.2],
  [3.5, 0, -3],
  [4, 0, 2],
]
const xyz = ([x, y, z]: Vec): XYZ => ({ x, y, z })
const [p0, p1, p2, p3] = P.map(xyz)
const sample = (t: number, out: XYZ) => cubicPoint(p0, p1, p2, p3, t, out)
const o = () => ({ x: 0, y: 0, z: 0 })

describe("bezier", () => {
  it("de Casteljau equals the Bernstein form (quadratic and cubic)", () => {
    for (const pts of [P, P.slice(0, 3)])
      for (let i = 0; i <= 10; i++) {
        const t = i / 10
        const a = deCasteljau(pts, t).point
        const b = bernstein(pts, t)
        a.forEach((x, d) => expect(x).toBeCloseTo(b[d], 10))
      }
  })

  it("cubicPoint matches Bernstein and hits the endpoints", () => {
    const m = cubicPoint(p0, p1, p2, p3, 0.37, o())
    const b = bernstein(P, 0.37)
    expect([m.x, m.y, m.z]).toEqual(b.map((x) => expect.closeTo(x, 10)))
    expect(cubicPoint(p0, p1, p2, p3, 0, o())).toEqual(p0)
    expect(cubicPoint(p0, p1, p2, p3, 1, o())).toEqual(p3)
  })

  it("has one fewer point per construction level", () => {
    const { levels } = deCasteljau(P, 0.5)
    expect(levels.map((l) => l.length)).toEqual([4, 3, 2, 1])
  })

  it("end tangents point along the control polygon (3·(P1−P0))", () => {
    const t0 = cubicTangent(p0, p1, p2, p3, 0, o())
    expect(t0.x).toBeCloseTo(3 * (p1.x - p0.x))
    expect(t0.z).toBeCloseTo(3 * (p1.z - p0.z))
    // Numerical derivative check mid-curve.
    const h = 1e-5
    const a = sample(0.5 - h, o())
    const b = sample(0.5 + h, o())
    const d = cubicTangent(p0, p1, p2, p3, 0.5, o())
    expect(d.x).toBeCloseTo((b.x - a.x) / (2 * h), 4)
    expect(d.z).toBeCloseTo((b.z - a.z) / (2 * h), 4)
  })

  it("arc-length table is monotonic and inverts back", () => {
    const table = arcLengthTable(sample, 128)
    for (let i = 1; i < table.length; i++)
      expect(table[i]).toBeGreaterThan(table[i - 1])
    expect(tAtDistance(table, 0)).toBe(0)
    expect(tAtDistance(table, table[128])).toBe(1)
    expect(tAtDistance(table, table[40])).toBeCloseTo(40 / 128, 10)
  })

  it("equal-distance samples are evenly spaced; equal-t samples are not", () => {
    const table = arcLengthTable(sample, 256)
    const total = table[256]
    const k = 20
    const chord = (ts: number[]) =>
      ts.slice(1).map((t, i) => {
        const a = sample(ts[i], o())
        const b = sample(t, o())
        return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
      })
    const even = chord(
      Array.from({ length: k + 1 }, (_, i) =>
        tAtDistance(table, (total * i) / k)
      )
    )
    const naive = chord(Array.from({ length: k + 1 }, (_, i) => i / k))
    const spread = (xs: number[]) => Math.max(...xs) / Math.min(...xs)
    expect(spread(even)).toBeLessThan(1.02)
    expect(spread(naive)).toBeGreaterThan(1.3)
  })
})
