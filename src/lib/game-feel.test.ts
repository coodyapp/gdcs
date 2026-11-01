import { describe, expect, it } from "vite-plus/test"

import {
  addTrauma,
  blinkVisible,
  consumeHitStop,
  damp,
  deadzoneAxis,
  decayTrauma,
  moveTowards,
  shakeAmount,
  simulate,
  smoothNoise,
  squashScale,
  stepJumpTimers,
  stepVelocity,
  stretchScale,
  tryHit,
  type JumpTimers,
} from "./game-feel"

describe("moveTowards", () => {
  it("never overshoots", () => {
    expect(moveTowards(0, 1, 0.3)).toBeCloseTo(0.3)
    expect(moveTowards(0.9, 1, 0.3)).toBe(1)
    expect(moveTowards(0, -1, 5)).toBe(-1)
  })
})

describe("damp", () => {
  it("is frame-rate independent", () => {
    let a = 0
    let b = 0
    simulate(30, 1, (dt) => (a = damp(a, 10, 4, dt)))
    simulate(144, 1, (dt) => (b = damp(b, 10, 4, dt)))
    expect(a).toBeCloseTo(b, 6)
    expect(a).toBeCloseTo(10 * (1 - Math.exp(-4)), 6)
  })
})

describe("stepVelocity", () => {
  const cfg = { accel: 20, decel: 30, maxSpeed: 6 }

  it("gives the same position at 30 and 144 fps", () => {
    const run = (fps: number) => {
      let v = 0
      let x = 0
      simulate(fps, 1.2, (dt, t) => {
        v = stepVelocity(v, t < 0.6 ? 1 : 0, dt, cfg)
        x += v * dt
      })
      return { v, x }
    }
    const lo = run(30)
    const hi = run(144)
    expect(lo.v).toBe(0)
    expect(hi.v).toBe(0)
    expect(Math.abs(lo.x - hi.x)).toBeLessThan(0.15)
  })

  it("reaches max speed after maxSpeed / accel seconds", () => {
    let v = 0
    simulate(120, 6 / 20, (dt) => (v = stepVelocity(v, 1, dt, cfg)))
    expect(v).toBeCloseTo(6, 5)
  })

  it("damped and instant models stay bounded", () => {
    let v = 0
    simulate(
      60,
      3,
      (dt) => (v = stepVelocity(v, 1, dt, { ...cfg, model: "damped" }))
    )
    expect(v).toBeGreaterThan(5.9)
    expect(v).toBeLessThanOrEqual(6)
    expect(stepVelocity(0, -1, 1 / 60, { ...cfg, model: "instant" })).toBe(-6)
  })
})

/** Run off a ledge at t=0, press jump `pressAt` seconds later. */
function coyoteJump(fps: number, pressAt: number, coyote: number) {
  // Grounded until now, so the coyote timer is full.
  let timers: JumpTimers = { coyote, buffer: 0 }
  let jumped = false
  let pressed = false
  simulate(fps, 0.5, (dt, t) => {
    const press = !pressed && t >= pressAt
    if (press) pressed = true
    const r = stepJumpTimers(timers, { grounded: false, pressed: press }, dt, {
      coyote,
      buffer: 0,
    })
    timers = r.timers
    jumped ||= r.jump
  })
  return jumped
}

/** Press jump `early` seconds before landing at t=0.3. */
function bufferedJump(fps: number, early: number, buffer: number) {
  let timers: JumpTimers = { coyote: 0, buffer: 0 }
  let jumpedAt = -1
  let pressed = false
  simulate(fps, 0.6, (dt, t) => {
    const press = !pressed && t >= 0.3 - early
    if (press) pressed = true
    const r = stepJumpTimers(
      timers,
      { grounded: t >= 0.3, pressed: press },
      dt,
      { coyote: 0, buffer }
    )
    timers = r.timers
    if (r.jump && jumpedAt < 0) jumpedAt = t
  })
  return jumpedAt
}

describe("coyote time", () => {
  it.each([30, 60, 144])(
    "accepts a late press inside the window at %i fps",
    (fps) => {
      expect(coyoteJump(fps, 0.04, 0.1)).toBe(true)
    }
  )
  it.each([30, 60, 144])(
    "rejects a press after the window expires at %i fps",
    (fps) => {
      expect(coyoteJump(fps, 0.15, 0.1)).toBe(false)
    }
  )
  it("without coyote time any airborne press fails", () => {
    expect(coyoteJump(144, 0.01, 0)).toBe(false)
  })
})

