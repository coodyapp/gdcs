import { describe, expect, it } from "vite-plus/test"

import { Pool } from "./pool"

describe("Pool", () => {
  it("pre-allocates and never allocates while recycling", () => {
    let made = 0
    const pool = new Pool(
      () => ({ id: made++, x: 0 }),
      4,
      (o) => (o.x = 0)
    )
    expect(pool.allocations).toBe(4)
    for (let round = 0; round < 100; round++) {
      const i = pool.acquire()
      expect(i).toBeGreaterThanOrEqual(0)
      pool.items[i].x = 42
      pool.release(i)
      expect(pool.items[i].x).toBe(0) // reset on release
    }
    expect(made).toBe(4)
    expect(pool.allocations).toBe(4)
  })

  it("returns -1 when exhausted, then reuses a released slot", () => {
    const pool = new Pool(() => ({}), 3)
    const slots = [pool.acquire(), pool.acquire(), pool.acquire()]
    expect(new Set(slots).size).toBe(3)
    expect(pool.acquire()).toBe(-1)
    pool.release(slots[1])
    expect(pool.acquire()).toBe(slots[1])
    expect(pool.activeCount).toBe(3)
  })

  it("ignores double release so the free list stays valid", () => {
    const pool = new Pool(() => ({}), 2)
    const a = pool.acquire()
    expect(pool.release(a)).toBe(true)
    expect(pool.release(a)).toBe(false)
    expect(pool.acquire()).not.toBe(pool.acquire())
  })

  it("grows on demand when allowed", () => {
    const pool = new Pool(() => ({}), 1, undefined, true)
    pool.acquire()
    expect(pool.acquire()).toBe(1)
    expect(pool.allocations).toBe(2)
  })
})
