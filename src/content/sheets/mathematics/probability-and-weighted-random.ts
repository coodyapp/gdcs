import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "probability-and-weighted-random",
  category: "mathematics",
  subcategory: "procedural",
  title: "Probability and Weighted Random",
  hook: "fair dice still feel unfair, so choose your dice",
  summary:
    "Seeded PRNGs, loot tables, expected value and the maths of bad luck: why a 10% drop fails a third of the time in 10 tries, and how shuffle bags cap droughts.",
  level: "core",
  tags: ["random", "probability", "prng", "loot-table", "shuffle-bag", "seed"],
  updated: "2026-11-02",
  prompt:
    "Write `src/lib/weighted-random.ts` in TypeScript with no dependencies. `mulberry32(seed)` returns floats in [0, 1). `weightedPick(weights, rand)` returns an index with probability weights[i] / sum, by a cumulative walk; it throws on a negative weight or a zero sum, never returns a zero-weight item even if float rounding runs off the end, and allocates nothing. `fisherYates(array, rand)` shuffles in place, drawing j from 0 to i inclusive. `ShuffleBag(counts, rand)` deals each item `counts[i]` times in shuffled order, then reshuffles, with `next()` and `reset()`. Every function takes `rand` as an argument and never touches `Math.random()`. Vitest: the same seed gives the same sequence; 200,000 picks land within 0.5% of the weights; a shuffle is a permutation and all 6 orders of 3 items are about equally likely; every full bag holds exact counts; the longest run without an item never exceeds 2 × (bag size − its copies).",
  related: [
    "seeded-noise",
    "particle-system",
    "finite-state-machine",
    "utility-ai",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Games almost never use true randomness. A **PRNG** is a small deterministic function that only looks random, and its whole future is fixed by a **seed**. That is a feature: the same seed replays the same run, so replays, daily challenges, netcode and bug reports all work. `Math.random()` gives you a good uniform float but no way to set its seed, so anything that must repeat needs its own generator ([seeded noise](/mathematics/procedural/seeded-noise) has one). Keep real entropy such as `crypto.getRandomValues` for picking the seed and for anything players could profit from predicting.",
    "A PRNG gives a **uniform** float in [0, 1), where every value is equally likely. To favour some outcomes, a **loot table** gives each item a weight: pick a point in `[0, total)`, then walk the list subtracting weights until the point falls inside one. Weights are relative, so adding an item never means re-balancing the others to reach 100. **Expected value** turns the table into one number you can balance against: the average payout per roll.",
    "Rolls are independent, so luck has no memory. A 10% drop is **not** guaranteed in 10 tries: the chance of at least one is `1 - 0.9^10`, about 65%, so one player in three walks away empty-handed. Across thousands of players, someone always gets a brutal streak and reports a bug. Long-run rates do converge (the law of large numbers), but no single player lives in the long run.",
    "So games bend the dice. A **shuffle bag** deals a fixed set of outcomes in shuffled order (a Fisher-Yates shuffle, like a deck of cards), which makes the proportions exact per bag and puts a hard ceiling on droughts. A **pity timer** keeps independent rolls but forces the drop after N misses. Both give up true independence, and that is the point: players judge fairness by their worst streak, not by the average.",
  ],
  formulas: [
    {
      label: "Weighted pick",
      math: tex`\textcolor{#05df72}{P_i} = \frac{w_i}{\sum_j w_j}`,
      note: "The target tick on each bar. Weights need not sum to 100.",
    },
    {
      label: "Expected value of a roll",
      math: tex`E[X] = \sum_i P_i\, v_i`,
      note: "v = the value of item i. Compare it with what one roll costs the player.",
    },
    {
      label: "At least one success in n tries",
      math: tex`P(\text{hit}) = 1 - (1 - p)^n, \qquad n_{\text{target}} = \left\lceil \frac{\ln(1 - \text{target})}{\ln(1 - p)} \right\rceil`,
      note: "p = 0.1, n = 10 gives 0.651. Multiplying, 10 × 10%, would wrongly give 100%.",
    },
    {
      label: "Worst drought in a shuffle bag",
      math: tex`\textcolor{#05df72}{d_{\max}} = 2\,(B - k)`,
      note: "Bag of B with k copies of the item: all k first in one bag, then last in the next.",
    },
  ],
  rules: [
    "A 10% drop needs 7 tries for a 50% chance, 22 for 90% and 44 for 99%. Average tries is 1/p = 10, but the median is lower.",
    "A 5% drop rolled 1,500 times has a longest drought of around 90 misses, and 1 run in 10 passes 125. Expect it, then decide whether your game can tolerate it.",
    "Shuffle bags suit what players notice: crits, tetromino order, hit reactions. Keep bags small, between 7 and 30 items; a bag of 1,000 feels like no bag.",
    "Hard pity at N tries lifts the real rate: the average tries become (1 - (1 - p)^N) / p. For p = 5% and N = 40 that is 17.4 tries, or 5.7%, so lower the base rate if the budget matters.",
    "Use one PRNG stream per system (loot, AI, cosmetics), so that adding a particle does not change the next drop.",
    "For more than about 100 items rolled constantly, binary-search a prefix-sum array, or use the alias method for O(1) picks.",
  ],
  code: [
    {
      lang: "ts",
      caption: "A cumulative walk over a loot table, driven by a seeded PRNG:",
      code: `// Any rand() in [0, 1): use mulberry32(seed) when runs must repeat.
function weightedPick(weights: number[], rand: () => number) {
  let total = 0
  for (const w of weights) total += w
  let r = rand() * total
  let last = -1
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] <= 0) continue
    last = i
    r -= weights[i]
    if (r < 0) return i
  }
  return last // only float rounding gets here (or -1: nothing to pick)
}

const loot = [
  { item: "coin", weight: 60, value: 1 },
  { item: "potion", weight: 25, value: 5 },
  { item: "gem", weight: 10, value: 20 },
  { item: "relic", weight: 5, value: 100 },
]
const weights = loot.map((l) => l.weight)
const rand = mulberry32(seed)
const drop = loot[weightedPick(weights, rand)]

// Expected value: (60 + 125 + 200 + 500) / 100 = 8.85 per roll.
const total = weights.reduce((sum, w) => sum + w, 0)
const ev = loot.reduce((sum, l) => sum + (l.weight / total) * l.value, 0)`,
    },
    {
      lang: "ts",
      caption:
        "Anti-streak tools. Never shuffle with `arr.sort(() => Math.random() - 0.5)`:",
      code: `// Every order equally likely. j must include i itself.
function fisherYates<T>(items: T[], rand: () => number) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

// Deal a whole bag before reshuffling: [crit, miss × 4] is exactly 20%.
function shuffleBag<T>(items: T[], rand: () => number) {
  let cursor = items.length
  return () => {
    if (cursor === items.length) {
      fisherYates(items, rand)
      cursor = 0
    }
    return items[cursor++]
  }
}

// Independent rolls with a guarantee on the pity-th try.
function pityRoller(p: number, pity: number, rand: () => number) {
  let misses = 0
  return () => {
    // Always draw, so the stream stays in step with or without pity.
    const hit = rand() < p || misses + 1 >= pity
    misses = hit ? 0 : misses + 1
    return hit
  }
}`,
    },
  ],
  mistakes: [
    "Using `Math.random()` for anything that must replay: it cannot be seeded, so one call in the wrong place desyncs a replay, a lockstep match or a daily seed.",
    "Shuffling with `arr.sort(() => Math.random() - 0.5)`. The comparator contradicts itself, so the order is biased and differs per engine: items tend to stay near where they started. Use Fisher-Yates.",
    "Adding chances up: 10 tries at 10% is about 65%, not 100%. Telling players otherwise, in a tooltip or a design doc, guarantees complaints.",
    "Off-by-one integer rolls: `Math.round(rand() * (n - 1))` gives the first and last values half the odds of the rest. Use `Math.floor(rand() * n)`.",
    "Assuming a bag caps droughts at one bag. Across the seam between two bags the gap can reach 2(B - k), nearly two bags, so size it from that number.",
  ],
  reading: [
    {
      title: "MDN — Math.random()",
      url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random",
    },
    {
      title: "Red Blob Games — Probability and damage rolls",
      url: "https://www.redblobgames.com/articles/probability/damage-rolls.html",
    },
    {
      title: "Mike Bostock — Will It Shuffle?",
      url: "https://bost.ocks.org/mike/shuffle/compare.html",
    },
  ],
  visual:
    "Each solid bar is one item's observed share of the seeded rolls so far: grey for the three common items, white for the rare one, and a yellow cap pulses on it at each drop. The wide green tick on each bar is its configured probability, and the bars settle onto the ticks as rolls accumulate. Below, the thick red strip is the longest drought without the rare item, the thin yellow strip the current one, with a grey mark every 20 rolls. Switch to Shuffle bag to see the red strip stop short of a tall green ceiling that pure random doesn't have, and raise the rare weight to shrink both.",
}

export default sheet
