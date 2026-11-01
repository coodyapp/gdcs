/**
 * Chunk streaming on a 2D grid of square chunks (x/z in world units).
 *
 * A chunk is requested when its centre comes within `loadRadius` of the
 * player and released only when it moves beyond `unloadRadius`. Keeping
 * `unloadRadius > loadRadius` (hysteresis) stops chunks on the boundary
 * from loading and unloading every time the player wiggles across it.
 */

const OFFSET = 1 << 15

/** Packs integer chunk coordinates (±32767) into one number key. */
export const chunkKey = (cx: number, cz: number) =>
  (cx + OFFSET) * 65536 + (cz + OFFSET)

export const chunkCoords = (key: number): [number, number] => [
  Math.floor(key / 65536) - OFFSET,
  (key % 65536) - OFFSET,
]

export interface StreamEvents {
  /** Keys loaded during this update (nearest first). */
  loaded: number[]
  /** Keys released during this update. */
  unloaded: number[]
  /** Chunks inside the load radius still waiting because of the budget. */
  pending: number
}

export class ChunkStreamer {
  readonly resident = new Set<number>()
  private readonly wanted: number[] = []
  private readonly dist = new Map<number, number>()
  private readonly events: StreamEvents = {
    loaded: [],
    unloaded: [],
    pending: 0,
  }
  private readonly byDistance = (a: number, b: number) =>
    this.dist.get(a)! - this.dist.get(b)!

  constructor(
    public chunkSize: number,
    public loadRadius: number,
    public unloadRadius: number
  ) {
    if (unloadRadius < loadRadius)
      throw new RangeError("unloadRadius must be >= loadRadius")
  }

  /** Distance from (x, z) to the centre of chunk (cx, cz). */
  distanceTo(x: number, z: number, cx: number, cz: number) {
    const s = this.chunkSize
    return Math.hypot((cx + 0.5) * s - x, (cz + 0.5) * s - z)
  }

  /**
   * Streams around the player at (x, z). Loads at most `maxLoads` chunks,
   * nearest first. The returned object is reused between calls.
   */
  update(x: number, z: number, maxLoads = Infinity): StreamEvents {
    const ev = this.events
    ev.loaded.length = 0
    ev.unloaded.length = 0
    for (const key of this.resident) {
      const [cx, cz] = chunkCoords(key)
      if (this.distanceTo(x, z, cx, cz) > this.unloadRadius) {
        this.resident.delete(key)
        ev.unloaded.push(key)
      }
    }
    const s = this.chunkSize
    const r = this.loadRadius
    this.wanted.length = 0
    this.dist.clear()
    for (
      let cx = Math.floor((x - r) / s);
      cx <= Math.floor((x + r) / s);
      cx++
    ) {
      for (
        let cz = Math.floor((z - r) / s);
        cz <= Math.floor((z + r) / s);
        cz++
      ) {
        const key = chunkKey(cx, cz)
        if (this.resident.has(key)) continue
        const d = this.distanceTo(x, z, cx, cz)
        if (d > r) continue
        this.wanted.push(key)
        this.dist.set(key, d)
      }
    }
    this.wanted.sort(this.byDistance)
    const n = Math.min(this.wanted.length, maxLoads)
    for (let i = 0; i < n; i++) {
      this.resident.add(this.wanted[i])
      ev.loaded.push(this.wanted[i])
    }
    ev.pending = this.wanted.length - n
    return ev
  }
}
