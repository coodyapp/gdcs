import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "object-pooling",
  category: "systems",
  subcategory: "patterns",
  title: "Object Pooling",
  hook: "create everything up front, then recycle instead of allocate",
  summary:
    "Pre-allocate bullets, effects and enemies once, then hand out and return them. No allocation or GC spikes mid-fight, and a hard cap on live objects.",
  level: "core",
  tags: ["pool", "memory", "garbage collection", "projectiles", "performance"],
  updated: "2026-11-01",
  prompt:
    "Write a generic `Pool<T>` in TypeScript for a Three.js game. Constructor takes a factory, a capacity and a reset callback; all objects are created up front. `acquire()` returns a slot index or -1 using a free-list stack (O(1), no allocation); `release(i)` resets the object, ignores double releases and pushes the index back. Add an optional overflow policy: 'drop' | 'recycleOldest' | 'grow' (track spawn order for recycleOldest), and counters for allocations and peak active. Use it for bullets as pre-added hidden meshes. Write Vitest tests: 1000 acquire/release cycles keep allocations at capacity, exhaustion returns -1, double release is ignored, recycleOldest returns the earliest-acquired slot.",
  related: ["particle-system", "tunneling", "fixed-timestep"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Spawning a bullet with `new Mesh()` and destroying it later costs an allocation, scene-graph work and, in JavaScript, garbage that the collector must clean up at a moment you do not choose. An **object pool** creates N objects at load time. `acquire()` hands out a free one, `release()` gives it back. Nothing is created or destroyed during play.",
    "The usual structure is an array of objects plus a **free list**: a stack of free indices. Both operations are O(1). Released objects are reset (position, velocity, timers, visibility) so they come back clean. In Three.js, hiding a pooled mesh (`visible = false`) or writing it into an `InstancedMesh` slot is far cheaper than adding and removing it from the scene.",
    "Decide what happens when the pool runs dry: **drop** the request (fine for cosmetic sparks), **recycle the oldest** live object (good for decals and shell casings), or **grow** (allocates, so log it and size the pool better). Pools pair naturally with a [particle system](/systems/patterns/particle-system), which is a pool of tiny structs.",
  ],
  formulas: [
    {
      label: "Pool size from Little's law",
      math: tex`N \approx \lambda \cdot L \cdot k`,
      note: "λ = spawns per second, L = average lifetime in seconds, k ≈ 1.2–1.5 headroom for bursts.",
    },
  ],
  rules: [
    "Size from data: 10 shots/s × 1.5 s lifetime = 15 live; allocate 20.",
    "Warm the pool during loading, not on the first shot. Also pre-compile materials so the first use doesn't hitch.",
    "Track `allocations` and `peakActive` in a debug overlay. After warm-up allocations should stay flat.",
    "Reset in `release()`, not in `acquire()`, so a free object never holds stale references (targets, callbacks) that keep other objects alive.",
    "Pool only things that churn: projectiles, hit effects, damage numbers, audio voices. A boss spawned once does not need a pool.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Index-based pool with a free-list stack:",
      code: `class Pool<T> {
  items: T[] = []
  active: boolean[] = []
  private free: number[] = []

  constructor(create: () => T, size: number, private reset: (t: T) => void) {
    for (let i = size - 1; i >= 0; i--) {
      this.items[i] = create()
      this.active[i] = false
      this.free.push(i)
    }
  }
  acquire(): number {
    const i = this.free.pop()
    if (i === undefined) return -1      // exhausted: caller decides
    this.active[i] = true
    return i
  }
  release(i: number) {
    if (!this.active[i]) return         // guard double release
    this.active[i] = false
    this.reset(this.items[i])
    this.free.push(i)
  }
}`,
    },
    {
      lang: "ts",
      caption: "Pooled bullets as hidden meshes:",
      code: `const bullets = new Pool(() => {
  const m = new THREE.Mesh(bulletGeo, bulletMat)
  m.visible = false
  scene.add(m)                          // added once, never removed
  return m
}, 32, (m) => { m.visible = false })

function fire(origin: THREE.Vector3) {
  const i = bullets.acquire()
  if (i < 0) return
  bullets.items[i].position.copy(origin)
  bullets.items[i].visible = true
}`,
    },
  ],
  mistakes: [
    "Forgetting to reset state, so a recycled enemy spawns with last life's health or a still-running timer.",
    "Releasing the same object twice, which puts its index on the free list twice and later hands one object to two owners.",
    "Keeping references to a released object (homing target, UI marker). Use the index plus a generation counter to detect stale handles.",
    "Calling `scene.add`/`scene.remove` on acquire and release. Toggle `visible` or write instance matrices instead.",
    "Pooling everything, which adds complexity and memory for objects that are created once.",
  ],
  reading: [
    {
      title: "MDN — Memory management (garbage collection)",
      url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management",
    },
    {
      title: "Three.js docs — InstancedMesh",
      url: "https://threejs.org/docs/#api/en/objects/InstancedMesh",
    },
  ],
  visual:
    "The turret fires orange projectiles from a fixed pool. Each cube in the row behind it is one pool slot: cyan = in use, gray = free. The allocation counter never moves; when every slot is busy the turret flashes red and the shot is dropped, or the oldest projectile is recycled. Raise the fire rate or shrink the pool to hit the limit.",
}

export default sheet
