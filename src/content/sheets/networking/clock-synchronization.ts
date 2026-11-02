import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "clock-synchronization",
  category: "networking",
  subcategory: "netcode",
  title: "Clock Synchronization",
  hook: "read the server's clock through four timestamps, then ease towards it",
  summary:
    "Estimate the server's clock on the client from ping timestamps, trust the lowest-RTT samples, and slew game time so it never jumps backwards.",
  level: "common",
  tags: [
    "clock sync",
    "NTP",
    "clock offset",
    "clock drift",
    "slewing",
    "monotonic clock",
    "netcode",
  ],
  updated: "2026-11-02",
  prompt:
    "Write a TypeScript clock synchronizer for a multiplayer game client. Each ping carries the client's send time t1, the server fills in receive time t2 and send time t3, and the client stamps arrival t4, using performance.now() for all client readings. Compute offset = ((t2 - t1) + (t3 - t4)) / 2 and rtt = (t4 - t1) - (t3 - t2). Keep the last 8 samples and target the offset of the one with the lowest RTT, with the newest winning a tie. Expose gameTime(local) = local + offset. Set the offset directly on the first sample and when the target differs by more than 250 ms; otherwise each frame set rate = clamp((target - offset) * 1 per second, -5%, +5%) and add rate * dt to the offset. Do not use Date.now anywhere. Write tests for: an exact offset with equal legs and a nonzero server hold time; an error of exactly half the leg difference when out and back differ; game time rising on every frame over a seeded run with exponentially distributed queueing delay; the lowest-RTT pick having a smaller RMS error than the mean of the same window on that run; and tracking a 100 ppm drift within a bound you measure.",
  related: [
    "latency-and-jitter",
    "snapshot-interpolation",
    "client-side-prediction",
    "lag-compensation",
    "rollback-netcode",
    "deterministic-lockstep",
    "fixed-timestep",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Client and server clocks start at unrelated values and tick at slightly different rates. [Timing a round trip](/networking/fundamentals/latency-and-jitter) needs no shared clock, and [snapshot interpolation](/networking/netcode/snapshot-interpolation) can use one number that merges clock difference with latency. Other jobs need the server's actual time: starting a countdown together, stamping [inputs](/networking/netcode/client-side-prediction) with the tick they belong to, or timing a shot for [lag compensation](/networking/netcode/lag-compensation). So the client keeps an estimate of the **offset**: server time minus client time.",
    "**Four timestamps give the offset, if the path is symmetric.** The client stamps t1 and t4, the server stamps t2 and t3. Averaging the two one-way readings cancels the delays only when they match. If they differ, half the difference lands in the offset, and the stamps cannot show it: a slower outbound leg and a server clock further ahead produce the same numbers. Filtering cannot remove that error either. It stays as a constant bias, shared by everything on that client.",
    "**Trust the fastest samples.** Queueing only adds delay, so a low RTT means the packet met little queueing on either leg, leaving less room for error: a sample can be wrong by at most half its RTT above the fastest possible. NTP's clock filter works this way, keeping eight samples and sorting them by delay. Choose by RTT, not by offset, because the true offset is the unknown.",
    "**Never run game time directly from the estimate.** Keep `gameTime = local + offset`, where `local` comes from a monotonic source, and move the offset gradually: run the game clock slightly fast or slow until it catches up. That is **slewing**, and it keeps time rising. Replacing the offset outright is **stepping**, which can jump time backwards, so save it for connecting and for errors too large to slew. Keep measuring, because clocks **drift** apart, and take every game timestamp from this one clock so that nothing compares readings from two.",
  ],
  formulas: [
    {
      label: "Offset (server minus client)",
      math: tex`\textcolor{#fdc700}{\theta} = \frac{(t_2 - t_1) + (t_3 - t_4)}{2}`,
      note: "t1 and t4 are on the client's clock, t2 and t3 on the server's. Server time ≈ client time + θ.",
    },
    {
      label: "Round-trip time",
      math: tex`\text{RTT} = (t_4 - t_1) - (t_3 - t_2)`,
      note: "t3 − t2 removes the time the server held the packet.",
    },
    {
      label: "Error from an asymmetric path",
      math: tex`\textcolor{#ff6467}{\varepsilon} = \textcolor{#fdc700}{\theta} - \textcolor{#a3a3a3}{\theta_{\text{true}}} = \frac{d_{\text{out}} - d_{\text{back}}}{2}`,
      note: "Exact in every simulated exchange with no drift. Positive puts the game clock ahead of the server.",
    },
    {
      label: "Limit on a sample's error, with equal fixed delays",
      math: tex`\lvert \textcolor{#ff6467}{\varepsilon} \rvert \le \frac{\text{RTT} - \text{RTT}_{\min}}{2}`,
      note: "Why a low RTT earns trust. A difference in the fixed delays adds to this, and no RTT reveals it.",
    },
    {
      label: "Slewing the game clock",
      math: tex`\frac{d\,\text{game}}{d\,\text{local}} = 1 + r, \quad r = \operatorname{clamp}\!\left(k\,(\textcolor{#fdc700}{\theta} - \text{offset}),\, -r_{\max},\, r_{\max}\right)`,
      note: "With the cap below 100%, game time always rises.",
    },
  ],
  rules: [
    "**Keep about eight samples and target the lowest RTT.** With queueing delay (exponential, averaging 20 ms per leg), a seeded 10-minute run at 5 Hz gave an RMS error of 13.3 ms using each raw sample, 4.91 ms using the mean of the last 8, and 3.47 ms using their lowest-RTT sample. The worst single reading did not improve: 18.3 ms for the mean and 20.0 ms for the lowest RTT, so slewing still matters.",
    "**The advantage depends on delay being skewed.** With uniform jitter the same run reversed: 3.02 ms for the mean and 5.34 ms for the lowest RTT. The filter earns more when one direction queues more. Adding an average 40 ms to the outbound leg, as a busy uplink would, biased the mean by +19.05 ms and the lowest-RTT pick by only +1.39 ms.",
    "**Slew at a capped rate.** As a starting point to tune, this sheet uses a gain of 1 per second and a cap of 5%. That closes a 20 ms error to within 1 ms in about 3 s, and a 200 ms error in about 7 s. Slewing also smooths: in the run above, the same filter gave 1.99 ms RMS slewed and 3.42 ms stepped.",
    "**Step only for large errors.** This sheet steps at 250 ms, a judgement call: a step can be forwards or backwards, so do it on connect or behind a loading screen when you can. NTP's own step threshold is 125 ms.",
    "**Plan for drift, and measure the lag it causes.** RFC 5905 takes 15 ppm as a typical frequency tolerance and allows up to 500 ppm. 100 ppm means 6 ms a minute. Read once at connect, that offset would be 60 ms out after 10 minutes. With one ping a second and 20 ms of queueing, the slewed clock stayed within 9.9 ms in a seeded 10-minute run, and 15 ms across four seeds, with 3.2 ms RMS. Nearly all of that is jitter: with none, the same drift stayed within 0.41 ms.",
    "The tracking lag is about `drift × (window / 2 + 1 / gain)`. At an exaggerated 1000 ppm and 20 ms of queueing, the mean error was −5.15 ms at 1 Hz (8 s window) and −1.83 ms at 5 Hz (1.6 s window). Faster pings shrink the window, at the cost of bandwidth.",
    "**Read a monotonic clock.** `performance.now()` never decreases, while `Date.now()` follows clock adjustments. Natively use `CLOCK_MONOTONIC`, which unlike `CLOCK_REALTIME` has no discontinuous jumps. MDN notes that `performance.now()` appears to keep ticking during sleep only on Windows, so re-sync after a device wakes or a tab resumes.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Read an echo and choose the target from the recent samples:",
      code: `type Sample = { offset: number; rtt: number }
const samples: Sample[] = []
let target: number | null = null

function onEcho(t1: number, t2: number, t3: number, t4: number) {
  const offset = (t2 - t1 + (t3 - t4)) / 2
  const rtt = t4 - t1 - (t3 - t2)
  samples.push({ offset, rtt })
  if (samples.length > 8) samples.shift()

  let best = samples[0]
  for (const s of samples) if (s.rtt <= best.rtt) best = s // newest wins a tie
  target = best.offset
}`,
    },
    {
      lang: "ts",
      caption: "A game clock that slews, and steps only when it must:",
      code: `const MAX_SLEW = 0.05 // run at most 5% fast or slow
const GAIN_PER_MS = 1 / 1000 // each second closes most of the gap
const STEP_MS = 250
let offset: number | null = null
let lastLocal = performance.now()

function gameTime(): number {
  const local = performance.now() // monotonic, never Date.now()
  const dt = local - lastLocal
  lastLocal = local
  if (target !== null) {
    if (offset === null || Math.abs(target - offset) > STEP_MS) {
      offset = target // on connect, or too far out to slew
    } else {
      const wanted = (target - offset) * GAIN_PER_MS
      offset += Math.min(MAX_SLEW, Math.max(-MAX_SLEW, wanted)) * dt
    }
  }
  return local + (offset ?? 0)
}`,
    },
  ],
  mistakes: [
    "Stepping on every estimate. In a seeded 10-minute run at 5 Hz, game time jumped backwards 321 times with the filter (up to 24 ms) and 1473 times without it (up to 73 ms). Slewing the same samples gave none.",
    "Expecting a filter to fix asymmetry. With a 30 ms difference between the legs and no jitter, the clock settles exactly 15 ms out, and a lower RTT cannot help because every sample shares that bias. Only a path that is measured another way would reveal it.",
    "Filtering on the offset itself. The minimum that suits [snapshot interpolation](/networking/netcode/snapshot-interpolation) is wrong here: it picks the most negative queueing error, and the run above read −19.26 ms on average. A median is unbiased but only reached 4.37 ms RMS, against 3.47 ms for the lowest RTT.",
    "Reading the clock with `Date.now()`. A user or NTP changing the system clock then looks like a sudden network event, and it can move time backwards. Stamps must be monotonic even though the estimate on top is slewed.",
    "Mixing clocks. A cooldown timed on the local clock and a server event timed on the synced clock disagree by the whole offset. Convert at the boundary and keep game logic on one timeline.",
  ],
  reading: [
    {
      title:
        "RFC 5905 — NTPv4 (on-wire protocol, clock filter, step threshold)",
      url: "https://www.rfc-editor.org/rfc/rfc5905.txt",
    },
    {
      title: "MDN — Performance.now()",
      url: "https://developer.mozilla.org/en-US/docs/Web/API/Performance/now",
    },
    {
      title: "Linux man-pages — clock_gettime(2)",
      url: "https://man7.org/linux/man-pages/man2/clock_gettime.2.html",
    },
  ],
  visual:
    "Top, slowed 5×: two tapes scroll left past a white 'now' bar. The outlined grey tape is the server's clock, and the solid yellow one is the client's estimate. Ping exchanges cross between them, solid white going out and darker grey coming back. A red bar on the yellow tape shows how far its marks sit from the server's. Bottom: small white dots are raw offset samples, the yellow ring is the sample the filter is using, the solid yellow line is the estimate, and the dashed grey line is the true offset. A red bar at the right edge shows the gap between those last two. Set asymmetry to 0 to close the gap, and pick a step mode to see the line jump, with a red cross for each backward jump. Drift is exaggerated: real clocks are far closer.",
}

export default sheet
