import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "frame-budget",
  category: "performance",
  subcategory: "cpu",
  title: "Frame Budget",
  hook: "every system shares one slice of time per frame",
  summary:
    "At 60 Hz a frame has 16.67 ms for input, gameplay, physics, AI and rendering combined. Measure each system and keep the total under budget with headroom.",
  level: "core",
  tags: ["frame time", "fps", "profiling", "vsync", "milliseconds"],
  updated: "2026-11-02",
  prompt:
    "Build a frame-budget profiler for my TypeScript + Three.js game. Provide `beginSystem(name)` / `endSystem(name)` using performance.now(), store an exponential moving average and a rolling 120-frame window per system, and compute total, average and 99th-percentile frame time. Accept a target refresh rate (default 60 Hz → 16.67 ms) and flag frames above 90% of budget. Draw a small overlay with one coloured bar per system scaled to the budget and the overrun in red. No allocations per frame (preallocate ring buffers). Write unit tests for the percentile function and for the vsync rounding rule ceil(frame/budget)·budget.",
  related: ["time-slicing", "draw-calls", "spatial-partitioning"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "The frame budget is the time one frame may take before the display moves on without you: `1000 / targetHz` milliseconds, so **16.67 ms** at 60 Hz, 8.33 ms at 120 Hz and 33.3 ms at 30 Hz. Input, gameplay scripts, physics, AI, animation, audio mixing and the CPU side of rendering all have to fit inside it, every frame.",
    "Think in **milliseconds, not FPS**. FPS is the reciprocal of frame time, so it hides how costs add up: dropping from 60 to 50 fps costs 3.3 ms, while 30 to 20 fps costs 16.7 ms. A feature that costs 2 ms is 12% of a 60 Hz frame no matter what the current FPS is.",
    "With vsync, missing the budget by even 0.1 ms usually means waiting for the next vertical blank, so the frame shows for 33.3 ms and the game stutters. Plan for headroom (spend about 80–90% of the budget) because spikes from garbage collection, asset loads and busy combat scenes all land on top of the average.",
    "Split heavy work you can't shrink across frames with [time slicing](/performance/cpu/time-slicing), and cut per-object CPU cost with [spatial partitioning](/performance/world/spatial-partitioning) and fewer [draw calls](/performance/gpu/draw-calls).",
  ],
  formulas: [
    {
      label: "Budget per frame",
      math: tex`T_{\text{budget}} = \frac{1000\ \text{ms}}{f_{\text{target}}}`,
      note: "60 Hz → 16.67 ms, 120 Hz → 8.33 ms, 144 Hz → 6.94 ms.",
    },
    {
      label: "Frame time adds up",
      math: tex`T_{\text{frame}} = \sum_i T_{\text{system}_i} \le T_{\text{budget}}`,
    },
    {
      label: "Shown time with vsync",
      math: tex`T_{\text{shown}} = \left\lceil \frac{T_{\text{frame}}}{T_{\text{budget}}} \right\rceil T_{\text{budget}}`,
      note: "17 ms of work at 60 Hz is shown for 33.3 ms: effectively 30 fps.",
    },
  ],
  rules: [
    "Target about 13–14 ms of work at 60 Hz (80–85%) so spikes don't cross 16.67 ms.",
    "Track the 99th-percentile frame time, not just the average. Players feel spikes, not means.",
    "Give each system a written budget, e.g. gameplay 3 ms, physics 2.5 ms, AI 2 ms, animation 1.5 ms, render submission 4 ms.",
    "Time with `performance.now()` (sub-millisecond, monotonic). Browsers coarsen it, so average over many frames.",
    "On the web, the GPU runs in parallel: CPU time and GPU time each need to fit, and the slower one sets the frame rate.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Per-system timings with a rolling average and a budget check:",
      code: `const BUDGET_MS = 1000 / 60
const timings = new Map<string, number>() // smoothed ms per system

function timed(name: string, fn: () => void) {
  const t0 = performance.now()
  fn()
  const ms = performance.now() - t0
  const prev = timings.get(name) ?? ms
  timings.set(name, prev + (ms - prev) * 0.1) // exponential moving average
}

function frame(dt: number) {
  timed("input", () => input.poll())
  timed("gameplay", () => world.update(dt))
  timed("physics", () => physics.step(dt))
  timed("ai", () => ai.update(dt))
  timed("render", () => renderer.render(scene, camera))

  let total = 0
  for (const ms of timings.values()) total += ms
  if (total > BUDGET_MS * 0.9) hud.warn(\`frame \${total.toFixed(1)} ms\`)
}`,
    },
  ],
  mistakes: [
    "Optimising by FPS deltas instead of milliseconds, which misjudges how much a feature costs.",
    "Spending the whole 16.67 ms on average, so every GC pause or loading hitch drops a frame.",
    "Profiling a debug build or with DevTools open and treating the numbers as shipping performance.",
    "Measuring only the CPU when the GPU is the bottleneck (or vice versa). Check both before optimising.",
    "Doing one-off heavy work (pathfinding for everyone, level loads, JSON parsing) inside a single frame instead of spreading it out.",
  ],
  reading: [
    {
      title: "MDN — performance.now()",
      url: "https://developer.mozilla.org/en-US/docs/Web/API/Performance/now",
    },
    {
      title: "MDN — Anatomy of a video game (main loop timing)",
      url: "https://developer.mozilla.org/en-US/docs/Games/Anatomy",
    },
    {
      title: "MDN — requestAnimationFrame()",
      url: "https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame",
    },
  ],
  visual:
    "The bottom bar is one frame: each slice is a system, alternating tall and short so neighbours stand apart (light-grey gameplay, yellow physics, grey AI, white rendering, gray other); the white line is the budget and any overrun is a red overlay. The bars above are recent frames: thin green bars are on time, wide red bars are late and cross the white line. Raise the load or the target rate to see frames miss.",
}

export default sheet
