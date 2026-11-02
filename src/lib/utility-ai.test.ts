import { describe, expect, it } from "vite-plus/test"

import {
  bonusToAbsorbNoise,
  chooseBest,
  clamp01,
  compensate,
  createWorld,
  DECISION_HZ,
  EAT,
  HIDE,
  HISTORY,
  pickAmongTop,
  responseCurve,
  runWorld,
  scoreAction,
  scoreWorld,
  stepWorld,
  switchesPerMinute,
  unscaledLogistic,
  WANDER,
  type CurveKind,
  type WorldParams,
} from "./utility-ai"
import { mulberry32 } from "./weighted-random"

const KINDS: CurveKind[] = ["linear", "quadratic", "logistic"]
const DEFAULTS: WorldParams = {
  danger: 0.5,
  hungerRate: 0.04,
  bonus: 0.2,
  curve: "linear",
}

describe("responseCurve", () => {
  it.each(KINDS)("%s stays in 0..1 for any input", (kind) => {
    for (const x of [-5, -0.01, 0, 0.3, 0.5, 0.99, 1, 1.01, 7, NaN, Infinity]) {
      const y = responseCurve(kind, x)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(1)
    }
  })

  it.each(KINDS)("%s runs exactly from 0 to 1 and never falls", (kind) => {
    expect(responseCurve(kind, 0)).toBe(0)
    expect(responseCurve(kind, 1)).toBe(1)
    for (let i = 1; i <= 100; i++)
      expect(responseCurve(kind, i / 100)).toBeGreaterThanOrEqual(
        responseCurve(kind, (i - 1) / 100)
      )
  })

  it("treats NaN as 0", () => {
    expect(clamp01(NaN)).toBe(0)
  })

  it("has the shapes the sheet describes", () => {
    expect(responseCurve("quadratic", 0.5)).toBeCloseTo(0.25, 10)
    expect(responseCurve("logistic", 0.5)).toBeCloseTo(0.5, 10)
    expect(responseCurve("logistic", 0.2)).toBeLessThan(0.1)
    expect(responseCurve("logistic", 0.8)).toBeGreaterThan(0.9)
  })

  it("the unscaled logistic cannot veto: about 0.0067 at an input of 0", () => {
    expect(unscaledLogistic(0)).toBeCloseTo(0.0067, 4)
    expect(unscaledLogistic(1)).toBeCloseTo(0.9933, 4)
  })
})

describe("compensate", () => {
  it("matches the formula's published values for 0.5", () => {
    // Product of n compensated 0.5s.
    expect(compensate(0.5, 2) ** 2).toBeCloseTo(0.391, 3)
    expect(compensate(0.5, 3) ** 3).toBeCloseTo(0.296, 3)
    expect(compensate(0.5, 4) ** 4).toBeCloseTo(0.223, 3)
  })

  it("changes nothing for a single consideration", () => {
    for (const s of [0, 0.2, 0.5, 0.9, 1]) expect(compensate(s, 1)).toBe(s)
  })

  it("keeps 0 at 0 and 1 at 1 for any count", () => {
    for (const n of [1, 2, 5, 50]) {
      expect(compensate(0, n)).toBe(0)
      expect(compensate(1, n)).toBe(1)
    }
  })

  it("raises scores, stays in range and keeps their order", () => {
    for (const n of [2, 3, 5, 10]) {
      for (let i = 1; i < 100; i++) {
        const s = i / 100
        const c = compensate(s, n)
        expect(c).toBeGreaterThan(s)
        expect(c).toBeLessThan(1)
        expect(c).toBeGreaterThan(compensate((i - 1) / 100, n))
      }
    }
  })

  it("corrects only part of the shrink: more considerations still score less", () => {
    const s = 0.5
    let previous = Infinity
    for (const n of [1, 2, 3, 4, 8, 16]) {
      const raw = s ** n
      const fixed = compensate(s, n) ** n
      if (n > 1) {
        expect(fixed).toBeGreaterThan(raw)
        expect(fixed).toBeLessThan(s)
      }
      expect(fixed).toBeLessThan(previous)
      previous = fixed
    }
  })

  it("shrinks the penalty for extra near-perfect considerations", () => {
    expect(0.9 ** 5).toBeCloseTo(0.59, 2)
    expect(compensate(0.9, 5) ** 5).toBeCloseTo(0.868, 3)
  })
})

