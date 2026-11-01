/**
 * Time slicing: spread expensive per-item work (AI re-planning, visibility
 * checks, LOD selection) over several frames so each frame pays a fixed
 * share of the cost.
 */

/**
 * Items `[start, end)` that belong to `bucket` when `count` items are split
 * into `buckets` contiguous, near-equal groups (sizes differ by at most 1).
 */
export function bucketRange(count: number, buckets: number, bucket: number) {
  const b = Math.max(1, Math.floor(buckets))
  const k = ((bucket % b) + b) % b
  return {
    start: Math.floor((k * count) / b),
    end: Math.floor(((k + 1) * count) / b),
  }
}

/** Which bucket runs on a given frame (round robin). */
export const bucketForFrame = (frame: number, buckets: number) =>
  ((frame % buckets) + buckets) % buckets

/** True when item `index` of `count` is updated on `frame`. */
export function isDue(
  index: number,
  count: number,
  buckets: number,
  frame: number
) {
  const { start, end } = bucketRange(
    count,
    buckets,
    bucketForFrame(frame, buckets)
  )
  return index >= start && index < end
}

/**
 * Round-robin cursor with a per-frame item budget: each `next` returns the
 * next `budget` items (wrapping), so every item is visited once per
 * ceil(count / budget) frames even when `count` changes.
 */
export class RoundRobin {
  private cursor = 0

  /** Calls `visit(i)` for up to `budget` items and returns how many it visited. */
  next(count: number, budget: number, visit: (index: number) => void) {
    if (count <= 0) return 0
    if (this.cursor >= count) this.cursor = 0
    const n = Math.min(count, Math.max(0, Math.floor(budget)))
    for (let k = 0; k < n; k++) {
      visit(this.cursor)
      this.cursor = (this.cursor + 1) % count
    }
    return n
  }
}
