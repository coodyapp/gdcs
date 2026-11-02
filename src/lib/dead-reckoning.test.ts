import { describe, expect, it } from "vite-plus/test"

import {
  blendTowards,
  COURSE,
  COURSE_LATENCY,
  COURSE_SPEED,
  cornerRadius,
  courseRun,
  extrapolate,
  type Kinematics,
  pathState,
  roundedPath,
  simulateRun,
  snapErrorBound,
} from "./dead-reckoning"

const steady = (t: number): Kinematics => ({
  x: 1 + 3 * t,
  y: -2 + 4 * t,
  vx: 3,
  vy: 4,
  ax: 0,
  ay: 0,
})

/** Straight along +x, then an instant turn to +y at t = 1. */
const hardTurn =
  (speed: number) =>
  (t: number): Kinematics =>
    t < 1
      ? { x: speed * t, y: 0, vx: speed, vy: 0, ax: 0, ay: 0 }
      : { x: speed, y: speed * (t - 1), vx: 0, vy: speed, ax: 0, ay: 0 }

const circle =
  (radius: number, speed: number) =>
  (t: number): Kinematics => {
    const w = speed / radius
    const c = Math.cos(w * t)
    const s = Math.sin(w * t)
    return {
      x: radius * c,
      y: radius * s,
      vx: -speed * s,
      vy: speed * c,
      ax: -speed * w * c,
      ay: -speed * w * s,
    }
  }

const base = {
  duration: 10,
  threshold: 0.3,
  order: 1 as const,
  latency: 0.1,
  blend: 0,
}

describe("extrapolate", () => {
  const update = { time: 2, x: 1, y: 2, vx: 3, vy: -1, ax: 2, ay: 4 }

  it("ignores acceleration in the first-order model", () => {
    const p = extrapolate(update, 1, 4)
    expect(p.x).toBeCloseTo(7)
    expect(p.y).toBeCloseTo(0)
    expect(p.vx).toBeCloseTo(3)
  })

  it("applies acceleration in the second-order model", () => {
    const p = extrapolate(update, 2, 4)
    expect(p.x).toBeCloseTo(11)
    expect(p.y).toBeCloseTo(8)
    expect(p.vy).toBeCloseTo(7)
  })
})

describe("update traffic", () => {
  it("needs only the first update at constant velocity", () => {
    for (const order of [1, 2] as const) {
      const run = simulateRun({ ...base, truth: steady, order, blend: 0.2 })
      expect(run.updates).toHaveLength(1)
      expect(run.maxError).toBeLessThan(1e-3)
    }
  })

  it("needs only the first update at constant acceleration with order 2", () => {
    const truth = (t: number): Kinematics => ({
      x: 2 * t * t,
      y: 0,
      vx: 4 * t,
      vy: 0,
      ax: 4,
      ay: 0,
    })
    expect(simulateRun({ ...base, truth, order: 2 }).updates).toHaveLength(1)
    expect(
      simulateRun({ ...base, truth, order: 1 }).updates.length
    ).toBeGreaterThan(5)
  })

  it("sends more updates at a lower threshold", () => {
    const counts = [1, 0.6, 0.3, 0.15, 0.05].map(
      (threshold) =>
        courseRun({ threshold, order: 1, blend: 0.2, sharpness: 0.6 }).run
          .updates.length
    )
    for (let i = 1; i < counts.length; i++)
      expect(counts[i]).toBeGreaterThan(counts[i - 1])
  })

  it("doubles the rate in a steady turn when the threshold drops to a quarter", () => {
    const rate = (threshold: number) =>
      simulateRun({
        ...base,
        truth: circle(3, 4),
        threshold,
        latency: 0,
        hz: 960,
      }).updatesPerSecond
    expect(rate(0.1) / rate(0.4)).toBeGreaterThan(1.9)
    expect(rate(0.1) / rate(0.4)).toBeLessThan(2.1)
  })

  it("is deterministic", () => {
    const options = {
      threshold: 0.3,
      order: 1,
      blend: 0.2,
      sharpness: 0.6,
    } as const
    expect(courseRun(options).run.drawnX).toEqual(courseRun(options).run.drawnX)
  })
})

