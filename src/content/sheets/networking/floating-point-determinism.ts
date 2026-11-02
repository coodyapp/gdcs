import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "floating-point-determinism",
  category: "networking",
  subcategory: "netcode",
  title: "Floating-Point Determinism",
  hook: "the same code on two machines, one rounding step apart, soon a different game",
  summary:
    "IEEE 754 fixes each basic operation but not what surrounds it. A one-bit difference can compound, so pick fixed-point, controlled floats or state sync.",
  level: "advanced",
  tags: [
    "floating point",
    "determinism",
    "fixed point",
    "desync",
    "ieee 754",
    "checksum",
    "netcode",
  ],
  updated: "2026-11-02",
  prompt:
    "Write a Q16.16 fixed-point module and a determinism test harness in TypeScript with no rendering. Fixed-point values are 32-bit integers holding value × 65536. Provide add, sub, mul and div: add, sub and mul wrap on overflow in two's complement, mul rounds down and builds its result from 16-bit partial products with Math.imul, div truncates toward zero and saturates by the sign of the numerator on division by zero. Build a chaotic world on it: a ball with no friction bouncing off walls and round pegs, reflecting velocity by v - 2(v·d)d/(d·d), so that no square root is needed, and rejecting pegs on each axis first so that d·d cannot overflow. Write the same step again over doubles using only + - * / and comparisons. Hash the full state, including velocity, as raw 32-bit words with FNV-1a after each step. Add a harness that runs two copies, reports the first step whose hashes differ and the first step at which they are visibly apart. Edge cases: a difference that rounds away and leaves the copies identical, negative zero, wraparound at the range limits. Write seeded tests: mul, add and sub match a BigInt oracle over 100000 random pairs, (0.1 + 0.2) + 0.3 differs from 0.1 + (0.2 + 0.3), two float copies one ulp apart split at a step you assert exactly, two fixed-point copies stay identical over 20000 steps, 256 × 256 wraps to exactly 0, and a nudge at step k is reported at exactly step k.",
  related: [
    "deterministic-lockstep",
    "rollback-netcode",
    "snapshot-interpolation",
    "fixed-timestep",
    "client-side-prediction",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "[Lockstep](/networking/netcode/deterministic-lockstep) and [rollback](/networking/netcode/rollback-netcode) send only inputs, so every machine must compute the same world, bit for bit. IEEE 754 helps with that: `+`, `-`, `*`, `/` and square root return the exact result, correctly rounded, so the same inputs and settings give the same output. But every operation rounds, which makes the **order** part of the answer: `(0.1 + 0.2) + 0.3` is `0.6000000000000001`, and `0.1 + (0.2 + 0.3)` is `0.6`. The standard says nothing about what your language and compiler do around those operations.",
    "That gap is where machines part ways. In C and C++, a compiler may **reorder** terms or keep **intermediate results** at a higher precision, depending on version and settings. It may **fuse** `a * b + c` into one operation that rounds once rather than twice: `(1 + 2⁻²⁷)(1 - 2⁻²⁷) - 1` is `0` with two roundings and `-2⁻⁵⁴` with one. **Math libraries** can return different bits for `sin`, since the standard's guarantee does not cover it. Your own code can add to this, by **iterating an unordered container** and summing in whatever order comes out.",
    "**JavaScript** closes part of the gap. Number arithmetic follows IEEE 754 doubles, with each operation rounded on its own. But the spec does not precisely specify `Math.sin`, `Math.cos`, `Math.exp`, `Math.log`, `**` or even `Math.sqrt`, so engines may disagree, and on most of these they do: see the numbers below.",
    "Once a difference exists, **chaos** amplifies it. Every bounce off a round peg multiplies the error, so in the world below a last-bit difference reaches the screen after 17 peg hits, with no error raised. There are three ways out. **Fixed-point** math replaces rounding hardware with integers that behave the same everywhere. **Controlled floats** pin compiler flags and replace library functions with your own, then test every target. Or **sync state** with [snapshots](/networking/netcode/snapshot-interpolation), which overwrite small differences and need no determinism, at the cost of more bandwidth.",
  ],
  formulas: [
    {
      label: "Every float operation rounds",
      math: tex`a \oplus b = (a + b)(1 + \varepsilon), \quad |\varepsilon| \le 2^{-53}`,
      note: "For doubles, rounding to nearest, without overflow or subnormal results. The error is tiny, but ε depends on the operands, so regrouping them changes it.",
    },
    {
      label: "Growth in a chaotic system",
      math: tex`\delta_n \approx \textcolor{#fdc700}{\delta_0}\, k^{n}, \qquad n_{\text{split}} \approx \frac{\ln(\textcolor{#ff6467}{D} / \textcolor{#fdc700}{\delta_0})}{\ln k}`,
      note: "δ₀ = starting difference, k = growth per bounce, D = visible distance. The default run took 17 peg hits to go from one ulp of velocity (2.2 × 10⁻¹⁶) to a 3-unit split, about 9× per hit. A rough fit for this one world: growth is uneven in practice.",
    },
    {
      label: "Q16.16 multiply",
      math: tex`a \otimes b = \left\lfloor \frac{a\, b}{2^{16}} \right\rfloor \bmod 2^{32}`,
      note: "a and b are integers holding value × 65536, so the range is -32768 to just under +32768 and the resolution 1/65536 ≈ 0.000015. Integers do this the same way on every machine.",
    },
  ],
  rules: [
    "Measure your own gap, because it is real. Over 1,000,000 seeded inputs in [0, 6.25), Node 26's V8 and macOS's JavaScriptCore disagreed on `Math.sin` 42,356 times, `cos` 46,686, `atan` 67,529, `log` 86,373 and `exp` 97,666, always by 1 ulp, and on `tan` 407,933 times, by up to 3 ulp. `Math.sqrt` never differed, though the spec does not promise that. That is one run on one Mac, so expect other numbers elsewhere.",
    "In JavaScript, keep the simulation to `+ - * /` and comparisons, plus `Math.sqrt` if your cross-engine tests agree. The world on this page, run in both engines above, gave identical checksums after 200,000 steps. With one `Math.sin` and `Math.cos` rotation added at each bounce, the same run first differed at step 9,424 and split visibly at step 9,932.",
    "Need a sine? Build it from basic operators and it is reproducible across engines: reduce the angle, then evaluate a polynomial. The one in this page's library is off from `Math.sin` by at most 5.7 × 10⁻⁸ over -20 to 20 and gave the same checksum in both engines over 1,000,000 inputs. Accuracy matters less here than agreement.",
    "Choose Q16.16 ranges before writing code. 256 × 256 wraps to exactly 0, and 182 × 182 comes out negative, so 181 is the largest whole number whose square fits. Reject far-away objects on each axis before computing `d·d`, as this page's step does. Move to wider integers or another split if your world does not fit: these are starting values.",
    "Expect fixed-point to cost accuracy. Rounding down is a bias, not noise: this ball lost 22% of its speed over 200,000 steps (1.4195 to 1.1019 units per step), while the float copy changed by 3 × 10⁻¹⁵. Round products to nearest or renormalize if a long-running system must conserve energy.",
    "For C and C++ floats, pin the flags and verify them. GCC's manual says `-ffp-contract=fast` is the default outside standards-compliant mode, which allows fused operations on targets that have them. Clang's default, `on`, fuses within a statement. Use `-ffp-contract=off` for cross-architecture determinism, and avoid fast-math modes. Then run every target and compare hashes, since flags do not cover library functions.",
    "Hash all of the state, by its bits, at every step you can afford. A nudge at step 100 only changes a velocity, so positions are still bit-identical when the checksum already reports step 100. In the default run the checksum differs from step 0, and the eye needs until step 550. Hash `Float64Array` words, and note that they also tell `0` from `-0`.",
  ],
  code: [
    {
      lang: "ts",
      caption:
        "Q16.16 with defined overflow, then a peg bounce with no square root:",
      code: `const fxAdd = (a: number, b: number) => (a + b) | 0 // wraps

function fxMul(a: number, b: number) {
  const ah = a >> 16, al = a & 0xffff
  const bh = b >> 16, bl = b & 0xffff
  return (
    (Math.imul(Math.imul(ah, bh), 65536) +
      Math.imul(ah, bl) +
      Math.imul(al, bh) +
      (Math.imul(al, bl) >>> 16)) | 0
  )
}

// Peg order is fixed: never iterate a hash table here.
for (let i = 0; i < pegs.length; i += 2) {
  const dx = x - pegs[i], dy = y - pegs[i + 1]
  if (Math.abs(dx) >= R || Math.abs(dy) >= R) continue // no overflow
  const d2 = fxAdd(fxMul(dx, dx), fxMul(dy, dy))
  const dot = fxAdd(fxMul(vx, dx), fxMul(vy, dy))
  if (d2 >= R2 || dot >= 0) continue
  const j = fxDiv(fxAdd(dot, dot), d2) // 2(v·d) / (d·d)
  vx = (vx - fxMul(j, dx)) | 0
  vy = (vy - fxMul(j, dy)) | 0
}`,
    },
    {
      lang: "ts",
      caption:
        "A checksum over raw bits finds the first differing step, long before a difference is visible:",
      code: `const state = new Float64Array(4) // x, y, vx, vy
const words = new Uint32Array(state.buffer)

function checksum(w: Uint32Array) {
  let h = 0x811c9dc5
  for (let i = 0; i < w.length; i++) {
    h = Math.imul(h ^ w[i], 0x01000193)
  }
  return h >>> 0
}

// After each step, on each peer, send and compare by step number.
if (theirHash[step] !== checksum(words)) reportFirstDiff(step)`,
    },
  ],
  mistakes: [
    "Testing on one machine. Two runs of the same build on one machine can agree forever and say nothing about another machine: the copies here stay identical for 20,000 steps with no starting difference. Run real cross-target tests, because a difference that exists only on another CPU, compiler or engine never shows locally.",
    "Treating a clean run as proof. In 1,000 seeded starts, a 1-ulp difference split in 804 runs (from step 393, median 859, slowest 7,960) and rounded away in the other 196, leaving the copies identical again. So desyncs can come and go with the state, and a few clean matches prove little.",
    "Expecting fixed-point to stop chaos. Integers only ensure that both machines compute the same thing. Start two fixed-point copies 1/65536 apart and they still split, at a median of step 200 over 1,000 seeds. A bad input, a skipped step or stale state still forks the world.",
    "Converting floats to fixed-point at runtime. Rounding hides most tiny differences, which is why the copies here stay equal, but a value on a rounding boundary crosses it: 1.5/65536 rounds to 2, and one ulp lower rounds to 1. Bake sine tables and constants once, at build time, and ship the integers.",
    "Forgetting overflow in the language you ship in. These `| 0` wraps are defined in JavaScript, and wrong answers still come out the same on every machine, so they desync nothing and hide everywhere. In C and C++, do not assume signed arithmetic wraps unless you ask for it, as GCC's `-fwrapv` does. Assert ranges in debug builds.",
  ],
  reading: [
    {
      title: "Bruce Dawson — Floating-Point Determinism",
      url: "https://randomascii.wordpress.com/2013/07/16/floating-point-determinism/",
    },
    {
      title: "Gaffer On Games — Floating Point Determinism",
      url: "https://gafferongames.com/post/floating_point_determinism/",
    },
    {
      title: "ECMAScript specification — the Math object",
      url: "https://tc39.es/ecma262/#sec-math-object",
    },
  ],
  visual:
    "A ball among pegs, in two copies that run the same code. Copy A is a solid white disc with a thin white trail, and copy B a yellow ring with a dashed yellow trail, started a few representable steps away. On the log-scale strip, grey bars are their distance, ticks mark every factor of 10,000, the dashed line is one ball radius, and a tall red line with a diamond marks the split, repeated as a red diamond in the arena. The lane under the bars is a thin green line while checksums match and tall red ticks while they differ. The difference is injected, because one engine's basic arithmetic cannot produce it: at 0 ulp the copies stay identical, and with fixed-point on, both starts round to one integer, so the ring keeps circling the disc and no bars appear. Each run restarts at step 800.",
}

export default sheet
