import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

function stubBrowser({
  mobile = false,
  reduce = false,
  saveData = false,
  memory = 8,
} = {}) {
  vi.stubGlobal("window", {
    matchMedia: (q: string) => ({
      matches: q.includes("reduce")
        ? reduce
        : q.includes("640px")
          ? mobile
          : false,
    }),
  })
  vi.stubGlobal("navigator", { connection: { saveData }, deviceMemory: memory })
  vi.stubGlobal("requestAnimationFrame", (cb: () => void) => (cb(), 0))
}

describe("live-canvas budget", () => {
  beforeEach(() => vi.resetModules())

  it("grants slots to the most visible cards only (4 on desktop)", async () => {
    stubBrowser()
    const { registerCard, liveCount } = await import("./budget")
    const state: Record<string, boolean> = {}
    const cards = Array.from({ length: 7 }, (_, i) =>
      registerCard(`c${i}`, (live) => (state[`c${i}`] = live))
    )
    cards.forEach((c, i) => c.update(1 - i * 0.05)) // c0 most visible
    expect(liveCount()).toBe(4)
    expect(
      Object.entries(state)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .sort()
    ).toEqual(["c0", "c1", "c2", "c3"])
    cards[0].update(0) // scrolled away: next one takes the slot
    expect(state.c0).toBe(false)
    expect(state.c4).toBe(true)
    cards.forEach((c) => c.release())
    expect(liveCount()).toBe(0)
  })

  it("ignores barely visible cards", async () => {
    stubBrowser()
    const { registerCard, liveCount } = await import("./budget")
    registerCard("x", () => {}).update(0.3)
    expect(liveCount()).toBe(0)
  })

  it("uses 2 slots on phones and none with reduced motion, data saver or low memory", async () => {
    stubBrowser({ mobile: true })
    expect((await import("./budget")).budget()).toBe(2)
    for (const opts of [{ reduce: true }, { saveData: true }, { memory: 2 }]) {
      vi.resetModules()
      stubBrowser(opts)
      expect((await import("./budget")).budget()).toBe(0)
    }
  })
})
