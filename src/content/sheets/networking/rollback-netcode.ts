import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "rollback-netcode",
  category: "networking",
  subcategory: "netcode",
  title: "Rollback Netcode",
  hook: "guess the other player, then rewrite the past when you were wrong",
  summary:
    "Peers swap only inputs and run the same deterministic sim. Each guesses the remote input, then rewinds and re-simulates when the real one arrives.",
  level: "advanced",
  tags: [
    "rollback",
    "netcode",
    "prediction",
    "determinism",
    "input delay",
    "peer to peer",
    "desync",
  ],
  updated: "2026-11-02",
  prompt:
    "Write a rollback netcode core in TypeScript with no rendering. Inputs: a pure `step(state, inputs)` over integer state, save/load of that state, and a `receive(frame, input)` callback. Each tick: sample the local input for `frame + inputDelay`; for the remote player use the real input if it has arrived, otherwise repeat the newest known one (neutral before any arrive). When a real input contradicts the one a past frame used, load the state saved before that frame and re-simulate up to the present within the same tick, then simulate the new frame. Save a state for every simulated frame, including re-simulated ones, and discard states older than the newest fully confirmed frame. Stop advancing, and wait, when the unconfirmed window exceeds `maxRollback`. Hash only confirmed states and compare the hashes between peers to report the first desynced frame. Keep sounds and particles out of `step`. Edge cases: delay at or above latency (no rollback at all), several changes inside one window, the first frames before any remote input exists. Write a seeded test: after every tick the state must equal a fresh simulation of the inputs known by then, and a run with correct predictions must re-simulate nothing.",
  related: [
    "client-side-prediction",
    "snapshot-interpolation",
    "fixed-timestep",
    "input-buffering",
    "frame-budget",
    "deterministic-lockstep",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Peers send each other **only inputs**, never state. Both run the same deterministic simulation, so the same inputs produce the same world. The catch is that the remote input for the current frame has not arrived yet, because it is still in flight.",
    "Rather than wait, each peer **predicts** the missing input, usually by repeating the last one it received, and keeps playing. When the real input arrives and disagrees, the peer restores the state it saved before that frame, re-simulates forward to the present with the corrected input, and shows the result, all within a single tick. If the guess was right, nothing happens.",
    "**Input delay** is the other half. Holding your own input back by a few frames gives it time to reach the other peer before its frame comes up, which shrinks the rollback window, but every delay frame is added lag on your own controls. So the design choice is how to split latency between lag you feel on every press and corrections you see only when a prediction fails. Both need a [fixed timestep](/systems/simulation/fixed-timestep), since frames must mean the same thing on both machines.",
    "Everything depends on **determinism**: a single differing bit can grow into two different games with no error raised. So peers compare **checksums** of states whose inputs are all confirmed, and a mismatch reveals a desync at the frame where it first shows.",
  ],
  formulas: [
    {
      label: "Rollback window",
      math: tex`\textcolor{#fdc700}{W} = \max(0,\; L - D)`,
      note: "L = one-way latency, D = input delay, both in frames. Assumes steady latency and peers ticking in step. This is also the depth of every rollback.",
    },
    {
      label: "Re-simulation load",
      math: tex`\textcolor{#ff6467}{R} = c \cdot \textcolor{#fdc700}{W}`,
      note: "R = re-simulated frames per second, c = remote input changes per second. Repeat-last prediction misses every change, and a right guess costs nothing.",
    },
    {
      label: "Worst single tick",
      math: tex`t_{\text{step}} \le \frac{t_{\text{frame}}}{1 + \textcolor{#fdc700}{W}}`,
      note: "One new frame plus W repeats must fit in one frame's time, before rendering takes its share.",
    },
  ],
  rules: [
    "Convert latency to frames first: 100 ms one-way at 60 Hz is 6 frames, so 1 frame of delay leaves rollbacks 5 frames deep.",
    "Delay above latency buys nothing. Rollbacks are already gone at `D = L`, and every extra frame is only lag.",
    "Try 1–3 frames of input delay at 60 Hz (17–50 ms) as a first test, then tune by playing. It depends on the game: GGPO's guide says many fighting-game players notice more than 1 frame, while board or puzzle games may get away with 4–5.",
    "Budget for the worst tick, not the average. Rolling back 8 frames at 60 Hz means 9 steps in 16.67 ms, so at most 1.85 ms per step with nothing left for rendering. Measure on your slowest target.",
    "Cap the window and stop when it is exhausted, because latency can exceed what you can afford to re-simulate. GGPO's `GGPO_MAX_PREDICTION_FRAMES` is 8, and it refuses to advance past that until inputs arrive.",
    "Each simulated frame needs a saved state, so a rollback of depth W also costs W saves. Keep at least W + 1 states, and keep game state flat and small so that saving is a cheap copy.",
    "Hash only confirmed frames, and send the hash every so often, for example once or twice per second. Add a test mode that forces a rollback every frame and compares hashes: it finds many determinism bugs with no network, though not differences between machines.",
  ],
  code: [
    {
      lang: "ts",
      caption:
        "One tick. `arrived(f)` is the real input, or undefined if it is still in flight:",
      code: `function tick(frame: number) {
  // 1. Did a real input contradict what a past frame used?
  const wrong = firstMismatch(confirmed + 1, frame, arrived, used)
  if (wrong !== null) {
    state = saved[wrong] // restore
    for (let f = wrong; f < frame; f++) simulate(f) // redo, no rendering
  }
  // 2. Simulate the new frame, and show it.
  simulate(frame)
  render(state)
  // 3. Forget what can no longer be rolled back.
  confirmed = advanceConfirmed(confirmed, frame, arrived)
  dropSavesUpTo(confirmed)
}

function simulate(f: number) {
  saved[f] = state
  used[f] = arrived(f) ?? newestArrivedInput() // predict: repeat the last
  state = step(state, localInputs[f], used[f]) // pure, no sounds or effects
}`,
    },
    {
      lang: "pseudo",
      caption: "Desync check, on confirmed frames only:",
      code: `if frame is confirmed and frame % 30 == 0:
    send(frame, hash(stateAfter(frame)))

on receive(frame, theirHash):
    if theirHash != myHashes[frame]:
        report desync at or before frame   // dump both states, inputs`,
    },
  ],
  mistakes: [
    "Saving only part of the game state. Leave out the PRNG seed, a timer or a cooldown and restoring no longer rebuilds the same world, so the peers drift apart even though each one's step function is fine.",
    "Playing sounds or spawning particles inside the step. A re-simulated frame fires them again, so defer effects until the rollback ends, and cancel any whose cause was undone.",
    "Assuming floats are safe because the code is the same. Compilers, OSes and instruction sets can round differently; in JavaScript `Math.sin` and friends may differ between engines. Unordered iteration and wall-clock time break determinism too. Fixed-point math is the usual way out for cross-platform play.",
    "Comparing checksums of the current frame. Peers legitimately differ while they are predicting, so this reports false desyncs. Compare frames whose inputs are all confirmed.",
    "Taking the depth formula as a guarantee. It assumes steady latency and peers on the same frame. Late packets deepen individual rollbacks, and a peer running k frames ahead rolls back k frames deeper while the other rolls back k less, so measure real depth and slow the peer that is ahead.",
  ],
  reading: [
    {
      title: "GGPO — Rollback networking SDK for peer-to-peer games",
      url: "https://www.ggpo.net/",
    },
    {
      title: "Gaffer On Games — Deterministic Lockstep",
      url: "https://gafferongames.com/post/deterministic_lockstep/",
    },
    {
      title:
        "GDC talk — 8 Frames in 16ms: Rollback Networking in Mortal Kombat and Injustice 2",
      url: "https://www.youtube.com/watch?v=7jb0FOcImdg",
    },
  ],
  visual:
    "A 60 Hz simulation in slow motion. On the strip, solid grey cells are confirmed frames, hollow yellow dashed cells are predicted, tall solid red cells were just re-simulated (a short red bar stays under them), white ticks mark real input changes and grey stubs right of the white line are local inputs waiting out their delay. On the lower lane, the solid white square is the true position and the yellow dashed outline is what this peer shows; a red bar marks each snap. Raise input delay to latency and all the yellow goes away.",
}

export default sheet
