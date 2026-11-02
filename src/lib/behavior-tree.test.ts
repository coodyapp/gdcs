import { describe, expect, it } from "vite-plus/test"

import {
  action,
  activeBranch,
  condition,
  createGuardWorld,
  GUARD,
  guardTree,
  inverter,
  selector,
  sequence,
  stepGuard,
  succeeder,
  tick,
  type GuardOptions,
  type Status,
  type TickResult,
} from "./behavior-tree"

type B = Record<string, Status | undefined>
const leaf = (id: string) => action<B>(id, (b) => b[id] ?? "success")

describe("composites", () => {
  it("sequence stops at the first failure", () => {
    const tree = sequence("s", leaf("a"), leaf("b"), leaf("c"))
    const r = tick(tree, { b: "failure" }, true)
    expect(r.status).toBe("failure")
    expect(r.trace).toEqual({ a: "success", b: "failure", s: "failure" })
  })

  it("sequence succeeds only when every child does", () => {
    const r = tick(sequence<B>("s", leaf("a"), leaf("b")), {}, true)
    expect(r.status).toBe("success")
  })

  it("selector stops at the first success", () => {
    const tree = selector("s", leaf("a"), leaf("b"), leaf("c"))
    const r = tick(tree, { a: "failure" }, true)
    expect(r.status).toBe("success")
    expect(r.trace).toEqual({ a: "failure", b: "success", s: "success" })
  })

  it("selector fails only when every child does", () => {
    const tree = selector<B>("s", leaf("a"), leaf("b"))
    const r = tick(tree, { a: "failure", b: "failure" }, true)
    expect(r.status).toBe("failure")
  })

  it("running propagates through composites and stops later siblings", () => {
    const tree = selector(
      "root",
      sequence("seq", leaf("a"), selector("inner", leaf("b"))),
      leaf("c")
    )
    const r = tick(tree, { b: "running" }, true)
    expect(r.status).toBe("running")
    expect(r.trace.seq).toBe("running")
    expect(r.trace.inner).toBe("running")
    expect(r.trace.c).toBeUndefined()
    expect(activeBranch(tree, r)).toEqual(["root", "seq", "inner", "b"])
  })
})

describe("empty composites", () => {
  it("an empty sequence succeeds and an empty selector fails", () => {
    expect(tick(sequence<B>("s"), {}, true).status).toBe("success")
    expect(tick(selector<B>("s"), {}, true).status).toBe("failure")
  })
})

describe("decorators", () => {
  it("inverter swaps results and passes running through", () => {
    const tree = inverter("not", leaf("a"))
    expect(tick(tree, { a: "success" }, true).status).toBe("failure")
    expect(tick(tree, { a: "failure" }, true).status).toBe("success")
    expect(tick(tree, { a: "running" }, true).status).toBe("running")
  })

  it("succeeder hides a failure from its parent", () => {
    const tree = sequence("s", succeeder("opt", leaf("a")), leaf("b"))
    const r = tick(tree, { a: "failure" }, true)
    expect(r.status).toBe("success")
    expect(r.trace.b).toBe("success")
  })
})

describe("reactive versus memory", () => {
  const tree = selector(
    "root",
    sequence(
      "guarded",
      condition<B>("alarm", (b) => b.alarm === "success"),
      leaf("respond")
    ),
    leaf("work")
  )

  it("reactive mode lets a higher priority interrupt a running child", () => {
    const first = tick(tree, { work: "running" }, true)
    expect(first.trace.work).toBe("running")
    const second = tick(tree, { alarm: "success" }, true, first)
    expect(second.trace.respond).toBe("success")
    expect(second.trace.work).toBeUndefined()
    expect(second.interrupted).toEqual(["work"])
  })

  it("memory mode resumes the running child and skips earlier ones", () => {
    const first = tick(tree, { work: "running" }, false)
    const second = tick(
      tree,
      { alarm: "success", work: "running" },
      false,
      first
    )
    expect(second.trace).toEqual({ work: "running", root: "running" })
    expect(second.interrupted).toEqual([])
  })

  it("memory mode starts over once the running child finishes", () => {
    const first = tick(tree, { work: "running" }, false)
    const done = tick(tree, { alarm: "success" }, false, first)
    expect(done.trace.work).toBe("success")
    expect(done.running).toEqual({})
    const next = tick(tree, { alarm: "success" }, false, done)
    expect(next.trace.respond).toBe("success")
  })

  it("memory mode resumes a nested sequence past its finished steps", () => {
    const seq = sequence<B>("s", leaf("a"), leaf("b"), leaf("c"))
    const first = tick(seq, { b: "running" }, false)
    expect(first.running).toEqual({ s: 1 })
    // `a` would now fail, but it already passed and is not checked again.
    const second = tick(seq, { a: "failure", b: "success" }, false, first)
    expect(second.trace.a).toBeUndefined()
    expect(second.status).toBe("success")
  })

  it("does not mutate the previous result", () => {
    const first = tick(tree, { work: "running" }, true)
    const copy = JSON.parse(JSON.stringify(first)) as TickResult
    tick(tree, { alarm: "success" }, true, first)
    expect(first).toEqual(copy)
  })
})