describe("sender and receiver agree", () => {
  const options = {
    threshold: 0.2,
    order: 2,
    blend: 0,
    sharpness: 0.5,
  } as const

  it("draws the sender's own model when there is no latency and no blend", () => {
    const path = roundedPath(COURSE, cornerRadius(0.5))
    const run = simulateRun({
      truth: (t) => pathState(path, t * 4, 4),
      duration: 8,
      threshold: 0.2,
      order: 2,
      latency: 0,
      blend: 0,
    })
    expect(Array.from(run.receiverUpdate)).toEqual(Array.from(run.senderUpdate))
    expect(run.maxError).toBeLessThanOrEqual(run.maxSenderError + 1e-5)
  })

  it("uses each update exactly one latency after the sender does", () => {
    const { run } = courseRun(options)
    const ticks = Math.round(COURSE_LATENCY * run.hz)
    for (let i = 0; i + ticks < run.steps; i++)
      expect(run.receiverUpdate[i + ticks]).toBe(run.senderUpdate[i])
  })

  it("keeps the sender's error to the threshold plus one tick of drift", () => {
    for (const threshold of [0.05, 0.2, 0.5, 1]) {
      for (const sharpness of [0, 0.5, 1]) {
        const { run } = courseRun({ threshold, order: 1, blend: 0, sharpness })
        expect(run.maxSenderError).toBeLessThanOrEqual(
          threshold + (2 * COURSE_SPEED) / run.hz + 1e-5
        )
      }
    }
  })

  it("bounds a snapping receiver by the threshold plus what latency adds", () => {
    for (const threshold of [0.05, 0.2, 0.5, 1]) {
      for (const latency of [0, 0.05, 0.1, 0.2, 0.4]) {
        for (const sharpness of [0, 0.25, 0.5, 0.75, 1]) {
          const path = roundedPath(COURSE, cornerRadius(sharpness))
          const run = simulateRun({
            truth: (t) => pathState(path, t * COURSE_SPEED, COURSE_SPEED),
            duration: path.length / COURSE_SPEED,
            threshold,
            order: 1,
            latency,
            blend: 0,
          })
          expect(run.maxError).toBeLessThanOrEqual(
            snapErrorBound(threshold, COURSE_SPEED, latency) + 1e-5
          )
        }
      }
    }
  })

  it("adds at most the turn's own drift rate over one latency", () => {
    const run = simulateRun({ ...base, truth: hardTurn(4), duration: 3 })
    // At a 90 degree turn the velocities differ by speed * sqrt(2), not 2 * speed.
    const rate = 4 * Math.SQRT2
    expect(run.maxError).toBeLessThanOrEqual(0.3 + rate * (0.1 + 1 / 60) + 1e-5)
    expect(run.maxError).toBeGreaterThan(0.3 + rate * 0.09)
  })

  it("stays within the bound plus the blend time when blending", () => {
    for (const threshold of [0.05, 0.2, 0.5, 1]) {
      for (const latency of [0, 0.1, 0.4]) {
        for (const blend of [0.1, 0.2, 0.5, 1]) {
          for (const sharpness of [0, 0.5, 1]) {
            const path = roundedPath(COURSE, cornerRadius(sharpness))
            const run = simulateRun({
              truth: (t) => pathState(path, t * COURSE_SPEED, COURSE_SPEED),
              duration: path.length / COURSE_SPEED,
              threshold,
              order: 1,
              latency,
              blend,
            })
            expect(run.maxError).toBeLessThanOrEqual(
              snapErrorBound(threshold, COURSE_SPEED, latency + blend) + 1e-5
            )
          }
        }
      }
    }
  })

  it("does not promise that bound for the acceleration model", () => {
    // Its velocity keeps changing, so the stale model can drift faster than 2 * speed.
    const path = roundedPath(COURSE, cornerRadius(0))
    const worst = [0.05, 0.2, 0.5, 1].some((threshold) =>
      [0.1, 0.2, 0.4].some((latency) => {
        const run = simulateRun({
          truth: (t) => pathState(path, t * COURSE_SPEED, COURSE_SPEED),
          duration: path.length / COURSE_SPEED,
          threshold,
          order: 2,
          latency,
          blend: 0,
        })
        return run.maxError > snapErrorBound(threshold, COURSE_SPEED, latency)
      })
    )
    expect(worst).toBe(true)
  })
})

