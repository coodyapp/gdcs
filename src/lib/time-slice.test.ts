import { describe, expect, it } from "vite-plus/test"

import { bucketForFrame, bucketRange, isDue, RoundRobin } from "./time-slice"

describe("bucketRange", () => {
  it.each([
    [10, 3],
    [96, 4],
    [7, 7],
    [5, 8],
    [1000, 12],
  ])("partitions %i items into %i near-equal buckets", (count, buckets) => {
    const seen = Array.from({ length: count }, () => 0)
    const sizes: number[] = []
    for (let b = 0; b < buckets; b++) {
      const { start, end } = bucketRange(count, buckets, b)
      sizes.push(end - start)
      for (let i = start; i < end; i++) seen[i]++
    }
    expect(seen.every((x) => x === 1)).toBe(true)
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
  })
})

describe("isDue", () => {
  it("updates every item exactly once per cycle of `buckets` frames", () => {
    const count = 50
    const buckets = 6
    for (let cycle = 0; cycle < 3; cycle++) {
      const hits = Array.from({ length: count }, () => 0)
      for (let f = cycle * buckets; f < (cycle + 1) * buckets; f++)
        for (let i = 0; i < count; i++)
          if (isDue(i, count, buckets, f)) hits[i]++
      expect(hits.every((h) => h === 1)).toBe(true)
    }
  })

  it("rotates buckets in order and handles negative frames", () => {
    expect([0, 1, 2, 3, 4].map((f) => bucketForFrame(f, 3))).toEqual([
      0, 1, 2, 0, 1,
    ])
    expect(bucketForFrame(-1, 3)).toBe(2)
  })
})

describe("RoundRobin", () => {
  it("visits every item once per ceil(count / budget) frames, wrapping", () => {
    const rr = new RoundRobin()
    const hits = Array.from({ length: 10 }, () => 0)
    for (let f = 0; f < 4; f++) rr.next(10, 3, (i) => hits[i]++)
    // 12 visits over 10 items: items 0 and 1 got a second turn.
    expect(hits).toEqual([2, 2, 1, 1, 1, 1, 1, 1, 1, 1])
  })

  it("survives the item count shrinking", () => {
    const rr = new RoundRobin()
    rr.next(10, 8, () => {})
    const visited: number[] = []
    rr.next(4, 2, (i) => visited.push(i))
    expect(visited).toEqual([0, 1])
  })

  it("never visits more than count items in one frame", () => {
    const rr = new RoundRobin()
    expect(rr.next(3, 10, () => {})).toBe(3)
    expect(rr.next(0, 10, () => {})).toBe(0)
  })
})
