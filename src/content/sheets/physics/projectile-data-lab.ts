import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "projectile-data-lab",
  category: "physics",
  subcategory: "mechanics",
  title: "Projectile Data Lab",
  hook: "small launch errors become a spread of landing spots",
  summary:
    "Repeat a launch with a little speed error and the landings form a distribution. Mean, spread and why R ∝ v² shifts the average: the maths of weapon spread.",
  level: "common",
  tags: ["statistics", "ballistics", "uncertainty", "spread", "sampling"],
  updated: "2026-11-02",
  prompt:
    "Write a TypeScript helper for a Three.js artillery game that estimates landing spread. Inputs: launch angle (degrees), mean speed, speed error ±p%, trial count N, gravity g, and an optional seeded PRNG (otherwise use stratified quantiles (i+0.5)/N). Return ranges[], mean, standard deviation, min, max and a histogram(bins) over [min, max] with the last bin closed. Draw the trajectories with THREE.Line and the histogram as instanced boxes. Unit tests: zero error gives σ = 0; results are identical across runs; the mean range is greater than v̄²·sin2θ/g for any p > 0.",
  related: [
    "projectile-motion",
    "seeded-noise",
    "particle-system",
    "fixed-timestep",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Real launches are never identical. If the launch speed varies by ±`p`% around a mean, every shot follows the [projectile](/physics/mechanics/projectile-motion) range formula `R = v²·sin 2θ / g` with a slightly different `v`, and the landing points spread out along the ground. Collecting many trials and summarising them with a **mean** and **standard deviation** turns that scatter into two numbers you can design against.",
    "Because range grows with the **square** of speed, the error propagates nonlinearly: a +10% speed error adds about 21% range while −10% removes only 19%. The landings are skewed long, and the mean range is slightly greater than the range of the mean speed. For small errors the relative range spread is about twice the relative speed spread (`σ_R/R ≈ 2·σ_v/v`).",
    "This is exactly how weapon spread, AI aim error and throw variance behave in games. Choose the input noise (uniform, Gaussian, stratified) on purpose, check the resulting landing distribution with a quick histogram, and use a seeded or stratified sampler so tests and replays are deterministic. See also [seeded noise](/mathematics/procedural/seeded-noise).",
  ],
  formulas: [
    {
      label: "Range per trial",
      math: tex`\textcolor{#fdc700}{R_i} = \dfrac{v_i^2 \sin 2\theta}{g}`,
    },
    {
      label: "Sample mean",
      math: tex`\textcolor{#fdc700}{\bar R} = \dfrac{1}{N}\sum_{i=1}^{N} \textcolor{#fdc700}{R_i}`,
    },
    {
      label: "Standard deviation",
      math: tex`\sigma = \sqrt{\dfrac{1}{N}\sum_{i=1}^{N}(R_i - \bar R)^2}`,
    },
    {
      label: "Error propagation (small errors)",
      math: tex`\dfrac{\sigma_R}{R} \approx 2\,\dfrac{\sigma_v}{v}`,
    },
    {
      label: "Mean shift from convexity",
      math: tex`\mathbb{E}[R] = \dfrac{\sin 2\theta}{g}\left(\bar v^2 + \sigma_v^2\right)`,
    },
  ],
  rules: [
    "A uniform ±p% speed error has σ_v = p/√3 % of the mean, so ±10% gives σ_R ≈ 11.5% of range.",
    "Need ~30 trials before a sample mean is trustworthy to a few percent; the standard error shrinks as `σ/√N`.",
    "Stratified samples (one per quantile) give the same distribution every run and converge faster than pure random sampling.",
    "At 45° range is insensitive to angle error (first-order zero), but fully sensitive to speed error.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Deterministic landing spread and summary statistics:",
      code: `export function landingSpread(angleDeg: number, speed: number, spreadPct: number, runs: number, g = 9.81) {
  const s2 = Math.sin((2 * angleDeg * Math.PI) / 180)
  const ranges = Array.from({ length: runs }, (_, i) => {
    const q = (i + 0.5) / runs // stratified quantile in (0, 1)
    const v = speed * (1 + ((2 * q - 1) * spreadPct) / 100)
    return (v * v * s2) / g
  })
  const mean = ranges.reduce((a, r) => a + r, 0) / runs
  const std = Math.sqrt(ranges.reduce((a, r) => a + (r - mean) ** 2, 0) / runs)
  return { ranges, mean, std }
}

// AI grenade: aim at target, then accept if (std / mean) keeps 90% of throws inside the blast radius.`,
    },
  ],
  mistakes: [
    "Assuming symmetric input noise gives a symmetric output: R ∝ v² skews the landings long.",
    "Calling `Math.random()` inside gameplay code that must replay identically; use a seeded PRNG or stratified samples.",
    "Reporting only the mean. Players feel the spread (σ, or the worst 5%), not the average.",
    "Binning a histogram over [0, max] so all the data lands in two bars; bin over the samples' own min–max range.",
  ],
  reading: [
    {
      title:
        "OpenStax Introductory Statistics — Measures of the Spread of the Data",
      url: "https://openstax.org/books/introductory-statistics/pages/2-7-measures-of-the-spread-of-the-data",
    },
    {
      title: "OpenStax University Physics — Projectile Motion",
      url: "https://openstax.org/books/university-physics-volume-1/pages/4-3-projectile-motion",
    },
  ],
  visual:
    "The thick white arc is the mean-speed launch and the thin grey arcs are the slowest and fastest; small yellow dots mark every landing Rᵢ and the grey bars are their histogram. The thick solid yellow line is the mean landing distance R̄ and the dashed green line the ideal range at mean speed: the yellow line sits slightly beyond the green one. Raise the speed error to widen the cluster.",
}

export default sheet
