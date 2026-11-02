import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "particle-system",
  category: "systems",
  subcategory: "patterns",
  title: "Particle System",
  hook: "thousands of short-lived points, one draw call",
  summary:
    "An emitter spawns particles at a rate, each lives for a set time under simple forces, and all of them render in a single instanced draw call.",
  level: "core",
  tags: ["particles", "emitter", "instancing", "vfx", "pooling"],
  updated: "2026-11-02",
  prompt:
    "Build a CPU particle system for Three.js in TypeScript. Use a fixed-capacity struct-of-arrays buffer (Float32Array for position, velocity, age, life) with swap-remove of dead particles. Emitter: rate per second with a fractional carry, spawn in a cone (half-angle param) with speed and life randomized ±20 %. Update with gravity and linear drag, dt clamped to 1/20 s. Render with one InstancedMesh: mesh.count = live count, size shrinks and color fades from yellow to grey with normalized age. No allocation in the frame loop. Write Vitest tests: population settles near rate × lifetime, capacity is never exceeded, and removing dead particles keeps survivors' data intact.",
  related: ["object-pooling", "fixed-timestep", "steering-behaviors"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A particle system has three parts. The **emitter** decides how many particles to spawn this frame (rate × dt, carrying the fraction), where, and with what initial velocity (a cone, sphere or mesh surface plus randomness). The **simulation** ages each particle, applies gravity, drag and wind, and kills it when `age ≥ life`. The **renderer** draws the survivors, varying size, color and opacity by normalized age `age / life`.",
    "Store particles as **struct-of-arrays** (`Float32Array` per field) in a fixed-capacity buffer. That buffer is an [object pool](/systems/patterns/object-pooling) for plain numbers. Keep live particles packed at the front and remove a dead one by copying the last live particle into its slot. The update loop then has no holes and no allocation.",
    "Render with a single `THREE.InstancedMesh` (or `Points`) and set `mesh.count` to the live count, so the GPU draws exactly the live particles in one call. Above roughly 10k–50k particles, move the simulation to the GPU (compute or ping-pong textures). Below that, a tight CPU loop is simpler and fast enough.",
  ],
  formulas: [
    {
      label: "Steady-state population",
      math: tex`N = r \cdot L`,
      note: "r = particles per second, L = lifetime. 200/s × 1.5 s ≈ 300 alive. Size the buffer from this.",
    },
    {
      label: "Per-particle update (semi-implicit Euler)",
      math: tex`v \mathrel{+}= g\,\Delta t, \quad v \mathrel{*}= (1 - k\,\Delta t), \quad p \mathrel{+}= v\,\Delta t`,
    },
    {
      label: "Normalized age drives the look",
      math: tex`u = \frac{\text{age}}{L} \in [0,1], \quad \text{size} = s_0 (1-u)`,
    },
  ],
  rules: [
    "Typical gameplay effects: 20–300 particles, 0.3–2 s lifetimes. A muzzle flash is a burst of 10–20 particles, not a stream.",
    "Carry the fractional part of `rate × dt` between frames, or low rates stall and high frame rates under-emit.",
    "Clamp `dt` (e.g. ≤ 1/20 s) for the particle sim so a hitch doesn't fling everything.",
    "Use additive blending and `depthWrite: false` for glowing effects; sort or use alpha-to-coverage only when you need correct translucency.",
    "Randomize at spawn (speed ±20 %, life ±25 %, direction within a cone) instead of per frame.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Swap-remove update over struct-of-arrays:",
      code: `function update(p: Particles, dt: number, g: number) {
  let i = 0
  while (i < p.count) {
    p.age[i] += dt
    if (p.age[i] >= p.life[i]) {
      p.copy(--p.count, i)    // last live particle fills the hole
      continue                // re-process slot i
    }
    p.vy[i] -= g * dt
    p.px[i] += p.vx[i] * dt
    p.py[i] += p.vy[i] * dt
    p.pz[i] += p.vz[i] * dt
    i++
  }
}`,
    },
    {
      lang: "ts",
      caption: "Upload to one InstancedMesh:",
      code: `for (let i = 0; i < p.count; i++) {
  const u = p.age[i] / p.life[i]
  dummy.position.set(p.px[i], p.py[i], p.pz[i])
  dummy.scale.setScalar(size * (1 - u))
  dummy.updateMatrix()
  mesh.setMatrixAt(i, dummy.matrix)
  mesh.setColorAt(i, color.copy(young).lerp(old, u))
}
mesh.count = p.count
mesh.instanceMatrix.needsUpdate = true
mesh.instanceColor!.needsUpdate = true`,
    },
  ],
  mistakes: [
    "Creating a `Mesh` per particle. Hundreds of draw calls will stall the CPU long before the GPU is busy.",
    "Using `Math.floor(rate * dt)` without carrying the remainder: at 144 fps and 60 particles/s you emit nothing.",
    "Forgetting `instanceMatrix.needsUpdate = true` (and the color attribute), so nothing moves.",
    "Leaving frustum culling on with a stale bounding sphere: the whole effect pops out when its origin leaves the screen. Update the bounds or set `frustumCulled = false` for small effects.",
  ],
  reading: [
    {
      title: "Three.js docs — InstancedMesh",
      url: "https://threejs.org/docs/#api/en/objects/InstancedMesh",
    },
    {
      title: "Three.js example — instancing performance",
      url: "https://threejs.org/examples/#webgl_instancing_performance",
    },
  ],
  visual:
    "One InstancedMesh draws every particle: each is born large and yellow at the solid white emitter, turns yellow and shrinks to a small gray speck as it ages, and falls under gravity. The white wireframe cone is the spawn cone. Change rate and lifetime to see the live count follow rate × lifetime, and set gravity to 0 for a fountain that drifts.",
}

export default sheet
