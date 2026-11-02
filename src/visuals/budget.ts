/**
 * Live-canvas budget for card grids. Each WebGL context costs GPU memory and
 * main-thread time, so only the most visible cards run live; the rest show
 * their static poster. Cards register with their visibility ratio; the
 * manager grants slots to the highest ratios (ties: first registered).
 */
type Listener = (live: boolean) => void

interface Entry {
  ratio: number
  order: number
  listener: Listener
  live: boolean
}

const entries = new Map<string, Entry>()
let order = 0
let scheduled = false

/** 4 live cards on desktop, 2 on small screens; 0 when we should stay static. */
export function budget() {
  if (typeof window === "undefined") return 0
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean }
    deviceMemory?: number
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 0
  if (nav.connection?.saveData) return 0
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return 0
  return window.matchMedia("(max-width: 640px)").matches ? 2 : 4
}

function rebalance() {
  scheduled = false
  const max = budget()
  const ranked = [...entries.values()]
    .filter((e) => e.ratio >= 0.5)
    .sort((a, b) => b.ratio - a.ratio || a.order - b.order)
  const winners = new Set(ranked.slice(0, max))
  for (const e of entries.values()) {
    const live = winners.has(e)
    if (live !== e.live) {
      e.live = live
      e.listener(live)
    }
  }
}

function schedule() {
  if (scheduled) return
  scheduled = true
  // Batch updates from many observers into one decision per frame.
  requestAnimationFrame(rebalance)
}

export function registerCard(id: string, listener: Listener) {
  entries.set(id, { ratio: 0, order: order++, listener, live: false })
  return {
    update(ratio: number) {
      const e = entries.get(id)
      if (!e) return
      e.ratio = ratio
      schedule()
    },
    release() {
      entries.delete(id)
      schedule()
    },
  }
}

/** For tests: current number of live cards. */
export const liveCount = () =>
  [...entries.values()].filter((e) => e.live).length
