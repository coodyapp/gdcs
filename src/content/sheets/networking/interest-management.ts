import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "interest-management",
  category: "networking",
  subcategory: "scaling",
  title: "Interest Management (Area of Interest)",
  hook: "send each client only what is near it",
  summary:
    "Stop sending every player everything: a grid finds each client's nearby entities, and separate enter and leave radii stop edge flicker and cut message counts.",
  level: "common",
  tags: [
    "area of interest",
    "AOI",
    "replication",
    "relevancy",
    "hysteresis",
    "anti-cheat",
  ],
  updated: "2026-11-02",
  prompt:
    "Write area-of-interest replication in TypeScript for a 2D (x/z) Three.js multiplayer game server. Inputs each tick: entity positions in typed arrays, one viewer entity per client, an enter radius R and a leave radius L >= R. Build a uniform grid with cell size R by counting sort, without allocating per tick. For each client, first remove members farther than L and emit despawn(client, entity); then query the at most 3x3 cells overlapping the circle of radius R and emit spawn(client, entity, fullState) for non-members within R. Skip the client's own entity. Send an update for each member, every tick if within R / 2 and every second tick otherwise, staggered by id. Include distance == R as inside. Write tests: a grid query returns exactly the same set as a brute-force distance check, including points outside the bounds; updates per tick equal the sum of set sizes when tiers are off; setting R to cover the whole world gives N(N - 1); on a seeded jittering run, L > R produces fewer spawns and despawns than L = R.",
  related: [
    "spatial-partitioning",
    "snapshot-interpolation",
    "client-side-prediction",
    "chunk-streaming",
    "time-slicing",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "If each of `N` players receives every other player's state, the server produces `N(N − 1)` updates per tick. At 20 Hz that is 198,000 updates a second for 100 players and about 20 million for 1,000. Doubling players roughly quadruples the traffic, while each client gets more data it mostly cannot use. **Interest management** gives each client a set of entities that matter to it, usually those within an **area of interest** (AOI), and sends only those.",
    "Finding the set must also be cheap, so bin entities in a [uniform grid](/performance/world/spatial-partitioning) with cells as wide as the enter radius. A circle of that radius overlaps at most 3×3 cells, so each client tests a small part of the world. Entities already in the set need only a distance test to decide whether they stay. The same grid can hold other groupings: rooms, teams, or a short list of always-relevant entities such as the match objective.",
    "**Use two radii.** With one radius, an entity strafing on the edge enters and leaves repeatedly, and each flip costs a spawn and a despawn message plus a visible pop. **Hysteresis** enters at `R` and leaves at a larger `L`, so small movement near the edge changes nothing. A **spawn** must carry the full state a client needs, because it knows nothing about the entity yet. A **despawn** tells it to forget the entity, and should not look like a death. On arrival, restart that entity's [interpolation buffer](/networking/netcode/snapshot-interpolation).",
    "**Distant entities can update less often**, as they cover fewer pixels and matter less. **Anti-cheat** comes free: a cheat can only reveal what the client received, so an enemy outside the set simply is not there to find. An AOI only hides what is out of range, though. To hide an enemy behind a nearby wall you also need a visibility test, as Riot describes for VALORANT's fog of war.",
  ],
  formulas: [
    {
      label: "Send everything (per tick)",
      math: tex`U_{\text{all}} = N(N - 1)`,
    },
    {
      label: "Interest management: updates and messages per tick",
      math: tex`U = \sum_{c} |\textcolor{#fdc700}{S_c}|, \qquad \text{messages} = U + \text{spawns} + \text{despawns}`,
      note: "S_c is the set replicated to client c. The simulation's count equals this exactly on every tick. Multiply by the tick rate for messages per second.",
    },
    {
      label: "Membership with hysteresis",
      math: tex`e \in \textcolor{#fdc700}{S_c} \text{ when } d \le \textcolor{#fafafa}{R}; \qquad e \notin \textcolor{#fdc700}{S_c} \text{ when } d > \textcolor{#fafafa}{L}, \quad L \ge R`,
      note: "Between R and L, an entity keeps its current state.",
    },
    {
      label: "Estimate for evenly spread entities",
      math: tex`\frac{U}{U_{\text{all}}} \approx \frac{\pi \textcolor{#fafafa}{R}^2}{A}`,
      note: "World area A, no hysteresis. World edges lower it: 8.5% measured against 8.9% estimated at the visual's defaults.",
    },
  ],
  rules: [
    "Measured in the visual's seeded 60 s default run (120 entities, R = 1.6 u in a 12 × 7.5 u world, 20 Hz, no tiers): 285,600 messages/s to send everything, about 24,300 updates/s with one radius and about 29,900 with hysteresis. Your numbers depend on density, not just on N: in a crowd, everyone is in everyone's set and you are back to O(N²).",
    "Start with `L = 1.25 R` as a judgement call, then check it against your own motion. In the same run it took spawns and despawns from 83,198 to 42,716 (−49%), at a price of 23% more updates. `L = 1.1 R` saved 23% for 9% more updates; `L = 1.5 R` saved 65% for 47% more.",
    "Make `L − R` wider than the side-to-side movement you see at the edge. Hysteresis removes flicker, not real crossings: an entity walking through still enters and leaves once.",
    "Set `R` from what the player must see or react to, such as draw distance or weapon range, plus travel during your latency. An early VALORANT fog-of-war iteration, described by Riot, fixed pop-in the same way: it expanded bounds by velocity times a look-ahead longer than ping.",
    "Use cells as wide as `R`. Each query then scans at most 9 cells. In the default run with hysteresis this took about 4,600 distance tests per tick for all clients together, against 14,400 for testing every client against every entity.",
    "Halving the rate of entities beyond `R / 2` left 61% of the updates in the same run. Starting tiers are a judgement call: slow what the player barely sees, keep combat-range entities at full rate, and stagger by id so far updates do not bunch on one tick.",
    "Keep an always-relevant list for things the whole match must know about, like objectives and teammates on a map, and do not put them through the radius test.",
  ],
  code: [
    {
      lang: "ts",
      caption:
        "One tick for one client. Leave uses L against members, enter uses the grid with R:",
      code: `function updateInterest(c: number) {
  const set = sets[c]
  for (const e of set) {
    if (dist2(c, e) > L * L) {
      set.delete(e)
      send(c, { type: "despawn", id: e })
    }
  }
  const x = xs[c], y = ys[c]
  const x1 = cellX(x + R), y1 = cellY(y + R)
  for (let cy = cellY(y - R); cy <= y1; cy++) {
    for (let cx = cellX(x - R); cx <= x1; cx++) {
      for (const e of grid.itemsIn(cx, cy)) {
        if (e === c || set.has(e) || dist2(c, e) > R * R) continue
        set.add(e)
        send(c, { type: "spawn", id: e, state: fullState(e) })
      }
    }
  }
  for (const e of set) {
    // Far entities at half rate, staggered by id.
    if (dist2(c, e) <= (R / 2) ** 2 || (tick + e) % 2 === 0) {
      send(c, { type: "update", id: e, state: delta(e) })
    }
  }
}`,
    },
  ],
  mistakes: [
    "Using one radius. In the default run this produced about 1,390 spawns and despawns per second, against about 710 with `L = 1.25 R`.",
    "Sending a spawn with only a position. The client sees a default entity until the next full update: wrong health, wrong animation, no name.",
    "Letting updates overtake spawn or despawn. If spawns go over a reliable channel and updates over an unreliable one, an update can arrive before the spawn or after the despawn. Drop or hold it, and give reused ids a generation counter.",
    "Treating a despawn as a death. Effects and sounds fire, and players see enemies drop dead as they walk away.",
    "Forgetting events. A gunshot or explosion from outside the radius needs its own rule, or a distant battle is silent. Events may need a larger radius than positions.",
  ],
  reading: [
    {
      title: "Unreal Engine docs — Replication Graph",
      url: "https://dev.epicgames.com/documentation/en-us/unreal-engine/replication-graph-in-unreal-engine",
    },
    {
      title: "Riot Games — Demolishing Wallhacks with VALORANT's Fog of War",
      url: "https://technology.riotgames.com/news/demolishing-wallhacks-valorants-fog-war",
    },
    {
      title: "Gaffer On Games — State Synchronization (priority accumulator)",
      url: "https://gafferongames.com/post/state_synchronization/",
    },
  ],
  visual:
    "Top-down world with a grid sized to the enter radius; the shaded cells are what the viewer's query scans. The solid white disc is the viewer, the solid ring the enter radius and the dashed ring the leave radius. Solid yellow discs are replicated to the viewer, small grey outlines are not, and at each change a green plus marks an enter and a red minus a leave. Turn hysteresis off to watch the edge flicker, or interest off to see the O(N²) count.",
}

export default sheet
