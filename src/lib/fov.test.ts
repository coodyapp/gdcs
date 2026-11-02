import { describe, expect, it } from "vite-plus/test"

import {
  buildFanIndices,
  castFan,
  castRay,
  type Cast,
  cosHalfAngle,
  fanArea,
  fanCapacity,
  fanIndexCount,
  findEdge,
  inViewCone,
  lineOfSight,
  makeEdge,
  makeHit,
  type Obstacle,
  writeFanPositions,
} from "./fov"

const rad = (d: number) => (d * Math.PI) / 180
const O = { x: 0, y: 0 }
const FWD = { x: 1, y: 0 }

describe("inViewCone", () => {
  const cosHalf = cosHalfAngle(rad(90)) // ±45°

  it("includes targets exactly on the angle and radius boundaries", () => {
    const r = 5
    const onEdge = { x: Math.cos(rad(45)) * 3, y: Math.sin(rad(45)) * 3 }
    expect(inViewCone(O, FWD, onEdge, r, cosHalf)).toBe(true)
    expect(inViewCone(O, FWD, { x: 5, y: 0 }, r, cosHalf)).toBe(true)
  })

  it("rejects targets just outside angle or radius, and behind", () => {
    const out = { x: Math.cos(rad(45.5)) * 3, y: Math.sin(rad(45.5)) * 3 }
    expect(inViewCone(O, FWD, out, 5, cosHalf)).toBe(false)
    expect(inViewCone(O, FWD, { x: 5.01, y: 0 }, 5, cosHalf)).toBe(false)
    expect(inViewCone(O, FWD, { x: -1, y: 0 }, 5, cosHalf)).toBe(false)
  })

  it("handles a 360° view and a target on the eye", () => {
    expect(inViewCone(O, FWD, { x: -2, y: 0 }, 5, cosHalfAngle(rad(360)))).toBe(
      true
    )
    expect(inViewCone(O, FWD, O, 5, cosHalf)).toBe(true)
  })
})

describe("occlusion", () => {
  const walls: Obstacle[] = [{ kind: "box", x: 2, y: 0, hx: 0.25, hy: 1 }]

  it("blocks line of sight behind a wall and reports the hit point", () => {
    const hit = makeHit()
    expect(lineOfSight(walls, O, { x: 4, y: 0 }, hit)).toBe(false)
    expect(hit.id).toBe(0)
    expect(hit.x).toBeCloseTo(1.75)
  })

  it("is clear in front of the wall and around it", () => {
    const hit = makeHit()
    expect(lineOfSight(walls, O, { x: 1.5, y: 0 }, hit)).toBe(true)
    expect(lineOfSight(walls, O, { x: 4, y: 3 }, hit)).toBe(true)
  })

  it("hits circles at the near surface", () => {
    const hit = castRay(
      [{ kind: "circle", x: 3, y: 0, r: 1 }],
      O,
      0,
      10,
      makeHit()
    )
    expect(hit.dist).toBeCloseTo(2)
  })
})

describe("fan geometry", () => {
  it("has points + 1 vertices and 3·(points − 1) indices", () => {
    const idx = buildFanIndices(5)
    expect(idx.length).toBe(fanIndexCount(5))
    expect(Array.from(idx)).toEqual([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5])
    const pts = new Float32Array([1, 0, 0, 1, -1, 0, 0, -1, 1, 0])
    const pos = new Float32Array(6 * 3)
    expect(writeFanPositions(O, pts, 5, 0.1, pos)).toBe(6)
    expect(pos[1]).toBeCloseTo(0.1)
    expect(pos[5]).toBe(0) // first rim point's z = its y
  })

  it("casts exactly `rays` points in open space with no refinement", () => {
    const cast: Cast = (a, out) => castRay([], O, a, 5, out)
    const out = new Float32Array(fanCapacity(12) * 2)
    const r = castFan(cast, 0, rad(90), 12, 4, 0.5, out, {
      count: 0,
      rays: 0,
      refineCasts: 0,
    })
    expect(r.count).toBe(12)
    expect(r.refineCasts).toBe(0)
    // Ends on the cone edges at full radius.
    expect(Math.hypot(out[0], out[1])).toBeCloseTo(5)
    expect(Math.atan2(out[1], out[0])).toBeCloseTo(rad(-45))
  })
})

describe("edge refinement", () => {
  // A box whose top edge silhouette sits at angle atan2(1, 2) from the origin.
  const box: Obstacle[] = [{ kind: "box", x: 2.5, y: 0, hx: 0.5, hy: 1 }]
  const R = 6
  const cast: Cast = (a, out) => castRay(box, O, a, R, out)
  const silhouette = Math.atan2(1, 2)

  it("brackets the silhouette within gap / 2^iterations", () => {
    const a = rad(20)
    const b = rad(35)
    const edge = findEdge(
      cast,
      a,
      cast(a, makeHit()),
      b,
      cast(b, makeHit()),
      8,
      0.5,
      makeEdge()
    )
    expect(edge.casts).toBe(8)
    expect(edge.aAngle).toBeLessThanOrEqual(silhouette + 1e-9)
    expect(edge.bAngle).toBeGreaterThanOrEqual(silhouette - 1e-9)
    expect(edge.bAngle - edge.aAngle).toBeCloseTo((b - a) / 256, 10)
    expect(edge.a.id).toBe(0)
    expect(edge.b.id).toBe(-1)
  })

  it("reduces the area error versus plain rays", () => {
    const fan = (rays: number, iterations: number) => {
      const out = new Float32Array(fanCapacity(rays) * 2)
      const r = castFan(cast, 0, rad(100), rays, iterations, 0.5, out, {
        count: 0,
        rays: 0,
        refineCasts: 0,
      })
      return { area: fanArea(O, out, r.count), r }
    }
    const truth = fan(20000, 0).area
    const plain = fan(12, 0)
    const refined = fan(12, 6)
    const errPlain = Math.abs(plain.area - truth)
    const errRefined = Math.abs(refined.area - truth)
    expect(refined.r.refineCasts).toBe(2 * 6) // two silhouette edges
    expect(refined.r.count).toBe(12 + 4)
    expect(errRefined).toBeLessThan(errPlain / 4)
  })
})
