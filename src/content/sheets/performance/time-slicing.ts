import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "time-slicing",
  category: "performance",
  subcategory: "cpu",
  title: "Time Slicing",
  hook: "let a different group think each frame",
  summary:
    "Split expensive per-entity work into buckets and run one bucket per frame. Cost per frame drops by the bucket count; each entity reacts a little later.",
  level: "common",
  tags: ["amortization", "round robin", "ai", "scheduling", "budget"],
  updated: "2026-11-01",
  prompt:
    "Add time slicing to my TypeScript + Three.js game's AI. Write a `Scheduler` that holds entities with a stable `bucket` assigned at registration (round robin), a configurable bucket count B, and per-entity `lastUpdate` time. Each frame it calls `think(entity, elapsedSinceLastThink)` only for the active bucket and `move(entity, dt)` for all. Also provide a budgeted mode that processes at most K entities per frame with a wrapping cursor that survives removals. Handle B changing at runtime by reassigning buckets evenly. Write tests: every entity thinks exactly once per B frames, elapsed time ≈ B·dt, and removal mid-cycle never skips anyone.",
  related: ["frame-budget", "spatial-partitioning", "chunk-streaming"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Some work is too expensive to run for every entity every frame but doesn't need to: AI re-planning, line-of-sight checks, path requests, LOD selection, sensor queries. **Time slicing** divides those entities into `B` buckets and updates one bucket per frame in round-robin order. The per-frame cost drops to about `1/B` of the total, and every entity still updates once every `B` frames.",
    "The price is **latency**. With 4 buckets at 60 Hz an agent notices a change up to 4 frames (67 ms) late. That's invisible for a guard choosing a patrol point and noticeable for an enemy dodging a bullet, so slice only work that tolerates it and keep reflex-level checks per frame.",
    "Sliced updates must use the time since that entity's **last** update, `B · dt` on average, not the current frame's `dt`, or timers and integrators run `B` times too slowly. Cheap per-frame work such as movement keeps running every frame along the last decision, so motion stays smooth while decisions are staggered.",
    'Two common shapes: **fixed buckets** (`index % B` or contiguous ranges) for predictable latency, and a **round-robin cursor with an item budget** ("update up to 50 per frame") that adapts as the entity count changes. Both keep the [frame budget](/performance/cpu/frame-budget) flat instead of spiking.',
  ],
  formulas: [
    {
      label: "Cost per frame",
      math: tex`C_{\text{frame}} \approx \frac{N \cdot c}{B}`,
      note: "N entities, c ms of work each, B buckets.",
    },
    {
      label: "Worst-case reaction delay",
      math: tex`t_{\text{delay}} \le B \cdot \Delta t`,
      note: "B = 4 at 60 Hz: up to 66.7 ms.",
    },
  ],
  rules: [
    "Start with 2–4 buckets for AI decisions and 8–16 for slow systems (ambient life, far-away LOD, cover evaluation).",
    "Keep reaction-critical checks (incoming damage, collision, input) out of slices.",
    "Pass the accumulated time since the entity's last update into sliced logic.",
    "Prefer an item budget (e.g. max 40 path requests per frame) when the count varies widely.",
    "Give new entities a staggered start bucket so a spawned wave doesn't all think on the same frame.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Bucketed AI updates with correct elapsed time:",
      code: `const BUCKETS = 4
let frame = 0

function updateAI(agents: Agent[], dt: number, now: number) {
  const bucket = frame++ % BUCKETS
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i]
    a.moveAlongPlan(dt)                 // cheap: every frame
    if (i % BUCKETS !== bucket) continue
    const elapsed = now - a.lastThink   // ≈ BUCKETS * dt
    a.lastThink = now
    a.think(elapsed)                    // expensive: 1 frame in 4
  }
}`,
    },
    {
      lang: "pseudo",
      caption: "Round-robin cursor with a per-frame item budget:",
      code: `budget = 40
repeat min(budget, count) times:
    process(items[cursor])
    cursor = (cursor + 1) mod count`,
    },
  ],
  mistakes: [
    "Passing the frame's `dt` to sliced logic, so timers and cooldowns run B times slower.",
    "Slicing reflex checks and making enemies feel sluggish or miss hits.",
    "Using `index % B` on a list that reorders or removes items, so some entities skip updates or run twice. Store a stable bucket per entity.",
    "Spawning a crowd that all lands in one bucket and recreates the spike you tried to remove.",
  ],
  reading: [
    {
      title: "MDN — Anatomy of a video game",
      url: "https://developer.mozilla.org/en-US/docs/Games/Anatomy",
    },
    {
      title: "MDN — requestIdleCallback() (deferring background work)",
      url: "https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback",
    },
  ],
  visual:
    "Each dot is an agent chasing the yellow beacon. Only the orange bucket thinks this frame and re-aims at the beacon; cyan agents keep moving toward the goal they picked earlier (white line), so they trail behind. Raise the bucket count and watch the swarm react later and spread out; slow the tick to see the rotation.",
}

export default sheet
