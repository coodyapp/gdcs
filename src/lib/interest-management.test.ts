import { describe, expect, it } from "vite-plus/test"

import {
  baselineUpdates,
  bruteForceQuery,
  InterestGrid,
  InterestSim,
  isDue,
  LEAVE_RATIO,
  simulateStats,
  TICK_HZ,
  uniformShare,
  VIEWER,
  Wanderers,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./interest-management"
import { mulberry32 } from "./noise"

const sorted = (values: Iterable<number>) => [...values].sort((a, b) => a - b)

describe("InterestGrid", () => {
  it("returns exactly the brute-force set for many radii, including out-of-bounds points", () => {
    const random = mulberry32(11)
    const n = 400
    const xs = new Float64Array(n)
    const ys = new Float64Array(n)
    const out = new Int32Array(n)
    for (const radius of [0.4, 0.8, 1.6, 2.5, 5, 20]) {
      for (let i = 0; i < n; i++) {
        xs[i] = -1 + random() * (WORLD_WIDTH + 2)
        ys[i] = -1 + random() * (WORLD_HEIGHT + 2)
      }
      const grid = new InterestGrid(WORLD_WIDTH, WORLD_HEIGHT, radius, n)
      grid.build(xs, ys, n)
      for (let q = 0; q < 200; q++) {
        const x = -1 + random() * (WORLD_WIDTH + 2)
        const y = -1 + random() * (WORLD_HEIGHT + 2)
        const count = grid.query(x, y, radius, xs, ys, out)
        expect(sorted(out.subarray(0, count))).toEqual(
          bruteForceQuery(x, y, radius, xs, ys, n)
        )
      }
    }
  })

  it("includes a point exactly on the radius", () => {
    const xs = [3, 4]
    const ys = [3, 3]
    const grid = new InterestGrid(WORLD_WIDTH, WORLD_HEIGHT, 1, 2)
    grid.build(xs, ys, 2)
    const out = new Int32Array(2)
    expect(grid.query(3, 3, 1, xs, ys, out)).toBe(2)
  })

  it("scans at most 3×3 cells when cells are as wide as the radius, and far fewer points than n", () => {
    const random = mulberry32(5)
    const n = 1000
    const radius = 1.6
    const xs = Float64Array.from({ length: n }, () => random() * WORLD_WIDTH)
    const ys = Float64Array.from({ length: n }, () => random() * WORLD_HEIGHT)
    const grid = new InterestGrid(WORLD_WIDTH, WORLD_HEIGHT, radius, n)
    grid.build(xs, ys, n)
    const out = new Int32Array(n)
    let checks = 0
    let maxCells = 0
    for (let q = 0; q < 500; q++) {
      grid.query(
        random() * WORLD_WIDTH,
        random() * WORLD_HEIGHT,
        radius,
        xs,
        ys,
        out
      )
      checks += grid.checks
      maxCells = Math.max(maxCells, grid.cells)
    }
    expect(maxCells).toBeLessThanOrEqual(9)
    expect(checks / 500).toBeLessThan(n * 0.4)
  })
})

describe("Wanderers", () => {
  it("replays exactly and stays inside the world", () => {
    const n = 100
    const a = new Wanderers(n, 3)
    const b = new Wanderers(n, 3)
    const ax = new Float64Array(n)
    const ay = new Float64Array(n)
    const bx = new Float64Array(n)
    const by = new Float64Array(n)
    for (let t = 0; t < 300; t += 0.37) {
      a.write(t, ax, ay)
      b.write(t, bx, by)
      expect(bx).toEqual(ax)
      expect(by).toEqual(ay)
      for (let i = 0; i < n; i++) {
        expect(ax[i]).toBeGreaterThanOrEqual(0)
        expect(ax[i]).toBeLessThanOrEqual(WORLD_WIDTH)
        expect(ay[i]).toBeGreaterThanOrEqual(0)
        expect(ay[i]).toBeLessThanOrEqual(WORLD_HEIGHT)
      }
    }
  })

  it("keeps an entity on the same path whatever N is", () => {
    const small = new Wanderers(10, 3)
    const large = new Wanderers(50, 3)
    const sx = new Float64Array(10)
    const sy = new Float64Array(10)
    const lx = new Float64Array(50)
    const ly = new Float64Array(50)
    small.write(12.5, sx, sy)
    large.write(12.5, lx, ly)
    expect(lx.subarray(0, 10)).toEqual(sx)
    expect(ly.subarray(0, 10)).toEqual(sy)
  })
})

describe("InterestSim", () => {
  const defaults = { n: 120, radius: 1.6, seconds: 60 }

  it("without hysteresis, sets equal a brute-force check and updates equal Σ|S_c|", () => {
    const n = 80
    const radius = 1.6
    const sim = new InterestSim({
      n,
      radius,
      hysteresis: false,
      interest: true,
    })
    for (let t = 0; t < 400; t++) {
      sim.step()
      let expected = 0
      for (let c = 0; c < n; c++) {
        const set = bruteForceQuery(
          sim.xs[c],
          sim.ys[c],
          radius,
          sim.xs,
          sim.ys,
          n
        ).filter((e) => e !== c)
        expected += set.length
        expect(sim.size(c)).toBe(set.length)
        for (const e of set) expect(sim.has(c, e)).toBe(true)
      }
      expect(sim.updates).toBe(expected)
    }
  })

  it("with hysteresis, matches an independent brute-force state machine event for event", () => {
    const n = 60
    const radius = 1.6
    const leave = radius * LEAVE_RATIO
    const sim = new InterestSim({ n, radius, hysteresis: true, interest: true })
    const sets = Array.from({ length: n }, () => new Set<number>())
    for (let t = 0; t < 600; t++) {
      sim.step()
      let enters = 0
      let leaves = 0
      let updates = 0
      for (let c = 0; c < n; c++) {
        const inside = new Set(
          bruteForceQuery(sim.xs[c], sim.ys[c], radius, sim.xs, sim.ys, n)
        )
        inside.delete(c)
        const keep = new Set(
          bruteForceQuery(sim.xs[c], sim.ys[c], leave, sim.xs, sim.ys, n)
        )
        for (const e of sets[c])
          if (!keep.has(e)) {
            sets[c].delete(e)
            leaves++
          }
        for (const e of inside)
          if (!sets[c].has(e)) {
            sets[c].add(e)
            enters++
          }
        updates += sets[c].size
      }
      expect(sim.updates).toBe(updates)
      if (t > 0) {
        expect(sim.enters).toBe(enters)
        expect(sim.leaves).toBe(leaves)
      }
    }
  })

  it("an enter radius covering the whole world degrades to the baseline", () => {
    const s = simulateStats({
      n: 60,
      radius: 20,
      hysteresis: true,
      interest: true,
      seconds: 3,
    })
    expect(s.updates).toBe(s.baseline)
    expect(s.enters + s.leaves).toBe(0)
  })

  it("with interest off, sends exactly the O(N²) baseline and no spawn events", () => {
    for (const n of [2, 20, 120, 300]) {
      const s = simulateStats({
        n,
        radius: 1.6,
        hysteresis: true,
        interest: false,
        seconds: 5,
      })
      expect(s.ticks).toBe(5 * TICK_HZ)
      expect(s.updates).toBe(n * (n - 1) * s.ticks)
      expect(s.updates).toBe(s.baseline)
      expect(s.enters).toBe(0)
      expect(s.leaves).toBe(0)
    }
    expect(baselineUpdates(100)).toBe(9900)
  })

  it("hysteresis cuts churn on the seeded default run", () => {
    const off = simulateStats({
      ...defaults,
      hysteresis: false,
      interest: true,
    })
    const on = simulateStats({ ...defaults, hysteresis: true, interest: true })
    // Quoted in the sheet. Enters and leaves balance to within the set's size.
    expect(off.enters + off.leaves).toBe(83198)
    expect(on.enters + on.leaves).toBe(42716)
    expect((on.enters + on.leaves) / (off.enters + off.leaves)).toBeLessThan(
      0.55
    )
    expect(on.updates / off.updates).toBeCloseTo(1.228, 3)
    // Far entities at half rate: 61% of the updates.
    expect(on.tieredUpdates / on.updates).toBeCloseTo(0.61, 2)
    // The price: sets are bigger, because of the band between the two radii.
    expect(on.updates).toBeGreaterThan(off.updates)
    expect(on.updates).toBeLessThan(off.updates * LEAVE_RATIO ** 2)
  })

  it("is close to the uniform-density estimate and far below the baseline", () => {
    const off = simulateStats({
      ...defaults,
      hysteresis: false,
      interest: true,
    })
    const estimate = uniformShare(1.6, WORLD_WIDTH * WORLD_HEIGHT)
    const share = off.updates / off.baseline
    expect(share).toBeLessThanOrEqual(estimate * 1.05)
    expect(share).toBeGreaterThan(estimate * 0.7)
  })

  it("configuring does not count as churn, and sets settle to the new rule", () => {
    const sim = new InterestSim({
      n: 50,
      radius: 1.6,
      hysteresis: true,
      interest: false,
    })
    for (let i = 0; i < 5; i++) sim.step()
    expect(sim.size(VIEWER)).toBe(49)
    sim.configure(1.6, true, true)
    sim.step()
    expect(sim.enters + sim.leaves).toBe(0)
    expect(sim.size(VIEWER)).toBeLessThan(49)
    expect(sim.totalEnters + sim.totalLeaves).toBe(0)
    sim.configure(1.6, true, false)
    sim.step()
    expect(sim.size(VIEWER)).toBe(49)
  })

  it("restarting replays the same run", () => {
    const opts = { n: 40, radius: 1.6, hysteresis: true, interest: true }
    const sim = new InterestSim(opts)
    for (let i = 0; i < 50; i++) sim.step()
    const first = sim.updates
    sim.restart(0)
    for (let i = 0; i < 50; i++) sim.step()
    expect(sim.updates).toBe(first)
  })
})

describe("isDue", () => {
  it("sends K·near + far updates over K ticks for a fixed set", () => {
    const near = 3
    const far = 8
    const k = 4
    let sent = 0
    for (let tick = 0; tick < k; tick++) {
      for (let e = 0; e < near; e++) if (isDue(0.25, 1, tick, 2, e, k)) sent++
      for (let e = near; e < near + far; e++)
        if (isDue(4, 1, tick, 2, e, k)) sent++
    }
    expect(sent).toBe(k * near + far)
  })
})
