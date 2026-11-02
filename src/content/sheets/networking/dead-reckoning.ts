import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "dead-reckoning",
  category: "networking",
  subcategory: "netcode",
  title: "Dead Reckoning and Extrapolation",
  hook: "keep guessing from the last state, and only speak up when the guess goes wrong",
  summary:
    "Extrapolate remote entities from their last state, and send an update only when the sender's copy of that guess drifts past a threshold.",
  level: "common",
  tags: [
    "netcode",
    "multiplayer",
    "extrapolation",
    "projective velocity blending",
    "bandwidth",
    "vehicles",
  ],
  updated: "2026-11-02",
  prompt:
    "Write a TypeScript dead reckoning module for remote vehicles in a Three.js multiplayer game. A shared pure function extrapolate(update, order, t) returns position and velocity at time t from an update { time, position, velocity, acceleration }, in closed form, with order 1 ignoring acceleration. The owner evaluates it every simulation tick and sends a new update when the distance to the true position exceeds a threshold, plus a heartbeat every few seconds so that lost packets and late joiners recover. The receiver stores the newest update by send time, ignores older ones, and evaluates the same function at the estimated sender time. On each new update it runs projective velocity blending for blendTime seconds: project from the drawn position with a velocity fading from old to new, then fade that projection onto the new model, landing on it exactly. A blendTime of 0 or a teleport flag snaps, and a new update during a blend restarts from the current drawn state. Write into caller-owned vectors with no per-frame allocations. Write tests that constant velocity sends one update, a lower threshold sends more, the sender's error stays within the threshold plus one tick of drift, and a blend ends exactly on the new model.",
  related: [
    "snapshot-interpolation",
    "client-side-prediction",
    "rollback-netcode",
    "lerp-and-smoothstep",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A remote entity keeps moving between packets, so instead of waiting for news the receiver extrapolates from the last known position and velocity, and optionally acceleration. The sender runs **the same model on the same update**, so it knows exactly what everyone else is guessing. While the guess stays within an error threshold it sends nothing. When the guess drifts past it, the sender sends its true state and both ends restart from there. That is the trade: a larger threshold saves bandwidth and costs accuracy. An entity moving in a straight line costs one update, however long it runs.",
    "**Corrections need hiding.** A new update usually disagrees with where the object is drawn, and snapping there shows as a pop. Projective velocity blending instead projects forward from the drawn position while fading from the old velocity to the new one, then fades that projection onto the corrected path. It ends exactly on the new model, but the object spends the blend off the best estimate, so longer blends look smoother and are less accurate.",
    "**The threshold does not bound what the receiver sees.** The sender notices the error at the threshold, then the update spends one latency in flight while the receiver keeps using the old model. Blending adds its own time on top. Latency sets a floor that no threshold can get below.",
    "**It suits motion that momentum makes predictable**: vehicles, planes and ships. It fails when direction changes faster than an update can cross the network, as with on-foot players in a shooter. [Snapshot interpolation](/networking/netcode/snapshot-interpolation) makes the opposite trade: it draws only real states, but in the past, and sends at a fixed rate whatever the entity is doing. Dead reckoning draws an estimate of now, and it is wrong at the moments the player is most likely to notice.",
  ],
  formulas: [
    {
      label: "The shared model",
      math: tex`\textcolor{#fdc700}{\hat{p}}(t) = p_0 + v_0\,\Delta t + \tfrac{1}{2}\,a_0\,\Delta t^2, \quad \Delta t = t - t_0`,
      note: "Drop the acceleration term for the position + velocity model.",
    },
    {
      label: "When the sender sends",
      math: tex`\left\lVert \textcolor{#a3a3a3}{p}(t) - \textcolor{#fdc700}{\hat{p}}(t) \right\rVert > \varepsilon`,
      note: "Checked each simulation tick against the true position p.",
    },
    {
      label: "What a snapping receiver is guaranteed",
      math: tex`\text{error} \le \varepsilon + 2s\,(L + h)`,
      note: "Position + velocity model at constant speed s, one-way latency L, tick length h. The acceleration model is not covered: it reached 1.45 times this in the same test grid.",
    },
    {
      label: "Update spacing in a steady turn",
      math: tex`T \approx \sqrt{\frac{2\varepsilon}{\lVert a \rVert}}`,
      note: "Position + velocity model. A quarter of the threshold means about twice the updates.",
    },
    {
      label: "Projective velocity blending",
      math: tex`\textcolor{#fdc700}{q} = P + (\hat{p}' - P)\,k, \quad P = q_0 + \left(v_0 + (v' - v_0)\,k\right)\tau + \tfrac{1}{2}\,a'\,\tau^2, \quad k = \frac{\tau}{T_b}`,
      note: "q0 and v0 are the drawn state when the update arrives, primes are the new model, and τ is the time since then.",
    },
  ],
  rules: [
    "All numbers here come from the deterministic lap in the visual: 8.4 s at 4 u/s, 100 ms latency, a 200 ms blend, and corner radius about 0.67 unless stated. At a 0.3 u threshold it sends 14 updates, or 1.68 per second. A fixed 10 Hz stream would send 84.",
    "Thresholds of 1, 0.6, 0.3, 0.15 and 0.05 u sent 8, 12, 14, 21 and 29 updates per lap. Pick the threshold from what the player can see at that entity's size and distance. That is a judgement call, and half the entity's width is a fair first try.",
    "**Do not chase a threshold below what latency adds.** With snapping, dropping from 0.3 to 0.05 u doubled the updates (14 to 29) and only took the peak error from 0.76 to 0.31 u. A speed of 4 u/s drifts up to 0.8 u in 100 ms, so the rest was in-flight time.",
    "Start blends at about 100–250 ms, then judge by eye. On this lap a snap jumped up to 0.74 u in one 60 Hz tick with a 0.76 u peak error. A 200 ms blend cut the largest step to 0.15 u and raised the peak to 0.90 u. A 1 s blend gave 0.12 u and 2.02 u, which is smooth but wrong for longer.",
    "**Add acceleration only for long, steady curves or real throttle changes.** Wide corners (radius up to 1.6 u) took 20 updates per lap with position + velocity and 15 with acceleration. At radius about 0.67 u that flipped to 14 and 15, with a larger largest step (0.23 against 0.15 u). With near-instant turns, both took 8.",
    "Sharp turns cost error more than bandwidth. Going from wide corners to near-instant ones took the lap from 20 updates to 8, each turn needing about one, while the peak error rose from 0.89 to 1.11 u.",
    "Add a heartbeat. With no error there are no packets, so a lost update or a late joiner would otherwise never recover. The interval is a judgement call: try a few seconds, and shorter if loss is high.",
    "Compared with snapshot interpolation on this lap: at 10 Hz with 200 ms of render delay and the same latency, an entity is drawn 1.2 u behind along the path, at all times, but always on it. Dead reckoning averaged 0.24 u off the truth and peaked at 0.90 u, with a sixth of the packets. Which is better depends on whether being late or being wrong hurts more.",
  ],
  code: [
    {
      lang: "ts",
      caption:
        "One pure model, used by both ends, in closed form so that frame rate cannot make them disagree:",
      code: `function extrapolate(u: Update, order: 1 | 2, t: number) {
  const dt = t - u.time
  const ax = order === 2 ? u.ax : 0
  const ay = order === 2 ? u.ay : 0
  return {
    x: u.x + u.vx * dt + 0.5 * ax * dt * dt,
    y: u.y + u.vy * dt + 0.5 * ay * dt * dt,
    vx: u.vx + ax * dt,
    vy: u.vy + ay * dt,
    ax,
    ay,
  }
}

// Sender, every simulation tick. Compare against its own copy of the guess.
function senderTick(now: State, t: number) {
  const guess = extrapolate(last, order, t)
  const error = Math.hypot(now.x - guess.x, now.y - guess.y)
  if (error > threshold || t - last.time > heartbeat) {
    last = { ...now, time: t }
    send(last)
  }
}`,
    },
    {
      lang: "ts",
      caption:
        "Receiver: projective velocity blending from the drawn state onto the new model:",
      code: `function blend(from: Drawn, target: Model, tau: number, duration: number) {
  if (duration <= 0 || tau >= duration) return target // snap, or finished
  const k = tau / duration
  const vx = from.vx + (target.vx - from.vx) * k
  const vy = from.vy + (target.vy - from.vy) * k
  const px = from.x + vx * tau + 0.5 * target.ax * tau * tau
  const py = from.y + vy * tau + 0.5 * target.ay * tau * tau
  return {
    x: px + (target.x - px) * k,
    y: py + (target.y - py) * k,
    vx,
    vy,
  }
}`,
    },
  ],
  mistakes: [
    "Using it for on-foot players who change direction at will. In simulation (0.3 u threshold, 100 ms latency, 200 ms blend), reversing every 250 ms across a 1 u swing took 4 updates per second and still averaged 0.79 u of error, peaking at 1.21 u. Drawing the player standing still at the centre of the swing would never be more than 0.5 u off.",
    "Applying the update at arrival instead of at its send time. Without the timestamp, the receiver sits one latency behind even on a straight road: 0.4 u at 4 u/s and 100 ms. Send the time, and estimate the clock offset as snapshot interpolation does.",
    "Stepping the model separately on each side. Integrating acceleration frame by frame gives different results at different frame rates, so the sender's copy of the guess stops matching what is drawn. Both must also use the same model order.",
    "Treating the threshold as the error that players see. Using the formula above, a 0.3 u threshold at 4 u/s and 100 ms allows up to about 1.23 u at a full reversal, and this lap's peak was 0.76 u with snapping.",
    "Letting extrapolation ignore the world. The model knows nothing about walls or the ground, so objects sink or pass through them until the next update arrives. Clamp the drawn position against collision, and flag teleports and respawns so that they snap instead of blending across the map.",
  ],
  reading: [
    {
      title:
        "Jesse Aronson — Dead Reckoning: Latency Hiding for Networked Games",
      url: "https://www.gamedeveloper.com/programming/dead-reckoning-latency-hiding-for-networked-games",
    },
    {
      title: "Gabriel Gambetta — Entity Interpolation",
      url: "https://gabrielgambetta.com/entity-interpolation.html",
    },
    {
      title: "Gaffer On Games — State Synchronization",
      url: "https://gafferongames.com/post/state_synchronization/",
    },
  ],
  visual:
    "The dashed grey line is the true path, and the hollow grey ring is the true position. The solid yellow disc with its trail is what the receiver draws. Each white tick across the path is an update sent, staying for the whole lap so you can read their density. While the error is past the threshold, a thick red bar joins the ring and the disc, and a thin red bar stays behind at the worst point. Lower the threshold for more ticks, raise the blend time to round off the pops, and raise the sharpness to see turns outrun the model.",
}

export default sheet