describe("guard tree", () => {
  const patrolling = { distance: 9, hurt: false, safe: true, arrived: false }

  it("visits 6 nodes per patrol tick when reactive and 2 with memory", () => {
    const reactive = tick(guardTree, patrolling, true)
    expect(Object.keys(reactive.trace)).toHaveLength(6)
    const first = tick(guardTree, patrolling, false)
    const resumed = tick(guardTree, patrolling, false, first)
    expect(Object.keys(resumed.trace)).toHaveLength(2)
  })

  it("flee outranks chase, and chase outranks patrol", () => {
    const near = { distance: 1, hurt: false, safe: false, arrived: false }
    expect(tick(guardTree, near, true).trace.chase).toBe("running")
    const hurtNear = { ...near, hurt: true }
    const r = tick(guardTree, hurtNear, true)
    expect(r.trace.flee).toBe("running")
    expect(r.trace.chaseBranch).toBeUndefined()
  })
})

describe("guard world", () => {
  const defaults: GuardOptions = {
    reactive: true,
    autoTarget: true,
    targetDistance: 1.2,
    maxHealth: 100,
  }
  const DT = 1 / 60

  const run = (options: GuardOptions, seconds: number) => {
    let w = createGuardWorld(options)
    const leaves = new Set<string>()
    const statuses = new Set<Status>()
    let flips = 0
    let previous = ""
    for (let i = 0; i < seconds * 60; i++) {
      w = stepGuard(w, DT, options)
      const leaf = activeBranch(guardTree, w.last).at(-1) ?? ""
      if (leaf !== previous) flips++
      previous = leaf
      leaves.add(leaf)
      statuses.add(w.last.status)
    }
    return { world: w, leaves, statuses, flips }
  }

  it("defaults reach all three branches and all three root statuses", () => {
    const { leaves, statuses } = run(defaults, 40)
    expect(leaves).toContain("patrol")
    expect(leaves).toContain("chase")
    expect(leaves).toContain("flee")
    expect([...statuses].sort()).toEqual(["running", "success"])
  })

  it("stays inside the walkable box", () => {
    let w = createGuardWorld(defaults)
    for (let i = 0; i < 120 * 60; i++) {
      w = stepGuard(w, DT, defaults)
      expect(w.x).toBeGreaterThanOrEqual(GUARD.minX)
      expect(w.x).toBeLessThanOrEqual(GUARD.maxX)
      expect(w.z).toBeGreaterThanOrEqual(GUARD.minZ)
      expect(w.z).toBeLessThanOrEqual(GUARD.maxZ)
    }
  })

  it("a target inside the near radius starts a chase within one tick when reactive, but waits for the waypoint with memory", () => {
    const parked = { ...defaults, autoTarget: false, targetDistance: 1 }
    const timeToChase = (reactive: boolean) => {
      const o = { ...parked, reactive }
      let w = createGuardWorld(o)
      let inRange = -1
      for (let i = 0; i < 20 * 60; i++) {
        w = stepGuard(w, DT, o)
        const d = Math.hypot(w.targetX - w.x, w.targetZ - w.z)
        if (inRange < 0 && d < GUARD.nearRadius) inRange = w.time
        if (w.last.trace.chase) return w.time - inRange
      }
      return Infinity
    }
    expect(timeToChase(true)).toBeLessThanOrEqual(1 / GUARD.tickHz + DT)
    expect(timeToChase(false)).toBeGreaterThan(1)
  })

  it("a far parked target leaves the guard patrolling forever", () => {
    const o = { ...defaults, autoTarget: false, targetDistance: 3.5 }
    const { leaves } = run(o, 30)
    expect([...leaves]).toEqual(["patrol"])
  })

  it("max health below the threshold means it only ever flees", () => {
    const o = { ...defaults, maxHealth: 20 }
    const { leaves } = run(o, 30)
    expect([...leaves]).toEqual(["flee"])
  })

  it("holds contact steadily instead of flickering at the reach radius", () => {
    // 120 s of defaults: every switch is a real decision, not boundary noise.
    expect(run(defaults, 120).flips).toBeLessThan(40)
  })

  it("loses health at the documented rate while in contact", () => {
    const seconds = (100 - GUARD.lowHealth) / GUARD.drainPerSecond
    expect(seconds).toBeCloseTo(1.75)
  })

  it("a memory-mode patrol leg lasts about 3.1 s", () => {
    const leg = GUARD.waypoints[1][0] - GUARD.waypoints[0][0]
    expect(leg / GUARD.patrolSpeed).toBeCloseTo(3.09, 2)
  })
})
