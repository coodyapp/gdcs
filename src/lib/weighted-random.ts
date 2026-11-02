/**
 * What games do with randomness: weighted picks, unbiased shuffles and shuffle
 * bags. Every function takes its random source as an argument, so feeding it a
 * seeded PRNG makes the whole thing reproducible.
 */
export { mulberry32 } from "./noise"

/** A source of uniform floats in [0, 1), such as `mulberry32(seed)`. */
export type Rand = () => number

/**
 * Index picked with probability `weights[i] / sum(weights)`, by walking the
 * cumulative sum. Linear in the item count; allocates nothing.
 */
export function weightedPick(weights: readonly number[], rand: Rand) {
  let total = 0
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] < 0) throw new RangeError("weights must be non-negative")
    total += weights[i]
  }
  if (total <= 0) throw new RangeError("weights must have a positive sum")
  let r = rand() * total
  let last = 0
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] === 0) continue
    last = i
    r -= weights[i]
    if (r < 0) return i
  }
  // Only float rounding reaches this: never return a zero-weight item.
  return last
}

/** Unbiased in-place shuffle: every permutation is equally likely. */
export function fisherYates<T>(items: T[], rand: Rand) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = items[i]
    items[i] = items[j]
    items[j] = tmp
  }
  return items
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

/**
 * Copies of each item in the smallest bag that matches integer weights
 * exactly: [60, 25, 10, 5] becomes [12, 5, 2, 1], a bag of 20.
 */
export function bagCounts(weights: readonly number[]) {
  let divisor = 0
  for (const w of weights) {
    if (!Number.isInteger(w) || w < 0)
      throw new RangeError("bag weights must be non-negative integers")
    divisor = gcd(divisor, w)
  }
  if (divisor === 0) throw new RangeError("weights must have a positive sum")
  return weights.map((w) => w / divisor)
}

/**
 * Deal every copy once in shuffled order, then reshuffle. Each full bag holds
 * exact proportions, which removes long streaks. `next` allocates nothing.
 */
export class ShuffleBag {
  private readonly items: number[] = []
  private cursor = 0

  constructor(
    counts: readonly number[],
    private readonly rand: Rand
  ) {
    counts.forEach((count, item) => {
      for (let c = 0; c < count; c++) this.items.push(item)
    })
    if (this.items.length === 0) throw new RangeError("the bag is empty")
    this.reset()
  }

  get size() {
    return this.items.length
  }

  /** Reshuffle and start a fresh bag. */
  reset() {
    fisherYates(this.items, this.rand)
    this.cursor = 0
  }

  next() {
    if (this.cursor === this.items.length) this.reset()
    return this.items[this.cursor++]
  }
}

/**
 * Worst run of other items between two copies of an item that has `copies` in
 * a bag of `size`: all its copies first in one bag, then last in the next.
 */
export const worstBagDrought = (size: number, copies: number) =>
  2 * (size - copies)

/** Chance of at least one success in `tries` independent attempts. */
export const atLeastOnce = (p: number, tries: number) => 1 - (1 - p) ** tries