describe("numbers quoted on the sheet", () => {
  const rounded = (x: number, digits = 2) => Number(x.toFixed(digits))
  const course = (over: Partial<Parameters<typeof courseRun>[0]> = {}) =>
    courseRun({ threshold: 0.3, order: 1, blend: 0.2, sharpness: 0.6, ...over })
      .run

  const mean = (values: Float32Array) =>
    values.reduce((sum, x) => sum + x, 0) / values.length

  it("the default lap's average error", () => {
    expect(rounded(mean(course().error))).toBe(0.24)
  })

  it("threshold against updates per lap", () => {
    expect(
      [1, 0.6, 0.3, 0.15, 0.05].map(
        (threshold) => course({ threshold }).updates.length
      )
    ).toEqual([8, 12, 14, 21, 29])
    expect(rounded(course().duration, 1)).toBe(8.4)
    expect(rounded(course().updatesPerSecond)).toBe(1.68)
  })

  it("latency sets a floor under the error", () => {
    expect(rounded(course({ threshold: 0.3, blend: 0 }).maxError)).toBe(0.76)
    expect(rounded(course({ threshold: 0.05, blend: 0 }).maxError)).toBe(0.31)
  })

  it("blend time trades peak error for smaller pops", () => {
    const row = (blend: number) => {
      const run = course({ blend })
      return [rounded(run.maxStep), rounded(run.maxError)]
    }
    expect(row(0)).toEqual([0.74, 0.76])
    expect(row(0.2)).toEqual([0.15, 0.9])
    expect(row(1)).toEqual([0.12, 2.02])
  })

  it("acceleration only pays in long, wide corners", () => {
    const count = (order: 1 | 2, sharpness: number) =>
      course({ order, sharpness }).updates.length
    expect([count(1, 0), count(2, 0)]).toEqual([20, 15])
    expect([count(1, 0.6), count(2, 0.6)]).toEqual([14, 15])
    expect([count(1, 1), count(2, 1)]).toEqual([8, 8])
  })

  it("sharper corners cost fewer updates and a larger error", () => {
    expect(rounded(course({ sharpness: 0 }).maxError)).toBe(0.89)
    expect(rounded(course({ sharpness: 1 }).maxError)).toBe(1.11)
  })

  it("a jittery player reversing every 250 ms defeats the model", () => {
    const period = 0.25
    const zigzag = (t: number): Kinematics => {
      const k = Math.floor(t / period)
      const f = t - k * period
      return {
        x: k % 2 ? 4 * (period - f) : 4 * f,
        y: 0,
        vx: k % 2 ? -4 : 4,
        vy: 0,
        ax: 0,
        ay: 0,
      }
    }
    const run = simulateRun({
      ...base,
      truth: zigzag,
      duration: 20,
      blend: 0.2,
    })
    expect(rounded(run.updatesPerSecond)).toBe(4)
    expect(rounded(mean(run.error))).toBe(0.79)
    expect(rounded(run.maxError)).toBe(1.21)
  })
})

describe("blending", () => {
  const start = { x: 0, y: 2, vx: 4, vy: 0 }
  const target = (t: number) => ({
    x: 4 * t,
    y: 0,
    vx: 4,
    vy: 0,
    ax: 0,
    ay: 0,
  })

  it("starts where the object was drawn and lands on the new path", () => {
    const a = blendTowards(start, target(0), 0, 0.5)
    expect(a.x).toBeCloseTo(0)
    expect(a.y).toBeCloseTo(2)
    const b = blendTowards(start, target(0.5), 0.5, 0.5)
    expect(b.x).toBeCloseTo(2)
    expect(b.y).toBeCloseTo(0)
  })

  it("closes the gap monotonically for a parallel path", () => {
    let last = Infinity
    for (let t = 0; t <= 0.5; t += 0.05) {
      const p = blendTowards(start, target(t), t, 0.5)
      const gap = Math.hypot(p.x - 4 * t, p.y)
      expect(gap).toBeLessThanOrEqual(last + 1e-9)
      last = gap
    }
    expect(last).toBeLessThan(1e-9)
  })

  it("snaps at zero duration", () => {
    expect(blendTowards(start, target(1), 0, 0).y).toBe(0)
  })

  it("in a run, sits exactly on the model once the blend has finished", () => {
    const blend = 0.3
    const run = simulateRun({ ...base, truth: hardTurn(4), blend, duration: 3 })
    expect(run.updates.length).toBe(2)
    const after = Math.round((run.updates[1].time + 0.1 + blend) * run.hz)
    for (let i = after; i < run.steps; i++) {
      expect(run.error[i]).toBeLessThan(1e-3)
    }
    // Still off the path mid-blend, so the convergence is real.
    expect(run.error[after - 6]).toBeGreaterThan(0.01)
  })

  it("makes the largest pop smaller than a snap does", () => {
    const snap = simulateRun({ ...base, truth: hardTurn(4), duration: 3 })
    const blended = simulateRun({
      ...base,
      truth: hardTurn(4),
      duration: 3,
      blend: 0.3,
    })
    expect(blended.maxStep).toBeLessThan(snap.maxStep / 2)
  })
})

describe("course", () => {
  it("is a closed, continuous loop with the advertised velocity", () => {
    for (const sharpness of [0, 0.5, 1]) {
      const path = roundedPath(COURSE, cornerRadius(sharpness))
      const ds = 0.001
      for (let s = 0; s < path.length; s += 0.097) {
        const a = pathState(path, s, 1)
        const b = pathState(path, s + ds, 1)
        expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(2 * ds)
        expect(Math.hypot(a.vx, a.vy)).toBeCloseTo(1)
      }
      const a = pathState(path, 0, 1)
      const b = pathState(path, path.length, 1)
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(1e-9)
    }
  })

  it("stays inside the stage", () => {
    const path = roundedPath(COURSE, cornerRadius(0.5))
    for (let s = 0; s < path.length; s += 0.1) {
      const p = pathState(path, s, 1)
      expect(Math.abs(p.x)).toBeLessThanOrEqual(5.3)
      expect(Math.abs(p.y)).toBeLessThanOrEqual(3.1)
    }
  })
})
