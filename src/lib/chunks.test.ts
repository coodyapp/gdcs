import { describe, expect, it } from "vite-plus/test"

import { chunkCoords, chunkKey, ChunkStreamer } from "./chunks"

/** Total load + unload events while the player wiggles across a chunk edge. */
function churn(loadRadius: number, unloadRadius: number) {
  const s = new ChunkStreamer(1, loadRadius, unloadRadius)
  s.update(0.5, 0.5)
  let events = 0
  for (let i = 0; i < 40; i++) {
    const x = i % 2 === 0 ? 0.95 : 1.05 // straddle the x = 1 boundary
    const ev = s.update(x, 0.5)
    events += ev.loaded.length + ev.unloaded.length
    if (i === 1) events = 0 // ignore the first crossing in each direction
  }
  return events
}

describe("chunk keys", () => {
  it("round-trip negative and positive coordinates", () => {
    for (const [x, z] of [
      [0, 0],
      [-1, 5],
      [123, -456],
      [-32767, 32767],
    ])
      expect(chunkCoords(chunkKey(x, z))).toEqual([x, z])
  })
})

describe("ChunkStreamer", () => {
  it("loads every chunk whose centre is inside the load radius", () => {
    const s = new ChunkStreamer(10, 15, 20)
    const ev = s.update(5, 5)
    // Centres within 15 of (5, 5): the 3×3 block (diagonals are 14.1 away); axis chunks two steps out are 20 away.
    expect(ev.loaded.length).toBe(9)
    expect(ev.pending).toBe(0)
    expect(s.resident.has(chunkKey(0, 0))).toBe(true)
    expect(s.resident.has(chunkKey(2, 0))).toBe(false)
  })

  it("loads nearest first and respects the per-update budget", () => {
    const s = new ChunkStreamer(1, 3, 4)
    const first = s.update(0.5, 0.5, 5)
    expect(first.loaded[0]).toBe(chunkKey(0, 0))
    expect(first.loaded.length).toBe(5)
    expect(first.pending).toBeGreaterThan(0)
    let guard = 0
    while (s.update(0.5, 0.5, 5).pending > 0 && guard++ < 20);
    expect(s.update(0.5, 0.5, 5).loaded.length).toBe(0)
  })

  it("does not thrash at a boundary when unloadRadius > loadRadius", () => {
    expect(churn(2.5, 3.5)).toBe(0)
  })

  it("thrashes without hysteresis (the failure the margin prevents)", () => {
    expect(churn(2.5, 2.5)).toBeGreaterThan(20)
  })

  it("unloads chunks once the player is beyond the unload radius", () => {
    const s = new ChunkStreamer(1, 2, 3)
    s.update(0.5, 0.5)
    expect(s.resident.has(chunkKey(0, 0))).toBe(true)
    const ev = s.update(10.5, 0.5)
    expect(ev.unloaded).toContain(chunkKey(0, 0))
    expect(s.resident.has(chunkKey(0, 0))).toBe(false)
  })

  it("rejects an unload radius smaller than the load radius", () => {
    expect(() => new ChunkStreamer(1, 3, 2)).toThrow(RangeError)
  })
})
