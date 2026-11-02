import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "client-side-prediction",
  category: "networking",
  subcategory: "netcode",
  title: "Client-Side Prediction",
  hook: "move now, let the server correct you later",
  summary:
    "Apply your input at once, keep it numbered, then replay every unacknowledged input on each server state: instant controls, and the server stays in charge.",
  level: "common",
  tags: [
    "netcode",
    "multiplayer",
    "reconciliation",
    "latency",
    "sequence numbers",
    "authoritative server",
  ],
  updated: "2026-11-02",
  prompt:
    "Add client-side prediction with server reconciliation to my TypeScript multiplayer game. Write one pure `simulate(state, input, dt)` used by both client and server, at a fixed tick. Client: each tick, build `{ seq, buttons }`, apply it locally, push it to a `pending` array and send it (repeat the last 3 unacknowledged inputs in each packet). Server: apply each input once, in seq order, and broadcast `{ state, lastProcessedSeq }`. On receiving a state: drop pending inputs with seq <= lastProcessedSeq, reset the full simulated state (position, velocity, grounded, cooldowns) to the server's, and replay what is left, with sounds and particles disabled. Keep a render-only error offset equal to oldPredicted - newPredicted that decays with a 60 ms half-life, and snap when the error is larger than a configurable teleport threshold. Handle: duplicate or out-of-order states (ignore older acks), a capped pending buffer, zero pending inputs. Write tests: agreement reproduces the prediction exactly, a server offset is carried into the replayed position, acknowledged inputs are dropped.",
  related: [
    "snapshot-interpolation",
    "rollback-netcode",
    "fixed-timestep",
    "input-buffering",
    "delta-time",
    "latency-and-jitter",
    "lag-compensation",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "With an authoritative server, a naive client sends its input and waits for the result, so every key press shows up a full round trip later. **Client-side prediction** removes that wait: the client runs the same movement code on its input straight away and shows the outcome, on the bet that the server will agree.",
    "The bet needs bookkeeping. Each input gets a **sequence number** and stays in a pending list. Every server state says which input it has processed last, and that state is already old when it arrives, so comparing it with the current client position would always look wrong. **Reconciliation** does this instead: drop the acknowledged inputs, rewind to the server's state, and replay the remaining inputs on top. If the two sides agree, the replay lands exactly where the client already was and nothing visible happens.",
    "If they disagree, say the server applied a shove the client could not know about, the replay carries the difference forward and the client moves. Snapping there looks like a glitch, so many games hide small corrections by rendering the player at `predicted + error`, with `error` fading to zero. That offset is display only and never goes back into the simulation.",
    "This covers what you control. Other players' inputs are not known ahead of time, so they are usually drawn with [snapshot interpolation](/networking/netcode/snapshot-interpolation). Games that rewind the whole world to absorb late inputs use [rollback](/networking/netcode/rollback-netcode). Replays are far simpler with a [fixed timestep](/systems/simulation/fixed-timestep), because each input then means the same amount of simulated time on both sides.",
  ],
  formulas: [
    {
      label: "Reconciled position",
      math: tex`\textcolor{#fdc700}{x_{\text{pred}}} = \textcolor{#ff6467}{x_{\text{ack}}} + \sum_{i=\text{ack}+1}^{n} f(u_i)`,
      note: "Server state at the acknowledged input, plus a replay of every newer input.",
    },
    {
      label: "Lag prediction hides",
      math: tex`\textcolor{#ff6467}{\Delta x} = v \cdot \text{RTT}`,
      note: "A received state trails by at least this much: 3.5 u/s at 300 ms RTT is 1.05 u, as in the visual.",
    },
    {
      label: "Fading a correction",
      math: tex`e(t) = e_0 \cdot 2^{-t / h}`,
      note: "Render at predicted + e(t). With half-life h = 60 ms, about 3% of the error is left after 300 ms.",
    },
  ],
  rules: [
    "Buffer size: pending inputs ≈ RTT ÷ input interval, plus up to one state interval. At 60 Hz input and 200 ms RTT that is 12, reaching 14 with states sent at 20 Hz.",
    "Prediction hides a delay of at least one RTT: at 200 ms that is 12 frames at 60 fps.",
    "Replay cost scales with latency: 12 pending inputs × 20 states a second is 240 extra simulation steps a second. Keep the predicted step cheap, and predict only what you need.",
    "Start with a correction half-life near 60 ms and tune by feel. Above a teleport threshold, snap instead of blending; a start is whatever distance the player could not cover in about 1/4 s.",
    "On an unreliable transport, repeat recent unacknowledged inputs in each packet. If every packet carries the last 3 inputs, an input survives 2 lost packets in a row.",
    "Cap the buffer at what you are willing to replay, such as 1 s of input (60 entries at 60 Hz), and treat overflow as a connection problem.",
    "A 16-bit sequence number wraps after about 18 minutes at 60 Hz. Use 32 bits or a wrap-aware comparison.",
  ],
  code: [
    {
      lang: "ts",
      caption: "The client's half: predict, remember, reconcile.",
      code: `const pending: Input[] = []
let seq = 0

function clientTick(buttons: Buttons) {
  const input = { seq: ++seq, buttons }
  simulate(player, input, TICK)   // same code the server runs
  pending.push(input)
  send(input)
}

function onServerState(msg: { state: PlayerState; ack: number }) {
  while (pending.length && pending[0].seq <= msg.ack) pending.shift()

  const before = player.x
  player.copy(msg.state)          // all of it: velocity, grounded, cooldowns
  for (const input of pending) simulate(player, input, TICK)

  visualError += before - player.x // zero when the server agreed
}`,
    },
    {
      lang: "ts",
      caption:
        "Render-only smoothing. `simulate` above never reads `visualError`.",
      code: `function render(dtMs: number) {
  visualError *= 0.5 ** (dtMs / HALF_LIFE_MS)
  if (Math.abs(visualError) > TELEPORT) visualError = 0 // snap
  mesh.position.x = player.x + visualError
}`,
    },
  ],
  mistakes: [
    "Comparing the latest server position with the current client position. The server's state is from the past, so they differ while moving even when nothing is wrong. Compare only through the acknowledged sequence number, by replaying.",
    "Restoring only the position before replaying. Velocity, grounded state, cooldowns and anything else the step reads must rewind too, or every replay diverges.",
    "Firing sounds, particles or spawns during replay. A replay re-runs old inputs, so one jump can play its sound again with every state. Trigger one-shot effects on first prediction only, or from server events.",
    "Feeding the smoothed position back into the simulation. The next input then starts from a position neither side agrees on, and the error may never settle.",
    "Client and server stepping with different `dt` or tuning values. Prediction then misses a little on every input, and the player sees a constant stream of corrections.",
  ],
  reading: [
    {
      title:
        "Gabriel Gambetta — Client-Side Prediction and Server Reconciliation",
      url: "https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html",
    },
    {
      title:
        "Gaffer On Games — What Every Programmer Needs To Know About Game Networking",
      url: "https://gafferongames.com/post/what_every_programmer_needs_to_know_about_game_networking/",
    },
  ],
  visual:
    "Three lanes share one scripted input, with latency exaggerated so the gaps are easy to see. Top: the predicted client, a solid yellow disc, with white dots for each pending input. Middle: the server, a grey outline. Bottom: the newest state received, a dashed red outline, which is all you would see without prediction. Dashes measure each one's lag behind the yellow line. A push the client cannot foresee draws a solid red bar over the top lane, sized to the correction. Turn prediction off and the red marker fills in; turn smoothing off and the yellow disc snaps.",
}

export default sheet