describe("scoreAction", () => {
  it("multiplies without compensation", () => {
    expect(scoreAction([0.5, 0.5], false)).toBeCloseTo(0.25, 10)
  })

  it("applies compensation for the actual count", () => {
    expect(scoreAction([0.5, 0.5])).toBeCloseTo(0.390625, 10)
    expect(scoreAction([0.7])).toBeCloseTo(0.7, 10)
  })

  it("a zero consideration vetoes the action, compensated or not", () => {
    expect(scoreAction([1, 1, 0, 1])).toBe(0)
    expect(scoreAction([1, 1, 0, 1], false)).toBe(0)
    expect(scoreAction([0.9, responseCurve("logistic", 0)])).toBe(0)
  })

  it("compensation can reorder actions with the same count, favouring balance", () => {
    expect(scoreAction([0.95, 0.2], false)).toBeCloseTo(0.19, 3)
    expect(scoreAction([0.43, 0.43], false)).toBeCloseTo(0.185, 3)
    expect(scoreAction([0.95, 0.2])).toBeCloseTo(0.273, 3)
    expect(scoreAction([0.43, 0.43])).toBeCloseTo(0.305, 3)
  })

  it("an action with no considerations scores 0", () => {
    expect(scoreAction([])).toBe(0)
  })
})

describe("chooseBest", () => {
  it("picks the highest score", () => {
    expect(chooseBest([0.1, 0.8, 0.3])).toBe(1)
  })

  it("resolves ties to the lowest index when none is current", () => {
    expect(chooseBest([0.2, 0.5, 0.5, 0.5])).toBe(1)
    for (let i = 0; i < 20; i++) expect(chooseBest([0.5, 0.5])).toBe(0)
  })

  it("resolves ties in favour of the current action", () => {
    expect(chooseBest([0.5, 0.5, 0.5], 2)).toBe(2)
    expect(chooseBest([0.5, 0.5, 0.5], 1, 0)).toBe(1)
  })

  it("returns -1 when everything is vetoed", () => {
    expect(chooseBest([0, 0, 0], 1, 0.5)).toBe(-1)
  })

  it("the bonus defends the current action until a rival beats it by that factor", () => {
    expect(chooseBest([0.5, 0.59], 0, 0.2)).toBe(0)
    expect(chooseBest([0.5, 0.61], 0, 0.2)).toBe(1)
  })

  it("the bonus cannot rescue a vetoed action", () => {
    expect(chooseBest([0, 0.01], 0, 100)).toBe(1)
  })
})

describe("pickAmongTop", () => {
  it("never picks outside the top few, and matches score proportions", () => {
    const rand = mulberry32(11)
    const counts = [0, 0, 0]
    const trials = 20000
    for (let i = 0; i < trials; i++)
      counts[pickAmongTop([0.6, 0.5, 0.1], 2, rand)]++
    expect(counts[2]).toBe(0)
    expect(counts[0] / trials).toBeCloseTo(0.6 / 1.1, 1)
  })

  it("ignores vetoed actions and reports when none can run", () => {
    const rand = mulberry32(3)
    for (let i = 0; i < 200; i++)
      expect(pickAmongTop([0, 0.4, 0], 3, rand)).toBe(1)
    expect(pickAmongTop([0, 0], 2, rand)).toBe(-1)
  })

  it("is reproducible for a seed, and ranks ties by index", () => {
    const a = mulberry32(5)
    const b = mulberry32(5)
    for (let i = 0; i < 100; i++)
      expect(pickAmongTop([0.4, 0.4, 0.4], 2, a)).toBe(
        pickAmongTop([0.4, 0.4, 0.4], 2, b)
      )
    const rand = mulberry32(9)
    for (let i = 0; i < 200; i++)
      expect(pickAmongTop([0.4, 0.4, 0.4], 2, rand)).not.toBe(2)
  })
})

