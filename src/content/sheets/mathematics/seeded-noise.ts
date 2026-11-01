import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "seeded-noise",
  category: "mathematics",
  subcategory: "procedural",
  title: "Seeded Noise",
  hook: "same seed in, same world out, every time",
  summary:
    "A seeded PRNG plus gradient noise and fBm turns one integer into an endless, smooth, repeatable world: same seed, same terrain on every machine.",
  level: "common",
  tags: ["procedural", "noise", "perlin", "fbm", "prng", "seed"],
  updated: "2026-11-01",
  prompt:
    "Write `src/lib/noise.ts` in TypeScript: `mulberry32(seed)` returning floats in [0, 1); `hashSeed(text)` using FNV-1a; `createNoise2D(seed)` implementing 2D gradient noise with a 256-entry permutation table shuffled by mulberry32 (Fisher–Yates), 16 unit gradients and a quintic fade, scaled to roughly [-1, 1]; and `fbm2D(noise, x, y, { octaves, lacunarity, gain })` normalized by the sum of amplitudes. Then build a Three.js heightfield (PlaneGeometry 128×128) from fBm sampled in world coordinates, coloured by height. Vitest: the same seed yields identical sequences and noise values, different seeds differ, noise and fBm stay within [-1, 1], and noise is 0 at integer lattice points.",
  related: ["chunk-streaming", "easing", "normals"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    '`Math.random()` can\'t be seeded, so a level generated with it can never be rebuilt. A **seeded PRNG** such as mulberry32 or xorshift is a tiny pure function of its state: give it the same 32-bit seed and it returns the same sequence forever. Hash strings like `"world-7/chunk-3,-2"` into seeds so every chunk, loot table or enemy wave has its own reproducible stream.',
    "Random numbers alone are white noise: neighbouring values are unrelated, which looks like TV static. **Gradient noise** (Perlin-style) puts a pseudo-random unit gradient at each integer lattice point and smoothly blends their contributions with a quintic fade curve. The result is continuous, band-limited, zero on the lattice, and the gradients come from a permutation table shuffled by the seed.",
    "One layer of noise gives smooth blobs of a single size. **Fractal Brownian motion (fBm)** sums several **octaves**, each with double the frequency (`lacunarity ≈ 2`) and half the amplitude (`gain ≈ 0.5`): big continents, then hills, then bumps. Divide by the summed amplitudes to keep the output in about [-1, 1], then shape it (power curves, terraces, ridges with `1 - |n|`).",
    "Determinism has rules: never mix in `Math.random()`, frame time or iteration order of unordered maps, and keep the algorithm version with the save. Stream chunks independently by seeding per chunk and sampling noise in **world** coordinates so seams match ([chunk streaming](/performance/world/chunk-streaming)).",
  ],
  formulas: [
    {
      label: "Gradient noise in a cell",
      math: tex`n(\mathbf{p}) = \operatorname{lerp}_{v}\big(\operatorname{lerp}_{u}(g_{00}\!\cdot\!\mathbf{d}_{00},\, g_{10}\!\cdot\!\mathbf{d}_{10}),\, \operatorname{lerp}_{u}(g_{01}\!\cdot\!\mathbf{d}_{01},\, g_{11}\!\cdot\!\mathbf{d}_{11})\big)`,
      note: "g = corner gradient, d = vector from that corner to p; u, v are the faded fractional coordinates.",
    },
    { label: "Quintic fade", math: tex`\varphi(t) = 6t^5 - 15t^4 + 10t^3` },
    {
      label: "fBm",
      math: tex`F(\mathbf{p}) = \frac{\sum_{i=0}^{k-1} g^{i}\, n(\ell^{i}\mathbf{p})}{\sum_{i=0}^{k-1} g^{i}}`,
      note: "k octaves, lacunarity ℓ ≈ 2, gain g ≈ 0.5.",
    },
  ],
  rules: [
    "4–6 octaves for terrain; each extra octave doubles detail and adds one noise call per sample.",
    "Stop adding octaves once the finest wavelength is under a vertex or pixel spacing.",
    "Offset the input (e.g. +1000.5) instead of re-seeding to get a second independent field cheaply.",
    "Store seeds as unsigned 32-bit ints; hash strings with FNV-1a or similar.",
    "Use separate PRNG streams per system (terrain, loot, AI) so changing one doesn't reshuffle the others.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Seeded PRNG and fBm heights for a terrain mesh:",
      code: `function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// createNoise2D(seed) builds a seeded permutation table + gradients.
const noise = createNoise2D(seed)
const pos = terrain.geometry.attributes.position
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i), z = pos.getZ(i)
  let h = 0, amp = 1, freq = 0.08, norm = 0
  for (let o = 0; o < octaves; o++) {
    h += amp * noise(x * freq, z * freq)
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  pos.setY(i, (h / norm) * heightScale)
}
pos.needsUpdate = true
terrain.geometry.computeVertexNormals()`,
    },
  ],
  mistakes: [
    "Calling `Math.random()` anywhere in generation, which silently breaks reproducibility.",
    "Sampling noise in chunk-local coordinates, so neighbouring chunks don't line up.",
    "Forgetting to normalize fBm, so adding octaves keeps raising the peak height.",
    "Re-seeding a PRNG with consecutive seeds and expecting unrelated output from a weak generator; hash the seed first.",
    "Sampling exactly on integer coordinates, where gradient noise is always 0.",
  ],
  reading: [
    {
      title: "Red Blob Games — Making maps with noise functions",
      url: "https://www.redblobgames.com/maps/terrain-from-noise/",
    },
    {
      title: "Scratchapixel — Perlin noise",
      url: "https://www.scratchapixel.com/lessons/procedural-generation-virtual-worlds/perlin-noise-part-2/perlin-noise.html",
    },
  ],
  visual:
    "A heightfield built from fBm gradient noise: cyan is water, green lowland, grey rock and white peaks. Move the seed and the land changes; move it back and the exact same terrain returns. Octaves add finer detail on top of the same large shapes, and the readout shows the first PRNG values for the current seed.",
}

export default sheet
