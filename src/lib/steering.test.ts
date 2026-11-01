import { describe, expect, it } from "vite-plus/test"

import { type Agent, arrive, integrate, seek, separation } from "./steering"

const run = (behaviour: "seek" | "arrive", seconds = 10) => {
  const a: Agent = { pos: { x: 10, y: 3 }, vel: { x: 0, y: 0 } }
  const target = { x: 0, y: 0 }
  const f = { x: 0, y: 0 }
  const dt = 1 / 60
  let speedNear = -1 // speed the first time the agent gets within 0.5 units
  for (let i = 0; i < seconds * 60; i++) {
    if (behaviour === "seek") seek(a, target, 4, f)
    else arrive(a, target, 4, 2.5, f)
    integrate(a, f, 12, 4, dt)
    if (speedNear < 0 && Math.hypot(a.pos.x, a.pos.y) < 0.5)
      speedNear = Math.hypot(a.vel.x, a.vel.y)
  }
  return {
    dist: Math.hypot(a.pos.x, a.pos.y),
    speed: Math.hypot(a.vel.x, a.vel.y),
    speedNear,
  }
}

describe("steering", () => {
  it("arrive stops within a small radius of the target", () => {
    const { dist, speed } = run("arrive")
    expect(dist).toBeLessThan(0.05)
    expect(speed).toBeLessThan(0.05)
  })

  it("seek hits the target at full speed while arrive has slowed down", () => {
    // Seek always wants max speed, so it overshoots; arrive ramps down inside the slow radius.
    expect(run("seek").speedNear).toBeGreaterThan(3.5)
    expect(run("arrive").speedNear).toBeLessThan(2)
  })

  it("seek steering is desired minus current velocity", () => {
    const a: Agent = { pos: { x: 0, y: 0 }, vel: { x: 1, y: 0 } }
    const f = seek(a, { x: 0, y: 5 }, 2, { x: 0, y: 0 }, 1)
    expect(f.x).toBeCloseTo(-1)
    expect(f.y).toBeCloseTo(2)
  })

  it("separation pushes neighbours apart and ignores far ones", () => {
    const agents: Agent[] = [
      { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } },
      { pos: { x: 0.5, y: 0 }, vel: { x: 0, y: 0 } },
      { pos: { x: 9, y: 0 }, vel: { x: 0, y: 0 } },
    ]
    const f = separation(0, agents, 1, { x: 0, y: 0 })
    expect(f.x).toBeCloseTo(-2) // 1/0.5 away from the close neighbour
    expect(f.y).toBe(0)
  })
})
