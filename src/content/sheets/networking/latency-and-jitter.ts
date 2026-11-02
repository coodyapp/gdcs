import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "latency-and-jitter",
  category: "networking",
  subcategory: "fundamentals",
  title: "Latency, RTT and Jitter",
  hook: "you can only time the round trip, and one average hides the worst of it",
  summary:
    "What latency, RTT, jitter and packet loss are, how a game measures them with echoes, how to smooth them, and why percentiles catch what a mean hides.",
  level: "core",
  tags: [
    "latency",
    "round-trip time",
    "jitter",
    "packet loss",
    "ping",
    "percentiles",
    "network simulation",
  ],
  updated: "2026-11-02",
  prompt:
    "Write a TypeScript link-quality tracker for a multiplayer game. Each outgoing packet carries a sequence number and the client's send time t1. The server echoes t1 with its receive time t2 and send time t3, and the client stamps arrival as t4. Compute rtt = (t4 - t1) - (t3 - t2). Keep SRTT and RTTVAR per RFC 6298 (first sample: SRTT = R, RTTVAR = R / 2; then alpha = 1/8, beta = 1/4, updating RTTVAR before SRTT), and jitter per RFC 3550 (J += (|D| - J) / 16, with D the difference between consecutive RTTs in arrival order, J starting at 0). Count a ping as lost if no echo arrives within 1000 ms, and ignore a late echo that arrives afterwards. Keep raw RTTs in a ring buffer over a 60 s window and expose mean, p50, p99, max and loss percent, with nearest-rank percentiles and NaN when empty. Never take a sample from a resent packet. Write tests for: the hand-computed sequence 100, 120, 80 giving SRTT 99.6875 and RTTVAR 37.5; SRTT converging to a constant input; a server clock offset leaving the RTT unchanged; and a run where a spike moves p99 far more than the mean.",
  related: [
    "snapshot-interpolation",
    "client-side-prediction",
    "rollback-netcode",
    "seeded-noise",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Four numbers describe a link. **One-way latency** is how long a packet takes to get across. **Round-trip time (RTT)** is there and back. **Jitter** is how much that time varies from packet to packet. **Packet loss** is the share that never arrives. They hurt in different ways: latency makes everything late, jitter makes it uneven, and loss leaves holes. [Client-side prediction](/networking/netcode/client-side-prediction) exists because of latency, and the buffer in [snapshot interpolation](/networking/netcode/snapshot-interpolation) exists because of jitter and loss.",
    "**A game can time the round trip but not one way.** The client stamps a packet when it leaves, the server echoes that stamp, and the client subtracts it from the time the echo arrives. Both readings come from one clock, so no clock sync is needed. A one-way time would subtract readings from two clocks, so any offset between them lands in the answer. A slow return path and a server clock running behind produce identical timestamps. `RTT / 2` is a guess that assumes the two directions match.",
    "Single RTT samples are noisy, so keep a smoothed value: an exponentially weighted moving average that moves a fixed fraction of the way to each sample. RFC 6298 gives TCP's version, using 1/8 for the average and 1/4 for its variation. RFC 3550 gives the jitter estimate used by RTP, with a gain of 1/16 on the change in transit time between packets. That estimate was defined for one-way transit, and clock offset cancels out of the difference, so jitter can be measured one way even though latency cannot. This sheet's simulation applies the same formula to RTTs.",
    "**Averages forget.** A smoothed value is meant to ignore the outlier, and a session mean spreads it across thousands of good samples, but players feel the outlier. Report percentiles and the maximum over a window alongside the average, and test with a simulated bad link instead of a clean LAN or a fixed delay.",
  ],
  formulas: [
    {
      label: "RTT from one echo",
      math: tex`\text{RTT} = (t_4 - t_1) - (t_3 - t_2)`,
      note: "t1 and t4 are on the client's clock, t2 and t3 on the server's. Each difference uses one clock, and t3 − t2 removes the time the server held the packet.",
    },
    {
      label: "Clock offset, if the path is symmetric",
      math: tex`\theta = \frac{(t_2 - t_1) + (t_3 - t_4)}{2}`,
      note: "Wrong by half the difference between the two directions, and the stamps cannot reveal that difference.",
    },
    {
      label: "Smoothed RTT and its variation (RFC 6298)",
      math: tex`\begin{aligned} V &\leftarrow \tfrac{3}{4} V + \tfrac{1}{4}\,\lvert S - \textcolor{#fafafa}{R} \rvert \\ \textcolor{#fdc700}{S} &\leftarrow \tfrac{7}{8} S + \tfrac{1}{8} \textcolor{#fafafa}{R} \end{aligned}`,
      note: "First sample: S = R and V = R / 2. V must be updated first, using the old S.",
    },
    {
      label: "Interarrival jitter (RFC 3550)",
      math: tex`J \leftarrow J + \frac{\lvert D \rvert - J}{16}, \quad D = \text{transit}_i - \text{transit}_{i-1}`,
      note: "Packets are taken in arrival order, not sequence order.",
    },
  ],
  rules: [
    "**Settling counts samples, not seconds.** SRTT closes 90% of a step in 18 samples and J takes 36. Stamping game packets at 20 Hz, that is 0.9 s and 1.8 s; with a ping once a second it is 18 s and 36 s.",
    "**Keep p50, p99 and the max, not just the mean.** In a seeded 60 s run at 20 Hz (RTT 60–80 ms), a 2 s spike of +300 ms moved the mean from 69.9 to 79.9 ms and p99 from 78 to 372 ms. p95 read only 78 ms, because the spike covered just 3.3% of samples.",
    "**A percentile has a blind spot too.** p99 ignores anything under 1% of its window. In the same run a 0.5 s spike left p99 at 79 ms while the max read 378 ms. Keep the max as well, or also use a shorter window.",
    "Smoothing hides spikes as designed. After the 2 s spike above, SRTT had peaked at 368 ms and fell back under 75 ms within 2 s of the spike ending. Use it for steering timers, and raw samples for diagnosing.",
    "**Loss compounds across legs.** A lost ping means either direction failed: `1 - (1 - p)²`, so 5% each way loses 9.75% of echoes (9.61% in a seeded 600 s run). An echo alone cannot say which direction failed.",
    "J is a typical difference, not a bound or the range. With each leg adding a uniform 0–40 ms, a seeded 600 s run read J = 18.9 ms on RTTs and about a third of the range on a single leg. Only 78% of samples fell within SRTT ± J. Size a jitter buffer from a high percentile or the range.",
    "A resend timer can start from RFC 6298's `SRTT + 4 × RTTVAR`. On the visual's default link that is about 175 ms (120 + 4 × 13.8) against a slowest possible echo of 160 ms. TCP should round up to 1 s, a floor you may want lower for game data; that is a judgement call.",
    "**Simulate in two places.** A seeded layer around your socket reproduces bugs exactly. On Linux, `tc qdisc add dev eth0 root netem delay 50ms 10ms loss 2%` gives 50 ± 10 ms on packets going out of that device, so impair both ends if you want both directions. It will reorder packets if jitter is large enough. On Windows, clumsy can lag and drop packets.",
    "Starting test profiles, as a judgement call to tune for your players (RTT, jitter, loss): good 40 ms, 5 ms, 0%; typical 100 ms, 20 ms, 1%; bad 250 ms, 50 ms, 5%. Add a spike of a few hundred ms too, because steady profiles never exercise recovery.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Read an echo and update the estimators:",
      code: `const history: number[] = [] // trim to your window
let srtt = 0, rttvar = 0, jitter = 0, prevRtt = 0, hasSample = false

function onEcho(t1: number, t2: number, t3: number, t4: number) {
  const rtt = t4 - t1 - (t3 - t2) // t3 - t2: time held by the server
  if (!hasSample) {
    srtt = rtt
    rttvar = rtt / 2
    hasSample = true
  } else {
    jitter += (Math.abs(rtt - prevRtt) - jitter) / 16
    rttvar = 0.75 * rttvar + 0.25 * Math.abs(srtt - rtt) // before srtt
    srtt = 0.875 * srtt + 0.125 * rtt
  }
  prevRtt = rtt
  history.push(rtt) // raw samples, for percentiles over a window
}

function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.ceil((p / 100) * sorted.length)
  return sorted[Math.max(rank, 1) - 1]
}`,
    },
    {
      lang: "ts",
      caption:
        "A seeded bad link around your socket, so that a failure can be replayed:",
      code: `function badLink(
  deliver: (bytes: Uint8Array) => void,
  cfg: { baseMs: number; jitterMs: number; loss: number; seed: number }
) {
  const rand = mulberry32(cfg.seed) // any seeded PRNG
  const queue: { at: number; bytes: Uint8Array }[] = []
  return {
    send(bytes: Uint8Array, now: number) {
      // Two draws per packet, so changing loss keeps the same delays.
      const delay = cfg.baseMs + rand() * cfg.jitterMs
      if (rand() < cfg.loss) return
      queue.push({ at: now + delay, bytes }) // jitter may reorder them
    },
    // Each tick: deliver whatever is due, in due order.
    flush(now: number) {
      queue.sort((a, b) => a.at - b.at)
      while (queue.length && queue[0].at <= now) deliver(queue.shift()!.bytes)
    },
  }
}`,
    },
  ],
  mistakes: [
    "Treating `RTT / 2` as measured. These two cases give identical stamps: out 30 ms, back 70 ms with synced clocks; out 50 ms, back 50 ms with the server's clock 20 ms behind. Both read RTT 100 and offset −20.",
    "Answering on the next tick without reporting the hold time. At a 30 Hz server tick that adds up to 33 ms to every RTT, and it varies with where the packet landed in the tick, so it looks like jitter too. Subtract `t3 - t2`.",
    "Showing one average. A 2 s freeze moved a one-minute mean by only 10 ms in the run above, and the player felt all of it.",
    "Timing the echo of a resent packet. You cannot tell which copy it answers, which is why RFC 6298 forbids such samples for TCP unless timestamps remove the doubt. Stamping each copy with its own send time, and echoing that stamp, also removes it.",
    "Testing with a fixed delay. Constant latency exercises almost none of what breaks: packets do not reorder, buffers never run dry, and the jitter estimate reads zero.",
  ],
  reading: [
    {
      title: "RFC 6298 — Computing TCP's Retransmission Timer",
      url: "https://www.rfc-editor.org/rfc/rfc6298.txt",
    },
    {
      title: "RFC 3550 — RTP (section 6.4.1, interarrival jitter)",
      url: "https://www.rfc-editor.org/rfc/rfc3550.txt",
    },
    {
      title: "Gaffer On Games — Reliability, Ordering and Congestion Avoidance",
      url: "https://gafferongames.com/post/reliability_ordering_and_congestion_avoidance_over_udp/",
    },
  ],
  visual:
    "Top, slowed 10×: pings leave the solid white client as filled white dots on the upper lane, and return from the outlined server as hollow rings on the lower lane. A lost one becomes a red cross. Bottom: time scrolls left, with a grey line every 50 ms from zero at the bottom. Small white dots are RTT samples, the solid yellow line is the smoothed RTT, the translucent yellow band is ± jitter, the dashed grey line is the fastest possible RTT, and red crosses along the bottom mark losses. Set jitter to 0 and the line settles onto the samples as the band collapses.",
}

export default sheet
