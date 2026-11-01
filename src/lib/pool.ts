/**
 * Fixed-capacity object pool with an index free list. All objects are created
 * up front; acquire/release are O(1) and allocate nothing.
 */
export class Pool<T> {
  readonly items: T[] = []
  readonly active: boolean[] = []
  /** Objects ever constructed. Stays at capacity unless `grow` kicks in. */
  allocations = 0
  private free: number[] = []

  constructor(
    private readonly create: () => T,
    capacity: number,
    private readonly reset?: (item: T) => void,
    private readonly grow = false
  ) {
    for (let i = 0; i < capacity; i++) this.add()
  }

  private add() {
    this.items.push(this.create())
    this.active.push(false)
    this.allocations++
    // Free list is a stack; push in reverse so slot 0 is handed out first.
    this.free.unshift(this.items.length - 1)
  }

  get capacity() {
    return this.items.length
  }
  get activeCount() {
    return this.items.length - this.free.length
  }

  /** Returns a slot index, or -1 when exhausted (and not allowed to grow). */
  acquire(): number {
    if (this.free.length === 0) {
      if (!this.grow) return -1
      this.add()
    }
    const i = this.free.pop()!
    this.active[i] = true
    return i
  }

  /** Returns the slot to the pool. Releasing a free slot is a no-op. */
  release(i: number): boolean {
    if (!this.active[i]) return false
    this.active[i] = false
    this.reset?.(this.items[i])
    this.free.push(i)
    return true
  }
}
