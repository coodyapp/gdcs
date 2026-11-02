import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "snapshot-interpolation",
  category: "networking",
  subcategory: "netcode",
  title: "Snapshot Interpolation",
  hook: "draw other players slightly in the past, between two known states",
  summary:
    "Render remote entities a little in the past, blending two buffered server snapshots. More delay rides out worse networks; less keeps positions fresher.",
  level: "common",
  tags: [
    "netcode",
    "multiplayer",
    "entity interpolation",
    "jitter buffer",
    "packet loss",
    "clock sync",
  ],
  updated: "2026-11-02",
  prompt:
    "Write a TypeScript snapshot interpolation buffer for remote entities in a Three.js multiplayer game. Inputs: snapshots { serverTime, position: THREE.Vector3, rotation: THREE.Quaternion } arriving over an unreliable channel, possibly reordered or lost, and a renderDelay in seconds. Keep the buffer sorted by serverTime, ignore duplicates, and drop everything older than the last snapshot at or before render time. Estimate the clock offset as the minimum of (localArrival - serverTime) over the last 2 seconds, and slew the render clock towards it rather than jumping. Each frame set renderTime = localNow - offset - renderDelay and write lerped position and slerped rotation into caller-owned objects, with no per-frame allocations. When no snapshot is newer than renderTime, report an underrun, extrapolate from the last two for at most 100 ms, then hold. Snap instead of blending when a snapshot carries a teleport flag. Write tests for exact snapshot times, the midpoint, out-of-order insertion, a lost packet in the middle, and underrun detection.",
  related: [
    "client-side-prediction",
    "rollback-netcode",
    "lerp-and-smoothstep",
    "fixed-timestep",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A server sends world state a few times a second, but the screen wants a new position every frame. Snapping to each packet looks like stutter, so the client holds snapshots in a buffer and draws remote entities at `now - delay`, [blending linearly](/mathematics/interpolation/lerp-and-smoothstep) between the two snapshots on either side of that time. Every drawn position lies between real server states.",
    "**The render delay is the price.** Remote entities appear one-way latency plus the delay behind where the server has them, which is why hitscan games often pair this with server-side lag compensation. The delay buys margin: while the next snapshot has already arrived, a late packet changes nothing the player can see, and a lost one only stretches the blend across a longer gap, which can cut corners.",
    "**A buffer that runs dry is an underrun.** Render time has passed the newest snapshot, so there is nothing to blend towards. The client must extrapolate from the last known velocity, which guesses wrong when the entity turns, or freeze. Either way, the entity pops back when data resumes.",
    "Snapshots carry server timestamps, and the client never needs the true server time. It only needs the offset between the two clocks as seen through the network: the smallest `arrival - serverTime` in a recent window. That number merges clock difference and latency, and both are what the render clock has to subtract anyway.",
  ],
  formulas: [
    {
      label: "Render clock",
      math: tex`\textcolor{#fdc700}{t_r} = t_{\text{local}} - \text{offset} - D`,
      note: "Delay D is measured from the fastest packet's arrival when offset is the minimum below.",
    },
    {
      label: "Blend between the bracketing snapshots",
      math: tex`\textcolor{#fdc700}{p} = p_a + \frac{\textcolor{#fdc700}{t_r} - t_a}{t_b - t_a}\,(p_b - p_a), \quad t_a \le \textcolor{#fdc700}{t_r} \le t_b`,
    },
    {
      label: "Delay needed for no underruns",
      math: tex`D \ge (1 + k)\,I + J`,
      note: "I = send interval, J = jitter range (slowest minus fastest packet), k = consecutive lost packets to survive. Holds at every rate and jitter tested in the simulation.",
    },
    {
      label: "Clock offset estimate",
      math: tex`\text{offset} = \min_{\text{recent}}\left(t_{\text{arrival}} - t_{\text{server}}\right)`,
    },
  ],
  rules: [
    "Size the delay from the formula, not from a fixed number of milliseconds. At 10 Hz with 30 ms jitter: 130 ms for no loss, 230 ms to survive one lost packet, 330 ms for two.",
    "**Two send intervals is a starting point, not a guarantee.** It covers jitter up to one interval with no loss, or one lost packet with no jitter, but not both. Simulated at 10 Hz, 30 ms jitter and 5% loss, one seeded 20 s run had 8 underruns at 200 ms (2 intervals), 9 at 150 ms, 137 at 100 ms and none at 330 ms.",
    "Pick the send rate with the delay in mind. Surviving one lost packet with 30 ms jitter takes 230 ms at 10 Hz, 130 ms at 20 Hz and about 97 ms at 30 Hz, at the cost of more bandwidth. Typical rates depend on the game and its budget.",
    "Allocate room for `ceil(D / I) + 1` snapshots: those ahead of the render time plus the one behind it. 250 ms at 10 Hz needs 4 slots.",
    "How many losses to survive depends on the network you expect: `k = 1` is a sensible start, and `k = 2` suits lossier links. Gaffer On Games lands on about 350 ms for a 10 Hz physics test at 2–5% loss, which is `k = 2` plus 50 ms of jitter.",
    "Keep extrapolation short and cap it. This visual allows 100 ms and then freezes; that is a choice, and fast-turning entities may want less. Extrapolation errors grow with time and ignore collisions.",
    "Re-estimate the offset over a sliding window of a few seconds, and slew the render clock towards it so that entities never jump.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Read a time-sorted buffer at the render time:",
      code: `function sample(buffer: Snapshot[], t: number) {
  const last = buffer[buffer.length - 1]
  if (!last) return { underrun: true }
  if (t > last.time) {
    // Dry: nothing newer has arrived. Coast briefly, then hold.
    const prev = buffer[buffer.length - 2] ?? last
    const dt = last.time - prev.time || 1
    const coast = Math.min(t - last.time, 0.1)
    const pos = last.pos + ((last.pos - prev.pos) / dt) * coast
    return { pos, underrun: true }
  }
  let i = 0
  while (i < buffer.length - 2 && buffer[i + 1].time <= t) i++
  const a = buffer[i]
  const b = buffer[Math.min(i + 1, buffer.length - 1)]
  const alpha = b.time > a.time ? (t - a.time) / (b.time - a.time) : 0
  return { pos: a.pos + (b.pos - a.pos) * alpha, underrun: false }
}`,
    },
    {
      lang: "pseudo",
      caption: "Receive and render loop:",
      code: `on packet(snapshot):
    window.add(localNow - snapshot.time)       // last few seconds only
    target = min(window)
    insert snapshot sorted by time, skip duplicates

each frame:
    offset += clamp(target - offset, -maxSlew * dt, maxSlew * dt)
    renderTime = localNow - offset - delay
    drop snapshots older than the last one at or before renderTime
    draw sample(buffer, renderTime)`,
    },
  ],
  mistakes: [
    "Hard-coding a delay without looking at the send rate. 100 ms is only one interval at 10 Hz: in the simulation, with 30 ms jitter and 5% loss, that gave 137 underruns in one seeded 20 s run.",
    "Ordering by arrival instead of by server timestamp. Once jitter exceeds the send interval, packets can overtake each other and the entity steps backwards.",
    "Sending snapshots over a reliable ordered channel. One lost packet then holds back the newer ones behind it, while the next snapshot would have made the retransmit unnecessary.",
    "Estimating the clock offset once at connect. Clocks drift and routes change, so the delay you chose quietly becomes a different one. Snapping to each new estimate is just as bad, because it jumps every entity.",
    "Blending across teleports and respawns. The entity slides across the map between the two snapshots, so flag these and snap instead.",
  ],
  reading: [
    {
      title: "Gaffer On Games — Snapshot Interpolation",
      url: "https://gafferongames.com/post/snapshot_interpolation/",
    },
    {
      title: "Gabriel Gambetta — Entity Interpolation",
      url: "https://gabrielgambetta.com/entity-interpolation.html",
    },
  ],
  visual:
    "Top: the dashed grey loop is the server's path and the hollow grey ring is the true position now. Dots are snapshots as they arrive: white = still buffered (largest = newest), small grey = already used, hollow grey = lost. The solid yellow disc with its trail is what the client draws. Bottom: time scrolls left from the white 'now' bar, the yellow bar is the render time, the thick yellow span marks the two snapshots being blended, and the shaded box is the buffer. An underrun turns the disc into a red cross and leaves a red cross on the path and a red band on the strip. The default run has one, from a double loss about 13 s in. Drop render delay below about two send intervals to see many.",
}

export default sheet
