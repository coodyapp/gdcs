import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "lag-compensation",
  category: "networking",
  subcategory: "netcode",
  title: "Lag Compensation",
  hook: "rewind the server to what the shooter saw, test the shot, come back",
  summary:
    "Shooters aim at a target drawn in the past. The server keeps a short hitbox history, rewinds to the moment they saw, tests the shot there and returns.",
  level: "advanced",
  tags: [
    "netcode",
    "multiplayer",
    "hit registration",
    "hitscan",
    "server rewind",
    "peeker's advantage",
  ],
  updated: "2026-11-02",
  prompt:
    "Write server-side lag compensation in TypeScript for a hitscan shooter using Three.js math types. Each server tick, store every player's hitbox position in a ring buffer sized as ceil(maxRewind * tickHz) + 2. On a shot command { viewTime, origin, direction }, compute rewind = now - viewTime and clamp it to at most min(measuredRtt + interpDelay + tolerance, maxRewind) and at least 0, so that a forged timestamp cannot reach further back than the measured latency explains. Blend linearly between the two stored ticks around now - rewind into a scratch box, without changing live state or allocating per shot. Test the ray against those scratch boxes, take the origin from the server's own record of the shooter, and return the nearest hit. Skip teleports: snap instead of blending across a tick pair flagged as a teleport. Write tests for blending at the midpoint between ticks, a shot aimed at the seen position that hits with the rewind and misses without it, a rewind over the cap that clamps, a forged old timestamp, and a timestamp from the future.",
  related: [
    "snapshot-interpolation",
    "client-side-prediction",
    "hitbox-hurtbox",
    "rollback-netcode",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "With [client-side prediction](/networking/netcode/client-side-prediction) you see yourself in the present, but you see everyone else in the past, because [snapshot interpolation](/networking/netcode/snapshot-interpolation) draws them from buffered states. Aim perfectly at a running target and you are aiming at where it used to be. If the server tested the shot against the target's current position, it would miss, and you would have to lead every moving target by an amount that changes with your ping.",
    "**So the server rewinds.** It keeps a short history of hitboxes, one set per tick. When a shot arrives, it works out what the shooter was looking at, blends the two stored ticks around that moment, tests the ray against those positions, and then carries on as though nothing moved. The live world never changes.",
    "**The delay has two trips in it.** On the shooter's screen the target is one-way latency plus the interpolation delay old. The shot then takes another one-way trip to reach the server, and the target keeps moving meanwhile. By the time the server runs the test, the gap is the full round trip plus interpolation.",
    "**Someone pays for it.** The rewind favours the shooter, so the victim can be shot after reaching cover on their own screen. A cap limits how much of that a very laggy player can cause. Everything stays on the server's side of the line: the client may say when it fired and where it aimed, but the server decides the rewind, from its own measurements and its own history.",
  ],
  formulas: [
    {
      label: "Total delay when the shot reaches the server",
      math: tex`\Delta = \text{RTT} + D_{\text{interp}}`,
      note: "On screen when fired it is one-way down plus interpolation. The trip up adds the remaining half of the round trip.",
    },
    {
      label: "Test time, with the rewind capped",
      math: tex`t_{\text{test}} = t_{\text{now}} - \min(\Delta,\ \Delta_{\max})`,
    },
    {
      label: "Gap between what was seen and the server's present",
      math: tex`\textcolor{#fdc700}{d} = v\,\Delta`,
      note: "This is also how far a victim can have moved before being hit: 1.25 u at 5 u/s and 250 ms.",
    },
    {
      label: "How long the holder has to react (peeker's advantage)",
      math: tex`R_{\text{holder}} < R_{\text{peeker}} - \text{RTT}_{\text{holder}} - B_{\text{server}} - B_{\text{client}}`,
      note: "B = time data sits in buffers. The peeker's own latency cancels, because their move and their shot take the same road to the server.",
    },
  ],
  rules: [
    "Size the history from the cap: `ceil(maxRewind × tickHz) + 2` ticks per entity. 250 ms needs 17 at 60 Hz and 10 at 30 Hz.",
    "Blend between ticks rather than picking the nearest. The shooter saw an interpolated position, and at 5 u/s and 30 Hz the nearest tick is up to 0.083 u off (half a tick of travel, 0.042 u at 60 Hz).",
    "Pick the cap from your own players' latency. **Judgement call:** start around 200–300 ms, then tune it so that most players in a region stay under it. Riot describes tuning its limits this way, noting that a player at 500 ms could otherwise kill you half a second after you moved behind cover.",
    "Past the cap, players must lead by `v × (Δ − cap)`. In this lane (5 u/s, 0.8 u box), hits start to fail at 100 ms over the cap, and at 500 ms total with a 250 ms cap all shots miss.",
    "Without compensation, this lane starts missing at 123 ms of total delay and misses every shot from 150 ms. That threshold depends on target speed and hitbox size, so a slow target or a wide box hides the bug in testing.",
    "Measure peeker's advantage with the formula. It matches Riot's published figures for its own setup: 35 ms round trip, a 128 Hz server (2 frames buffered) and a 60 FPS client (3 frames) give about 101 ms, which is Riot's ~141 ms baseline minus the ~40 ms it reports saving, and 144 FPS gives about 71 ms. Lag compensation does not cause this, and a rewind cannot remove it. Lower latency and less buffering are what shrink it.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Blend the stored ticks around the rewound time:",
      code: `function sampleHistory(h: Tick[], time: number, out: Point) {
  let a = h[0]
  let b = h[h.length - 1]
  if (time <= a.time) b = a
  else if (time >= b.time) a = b
  else {
    let lo = 0
    let hi = h.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (h[mid].time <= time) lo = mid
      else hi = mid
    }
    a = h[lo]
    b = h[hi]
  }
  const span = b.time - a.time
  const alpha = span > 0 ? (time - a.time) / span : 0
  out.x = a.x + (b.x - a.x) * alpha
  out.y = a.y + (b.y - a.y) * alpha
  return out
}`,
    },
    {
      lang: "pseudo",
      caption:
        "Handle a shot. Nothing live moves, so there is nothing to put back:",
      code: `on shot(client, viewTime, direction):
    claimed   = now - viewTime
    plausible = client.measuredRtt + client.interp + tolerance
    rewind    = clamp(claimed, 0, min(plausible, maxRewind))

    origin = serverPositionOf(client, now - rewind)   // never the client's
    for each other player p:
        box = sampleHistory(p.history, now - rewind, scratch)
        test ray(origin, direction) against box, keep the nearest
    apply damage from the server's verdict`,
    },
  ],
  mistakes: [
    "Trusting a client's \"I hit him\". The server must decide from its own history, and Riot's stated rule is that a server must never trust a client's view of the world. A client that picks its own target can score any shot it likes.",
    "Trusting the timestamp without a limit. A forged old view time lets a cheater shoot at any position still in the history. Clamp it to what the measured latency explains, as well as to the cap.",
    "Rewinding by latency alone. With 100 ms round trip and 100 ms interpolation at 5 u/s, the test lands 0.5 u from what the shooter saw. This lane's 0.8 u box still catches that, but a smaller one would not. Using only the one-way time (50 ms) leaves 0.75 u, and half the shots in the lane miss.",
    "Rewinding players but not what blocks them. Doors, lifts and moving cover have positions in the past as well, so a test against their current state can block a shot that was clear or pass one that was not.",
    "Tuning only with a local server. At near-zero delay the shot lands with or without a rewind, so a missing or wrong one goes unnoticed until real latency arrives. Test with added latency and a moving target.",
  ],
  reading: [
    {
      title: "Gabriel Gambetta — Lag Compensation",
      url: "https://www.gabrielgambetta.com/lag-compensation.html",
    },
    {
      title: "Riot Games — Peeking into VALORANT's Netcode",
      url: "https://www.riotgames.com/en/news/peeking-valorants-netcode",
    },
  ],
  visual:
    "Top-down lane. Solid yellow square = what the shooter sees. Plain grey outline = the target on the server now. Dashed white outline = the hitbox the server tests; with a rewind it sits on the yellow square. The bracket above measures the gap, and grey dots below are the ticks within the cap. Time freezes at each shot: a thick green ray ending in a disc is a hit, and a thin red ray with a cross is a miss, with the same disc or cross added to the tally. Turn compensation off and shots aimed dead-on miss. Lower max rewind below the delay and the dashed box falls behind.",
}

export default sheet