describe("bonusToAbsorbNoise", () => {
  it("is large enough, and only just, to stop noise flipping two equal actions", () => {
    const s = 0.4
    const e = 0.03
    const b = bonusToAbsorbNoise(s, e)
    expect(b).toBeCloseTo(0.162, 3)
    // Worst case: the running action reads low while the rival reads high.
    expect(chooseBest([s - e, s + e], 0, b + 1e-9)).toBe(0)
    expect(chooseBest([s - e, s + e], 0, b - 1e-3)).toBe(1)
  })
})

describe("scoreWorld", () => {
  it("full danger vetoes Eat and Wander but not Hide", () => {
    const out = scoreWorld(1, 1, "linear", new Float64Array(3))
    expect(out[EAT]).toBe(0)
    expect(out[WANDER]).toBe(0)
    expect(out[HIDE]).toBe(1)
  })

  it("no danger means Hide is vetoed", () => {
    const out = scoreWorld(0.5, 0, "logistic", new Float64Array(3))
    expect(out[HIDE]).toBe(0)
    expect(out[EAT]).toBeGreaterThan(0)
  })
})

describe("world simulation", () => {
  const rate = (seed: number, p: WorldParams) => {
    const sim = runWorld(seed, p, 300)
    return sim.switches / 5
  }

  it("replays exactly for a seed", () => {
    const a = runWorld(42, DEFAULTS, 60)
    const b = runWorld(42, DEFAULTS, 60)
    expect(a.switches).toBe(b.switches)
    expect(a.x).toBe(b.x)
    expect(Array.from(a.history)).toEqual(Array.from(b.history))
  })

  it("a commitment bonus reduces switching on every seed and every curve", () => {
    for (const curve of KINDS) {
      for (let seed = 1; seed <= 10; seed++) {
        const without = rate(seed, { ...DEFAULTS, curve, bonus: 0 })
        const withBonus = rate(seed, { ...DEFAULTS, curve, bonus: 0.2 })
        expect(withBonus).toBeLessThan(without / 2)
      }
    }
  })

  it("more bonus means fewer switches on average", () => {
    const mean = (bonus: number) => {
      let total = 0
      for (let seed = 1; seed <= 20; seed++)
        total += rate(seed * 97, { ...DEFAULTS, bonus })
      return total / 20
    }
    const r0 = mean(0)
    const r1 = mean(0.1)
    const r2 = mean(0.2)
    const r4 = mean(0.4)
    expect(r1).toBeLessThan(r0)
    expect(r2).toBeLessThan(r1)
    expect(r4).toBeLessThan(r2)
    // The numbers quoted on the sheet.
    expect(r0).toBeCloseTo(89, -0.5)
    expect(r1).toBeCloseTo(33, -0.5)
    expect(r2).toBeCloseTo(15, -0.5)
    expect(r4).toBeCloseTo(9, -0.5)
  })

  it("the agent still uses all three actions at the defaults", () => {
    const seen = new Set(runWorld(7, DEFAULTS, 120).history)
    expect(seen.has(EAT) && seen.has(HIDE) && seen.has(WANDER)).toBe(true)
  })

  it("reports the rate over the last 30 s, not the whole run", () => {
    const sim = createWorld(1)
    expect(switchesPerMinute(sim)).toBe(0)
    const p = { ...DEFAULTS, bonus: 0 }
    while (sim.decisions < HISTORY + 1) stepWorld(sim, p, 1 / 30)
    const before = sim.switches
    while (sim.decisions < 2 * HISTORY) stepWorld(sim, p, 1 / 30)
    const inWindow = sim.switches - before
    expect(inWindow).toBeGreaterThan(0)
    expect(switchesPerMinute(sim)).toBeCloseTo(
      (inWindow * 60 * DECISION_HZ) / (HISTORY - 1),
      10
    )
  })

  it("keeps hunger and danger inside 0..1 under extreme settings", () => {
    const sim = createWorld(2)
    const p: WorldParams = { ...DEFAULTS, danger: 1, hungerRate: 0.12 }
    for (let i = 0; i < 3000; i++) {
      stepWorld(sim, p, 1 / 30)
      expect(sim.hunger).toBeGreaterThanOrEqual(0)
      expect(sim.hunger).toBeLessThanOrEqual(1)
      expect(sim.danger).toBeGreaterThanOrEqual(0)
      expect(sim.danger).toBeLessThanOrEqual(1)
    }
  })
})
