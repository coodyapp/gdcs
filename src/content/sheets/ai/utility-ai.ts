import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "utility-ai",
  category: "ai",
  subcategory: "decision",
  title: "Utility AI",
  hook: "every action scores itself, the best score wins",
  summary:
    "Utility AI scores each action from normalized inputs through response curves, multiplies them and runs the winner, with a bonus to stop flip-flopping.",
  level: "common",
  tags: [
    "utility ai",
    "response curves",
    "considerations",
    "decision making",
    "ai",
  ],
  updated: "2026-11-02",
  prompt:
    "Write a utility AI module in TypeScript for agents in a Three.js game, as pure functions with no Three.js imports. `responseCurve(kind, x)` supports linear, quadratic and logistic, clamps its input to 0..1 and returns exactly 0 at 0 and exactly 1 at 1 (rescale the logistic). `compensate(s, n)` returns s + (1 - s) * (1 - 1 / n) * s. `scoreAction(considerations)` multiplies compensated scores, returns 0 as soon as any consideration is 0, and returns 0 for an empty list. `chooseBest(scores, current, bonus)` multiplies the current action's score by 1 + bonus, breaks ties toward the current action and then the lowest index, and returns -1 when all scores are 0. `pickAmongTop(scores, k, rand)` does a score-weighted pick among the k best using an injected seeded PRNG. Build one agent with Eat, Hide and Wander, deciding at 10 Hz with seeded sensor noise, and log every action's considerations and score per decision. Write Vitest tests: curves stay in range, zero vetoes, compensation leaves n = 1 unchanged and keeps 0 and 1 fixed, ties are deterministic, a bonus cannot keep a vetoed action alive, and a bonus lowers switches per minute over a seeded run.",
  related: [
    "finite-state-machine",
    "behavior-trees",
    "probability-and-weighted-random",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Instead of writing rules for when to switch, ask every action how much it wants to run right now. Each action owns a list of **considerations**: an input normalized to 0..1 (hunger, distance, health) passed through a **response curve** that sets how much it matters. Linear treats every step alike, quadratic stays quiet until the input is high, and logistic acts as a soft threshold.",
    "An action's considerations **multiply**, so a zero anywhere vetoes it: no ammo means no Shoot, however good the shot. Then run the highest score, or make a score-weighted pick among the top few so a crowd of agents does not act in lockstep. Adding an action means writing its considerations, with no [state machine](/ai/decision/finite-state-machine) edges to rewire. The price is that behaviour emerges from numbers, so tuning and debugging need tools.",
    "Multiplying has a side effect: every extra consideration below 1 lowers the score, so actions with more considerations lose to simpler ones for no design reason. The **compensation factor** raises each consideration according to how many the action has. It corrects part of that shrink, not all of it: four considerations of 0.5 multiply to 0.0625, and compensated they give 0.223, still far below 0.5. So it narrows the gap between actions with different counts without making them strictly comparable. It also favours balance: [0.95, 0.2] beats [0.43, 0.43] raw (0.190 vs 0.185) but loses once compensated (0.273 vs 0.305).",
    "Scores that sit close together cause **oscillation**: noise or a small change flips the winner, and the agent dithers without finishing anything. A **commitment bonus** multiplies the running action's score, so a rival must beat it by that margin. That is hysteresis: the switch point differs by direction. It moves where oscillation happens rather than ruling it out, so measure it. To debug, log every action's considerations and final score at each decision, count switches per minute, and replay seeded runs.",
  ],
  formulas: [
    {
      label: "Action score: considerations multiply",
      math: tex`\textcolor{#fdc700}{U_a} = \prod_{i=1}^{n} s_i, \quad s_i = \text{curve}_i(x_i) \in [0, 1]`,
      note: "Any s_i of 0 makes the whole action 0, which is the veto.",
    },
    {
      label: "Compensation for n considerations (Dave Mark)",
      math: tex`s' = s + (1 - s)\left(1 - \frac{1}{n}\right)s`,
      note: "n = 1 changes nothing; 0 and 1 stay fixed. A partial fix: 0.5 at n = 4 multiplies to 0.0625 raw and 0.223 compensated, and the product still falls as n grows.",
    },
    {
      label: "Commitment bonus: the running action defends",
      math: tex`\text{switch only if } U_{\text{rival}} > (1 + \textcolor{#fdc700}{b})\, U_{\text{current}}`,
    },
    {
      label: "Logistic curve",
      math: tex`L(x) = \frac{1}{1 + e^{-k(x - m)}}`,
      note: "With k = 10 and m = 0.5, L(0) ≈ 0.0067 and L(1) ≈ 0.9933. Rescale it if 0 must mean a veto.",
    },
  ],
  rules: [
    "Normalize inputs with explicit bookends: 0 m to 100 m maps to 0..1, and anything outside clamps. Curves only compare fairly on the same scale.",
    "Starting point for a commitment bonus: 10–25%, then tune. In this demo's defaults (20 seeds, 5 minutes each), a bonus of 0, 10%, 20% and 40% gave about 89, 33, 15 and 9 switches per minute. Your numbers depend on your noise and scores.",
    "If two actions jitter within s ± e, a bonus above (s + e) / (s − e) − 1 stops noise alone from flipping them: 16.2% for s = 0.4, e = 0.03.",
    "Compensated penalty for extra near-perfect considerations: five of 0.9 multiply to 0.59 raw and 0.87 compensated.",
    "Decide on a timer rather than every frame, and stagger agents. This demo uses 10 Hz; pick what your game's reaction time needs.",
    "With a weighted pick, keep only the top few. For scores 0.6, 0.5 and 0.1 with a top 2, the best action runs about 55% of the time and the 0.1 action never does.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Curves, compensation and scoring. A zero exits early:",
      code: `type Curve = (x: number) => number
const clamp01 = (x: number) => Math.min(1, Math.max(0, x || 0))

const linear: Curve = (x) => clamp01(x)
const quadratic: Curve = (x) => clamp01(x) ** 2
const raw = (x: number) => 1 / (1 + Math.exp(-10 * (x - 0.5)))
const logistic: Curve = (x) =>
  (raw(clamp01(x)) - raw(0)) / (raw(1) - raw(0))

const compensate = (s: number, n: number) =>
  s + (1 - s) * (1 - 1 / n) * s

function score(considerations: number[]) {
  const n = considerations.length
  let total = n ? 1 : 0
  for (const c of considerations) {
    if (!(c > 0)) return 0         // veto, also catches NaN
    total *= compensate(Math.min(c, 1), n)
  }
  return total
}`,
    },
    {
      lang: "ts",
      caption:
        "Choosing with commitment. Multiplying means a vetoed action cannot hold on:",
      code: `function chooseBest(scores: number[], current: number, bonus: number) {
  let best = -1
  let bestScore = 0
  scores.forEach((raw, i) => {
    const s = i === current ? raw * (1 + bonus) : raw
    // Ties: the current action, then the lowest index.
    if (s > bestScore || (s === bestScore && s > 0 && i === current)) {
      best = i
      bestScore = s
    }
  })
  return best                       // -1: everything was vetoed
}

// Debug: one line per decision, per action.
// t=12.3 Eat 0.30 [hunger 0.62→0.38, safety 0.48→0.48] Hide 0.52 ...`,
    },
  ],
  mistakes: [
    "Using the raw logistic and expecting a veto. It returns about 0.0067 at an input of 0 (k = 10, m = 0.5), so the action can still win when everything else is lower. Rescale it or add an explicit gate.",
    "Adding the commitment bonus instead of multiplying. A flat +0.1 lifts a vetoed action to 0.1, enough to win whenever the rest score lower, so an agent can keep trying to shoot with no ammo.",
    "Treating compensation as a full fix. More considerations still lower the score, so compare actions with very different counts by running them, and use action weights where one must outrank another.",
    "Picking a consideration that the action itself changes, such as Hide scoring on exposure. Reaching cover drops the score, the agent leaves, the score rises: a loop. If exposure hits 0 the score is 0 and a multiplied bonus cannot hold it. Score the reason to act, or add an explicit runtime rule.",
    "Tuning without seeing the numbers. Without a per-decision log of every consideration you cannot tell a bad curve from a bad input, and without a seed you cannot replay the bug.",
  ],
  reading: [
    {
      title:
        "Game AI Pro, ch. 9 — An Introduction to Utility Theory (David Graham)",
      url: "https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter09_An_Introduction_to_Utility_Theory.pdf",
    },
    {
      title:
        "Game AI Pro 3, ch. 13 — Choosing Effective Utility-Based Considerations (Mike Lewis)",
      url: "https://www.gameaipro.com/GameAIPro3/GameAIPro3_Chapter13_Choosing_Effective_Utility-Based_Considerations.pdf",
    },
    {
      title:
        "GDC 2015 — Building a Better Centaur: AI at Massive Scale (Dave Mark, Mike Lewis)",
      url: "https://www.gdcvault.com/play/1021848/Building-a-Better-Centaur-AI",
    },
  ],
  visual:
    "The white agent moves between green food (filled circle) and grey cover (outlined square) or wanders, wearing a letter for its action, while the red dashed ring grows with danger. In the bars, the winner (E, H or W) is solid yellow, the hollow yellow box is its commitment bonus, and the others are grey outlines. The plot shows the response curve with hunger (white circle) and danger (red triangle), repeated in the gauges. The strips log 30 s of decisions in lanes Eat, Hide, Wander, top to bottom, with a tall red tick per switch: the solid white strip uses your bonus and the dashed grey one uses none. Set the bonus to 0 and the top strip fills with the same dense ticks.",
}

export default sheet