describe("input buffering", () => {
  it.each([30, 60, 144])(
    "fires a buffered press on the landing frame at %i fps",
    (fps) => {
      const at = bufferedJump(fps, 0.08, 0.12)
      expect(at).toBeGreaterThanOrEqual(0.3 - 1e-9)
      expect(at).toBeLessThan(0.3 + 1 / fps + 1e-9)
    }
  )
  it.each([30, 60, 144])("drops a press made too early at %i fps", (fps) => {
    expect(bufferedJump(fps, 0.2, 0.12)).toBe(-1)
  })
  it("a jump consumes the timers (no double jump)", () => {
    const r = stepJumpTimers(
      { coyote: 0.1, buffer: 0.1 },
      { grounded: true, pressed: true },
      1 / 60,
      {
        coyote: 0.1,
        buffer: 0.1,
      }
    )
    expect(r.jump).toBe(true)
    expect(r.timers).toEqual({ coyote: 0, buffer: 0 })
  })
})

describe("hit stop", () => {
  it.each([30, 60, 144])("freezes for the same total time at %i fps", (fps) => {
    let remaining = 0.12
    let game = 0
    simulate(fps, 0.5, (dt) => {
      const r = consumeHitStop(remaining, dt)
      remaining = r.remaining
      game += r.gameDt
    })
    expect(remaining).toBe(0)
    expect(game).toBeCloseTo(0.5 - 0.12, 6)
  })
})

describe("invincibility frames", () => {
  it("ignores hits until the window expires", () => {
    let remaining = 0
    let hits = 0
    // A hit arrives every frame for 1 s; window of 0.25 s → 4 hits.
    simulate(60, 1, (dt) => {
      const r = tryHit(remaining, 0.25)
      if (r.hit) hits++
      remaining = Math.max(0, r.remaining - dt)
    })
    expect(hits).toBe(4)
  })
  it("blinks only while invulnerable", () => {
    expect(blinkVisible(0, 10)).toBe(true)
    const samples = Array.from({ length: 20 }, (_, i) =>
      blinkVisible(1 - i * 0.025, 10)
    )
    expect(samples).toContain(true)
    expect(samples).toContain(false)
  })
})

describe("squash and stretch", () => {
  it("preserves volume", () => {
    for (const s of [
      stretchScale(4, 0.1),
      stretchScale(50, 0.5),
      squashScale(0.4),
    ]) {
      expect(s.along * s.across * s.across).toBeCloseTo(1, 9)
    }
    expect(stretchScale(100, 1, 1.8).along).toBe(1.8)
  })
})

describe("camera deadzone", () => {
  it("only moves when the target leaves the zone", () => {
    expect(deadzoneAxis(0, 0.9, 1)).toBe(0)
    expect(deadzoneAxis(0, 1.5, 1)).toBe(0.5)
    expect(deadzoneAxis(0, -3, 1)).toBe(-2)
  })
})

describe("trauma shake", () => {
  it("decays to zero in amount / rate seconds at any fps", () => {
    for (const fps of [30, 144]) {
      let trauma = addTrauma(0, 0.6)
      let zeroAt = -1
      simulate(fps, 2, (dt, t) => {
        trauma = decayTrauma(trauma, 1.2, dt)
        if (trauma === 0 && zeroAt < 0) zeroAt = t + dt
      })
      expect(zeroAt).toBeCloseTo(0.5, 1)
    }
  })
  it("clamps trauma and squares it", () => {
    expect(addTrauma(0.8, 0.5)).toBe(1)
    expect(shakeAmount(0.5)).toBeCloseTo(0.25)
  })
  it("noise is smooth and bounded", () => {
    for (let x = 0; x < 20; x += 0.37) {
      const n = smoothNoise(x, 1)
      expect(Math.abs(n)).toBeLessThanOrEqual(1)
      expect(Math.abs(smoothNoise(x + 0.01, 1) - n)).toBeLessThan(0.05)
    }
  })
})
