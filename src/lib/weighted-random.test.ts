import { describe, expect, it } from "vite-plus/test"

import {
  atLeastOnce,
  bagCounts,
  fisherYates,
  mulberry32,
  ShuffleBag,
  weightedPick,
  worstBagDrought,
} from "./weighted-random"

const WEIGHTS = [60, 25, 10, 5]

describe("weightedPick", () => {
  it("is deterministic for a seed", () => {
    const a = mulberry32(7)
    const b = mulberry32(7)
    for (let i = 0; i < 500; i++)
      expect(weightedPick(WEIGHTS, a)).toBe(weightedPick(WEIGHTS, b))
  })

  it("matches the weights within tolerance over many rolls", () => {
    const rand = mulberry32(42)
    const counts = [0, 0, 0, 0]
    const rolls = 200_000
    for (let i = 0; i < rolls; i++) counts[weightedPick(WEIGHTS, rand)]++
    WEIGHTS.forEach((w, i) => {
      expect(Math.abs(counts[i] / rolls - w / 100)).toBeLessThan(0.005)
    })
  })

  it("walks the cumulative sum at the boundaries", () => {
    expect(weightedPick(WEIGHTS, () => 0)).toBe(0)
    expect(weightedPick(WEIGHTS, () => 0.5999)).toBe(0)
    expect(weightedPick(WEIGHTS, () => 0.6)).toBe(1)
    expect(weightedPick(WEIGHTS, () => 0.9499)).toBe(2)
    expect(weightedPick(WEIGHTS, () => 0.9999)).toBe(3)
  })

  it("never picks a zero-weight item, even at the top of the range", () => {
    expect(weightedPick([0, 1, 0], () => 0)).toBe(1)
    expect(weightedPick([1, 1, 0], () => 1 - 2 ** -53)).toBe(1)
  })

  it("rejects weights it cannot pick from", () => {
    expect(() => weightedPick([0, 0], Math.random)).toThrow(RangeError)
    expect(() => weightedPick([1, -1], Math.random)).toThrow(RangeError)
  })
})

describe("fisherYates", () => {
  it("yields a permutation", () => {
    const shuffled = fisherYates(
      Array.from({ length: 200 }, (_, i) => i),
      mulberry32(3)
    )
    expect(new Set(shuffled).size).toBe(200)
    expect([...shuffled].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 200 }, (_, i) => i)
    )
  })

  it("is deterministic for a seed", () => {
    const run = () => fisherYates([1, 2, 3, 4, 5, 6, 7, 8], mulberry32(9))
    expect(run()).toEqual(run())
  })

  it("makes all six orders of three items about equally likely", () => {
    const rand = mulberry32(11)
    const seen = new Map<string, number>()
    const shuffles = 60_000
    for (let i = 0; i < shuffles; i++) {
      const key = fisherYates(["a", "b", "c"], rand).join("")
      seen.set(key, (seen.get(key) ?? 0) + 1)
    }
    expect(seen.size).toBe(6)
    for (const count of seen.values())
      expect(Math.abs(count / shuffles - 1 / 6)).toBeLessThan(0.01)
  })
})

describe("bagCounts", () => {
  it("reduces integer weights to the smallest exact bag", () => {
    expect(bagCounts(WEIGHTS)).toEqual([12, 5, 2, 1])
    expect(bagCounts([60, 25, 10, 30])).toEqual([12, 5, 2, 6])
    expect(bagCounts([3, 0, 7])).toEqual([3, 0, 7])
  })

  it("rejects weights no bag can hold", () => {
    expect(() => bagCounts([0.5, 1])).toThrow(RangeError)
    expect(() => bagCounts([0, 0])).toThrow(RangeError)
  })
})

describe("ShuffleBag", () => {
  const RARE = 3
  const counts = bagCounts(WEIGHTS)

  it("is deterministic for a seed", () => {
    const a = new ShuffleBag(counts, mulberry32(5))
    const b = new ShuffleBag(counts, mulberry32(5))
    for (let i = 0; i < 500; i++) expect(a.next()).toBe(b.next())
  })

  it("deals exact proportions in every full bag", () => {
    const bag = new ShuffleBag(counts, mulberry32(21))
    for (let round = 0; round < 200; round++) {
      const seen = [0, 0, 0, 0]
      for (let i = 0; i < bag.size; i++) seen[bag.next()]++
      expect(seen).toEqual(counts)
    }
  })

  it("never lets a whole bag pass without the rare item", () => {
    const bag = new ShuffleBag(counts, mulberry32(22))
    for (let round = 0; round < 2_000; round++) {
      let hits = 0
      for (let i = 0; i < bag.size; i++) if (bag.next() === RARE) hits++
      expect(hits).toBe(counts[RARE])
    }
  })

  it("caps droughts at the worst case across a bag seam", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const bag = new ShuffleBag(counts, mulberry32(seed))
      let drought = 0
      let longest = 0
      for (let i = 0; i < 100_000; i++) {
        drought = bag.next() === RARE ? 0 : drought + 1
        longest = Math.max(longest, drought)
      }
      expect(longest).toBeLessThanOrEqual(
        worstBagDrought(bag.size, counts[RARE])
      )
      // Reachable: the seam really can stretch past a single bag.
      expect(longest).toBeGreaterThan(bag.size)
    }
  })

  it("droughts far longer without a bag at the same rate", () => {
    const rand = mulberry32(6)
    let drought = 0
    let longest = 0
    for (let i = 0; i < 100_000; i++) {
      drought = weightedPick(WEIGHTS, rand) === RARE ? 0 : drought + 1
      longest = Math.max(longest, drought)
    }
    expect(longest).toBeGreaterThan(worstBagDrought(20, 1) * 2)
  })

  it("restarts a fresh bag on reset", () => {
    const bag = new ShuffleBag([1, 1, 1], mulberry32(8))
    bag.next()
    bag.reset()
    const dealt = [bag.next(), bag.next(), bag.next()]
    expect([...dealt].sort()).toEqual([0, 1, 2])
  })
})

describe("atLeastOnce", () => {
  it("gives about 65% for a 10% drop over 10 tries", () => {
    expect(atLeastOnce(0.1, 10)).toBeCloseTo(0.6513, 4)
  })

  it("agrees with simulation", () => {
    const rand = mulberry32(13)
    let wins = 0
    const trials = 100_000
    for (let t = 0; t < trials; t++) {
      for (let i = 0; i < 10; i++) {
        if (rand() < 0.1) {
          wins++
          break
        }
      }
    }
    expect(Math.abs(wins / trials - atLeastOnce(0.1, 10))).toBeLessThan(0.01)
  })
})
