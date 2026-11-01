/**
 * Deterministic randomness for procedural content: a seeded PRNG and 2D
 * gradient (Perlin-style) noise with fractal Brownian motion on top.
 * Same seed in, same numbers out, on every machine.
 */

/** mulberry32: tiny, fast 32-bit PRNG. Returns floats in [0, 1). */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Hash a string (e.g. "level-3") to a 32-bit seed (FNV-1a). */
export function hashSeed(text: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export type Noise2D = (x: number, y: number) => number

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

/**
 * 2D gradient noise seeded by `seed`. Output is roughly in [-1, 1] and is
 * exactly 0 on integer lattice points.
 */
export function createNoise2D(seed: number): Noise2D {
  const rand = mulberry32(seed)
  // Shuffled permutation, doubled so lookups never need a modulo.
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = p[i]
    p[i] = p[j]
    p[j] = tmp
  }
  const perm = new Uint8Array(512)
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]
  // 16 unit gradients evenly spread around the circle.
  const gx = new Float32Array(16)
  const gy = new Float32Array(16)
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    gx[i] = Math.cos(a)
    gy[i] = Math.sin(a)
  }
  const dot = (h: number, x: number, y: number) =>
    gx[h & 15] * x + gy[h & 15] * y

  return (x, y) => {
    const xf = Math.floor(x)
    const yf = Math.floor(y)
    const X = xf & 255
    const Y = yf & 255
    const dx = x - xf
    const dy = y - yf
    const aa = perm[perm[X] + Y]
    const ab = perm[perm[X] + Y + 1]
    const ba = perm[perm[X + 1] + Y]
    const bb = perm[perm[X + 1] + Y + 1]
    const u = fade(dx)
    const v = fade(dy)
    const x1 = dot(aa, dx, dy) + u * (dot(ba, dx - 1, dy) - dot(aa, dx, dy))
    const x2 =
      dot(ab, dx, dy - 1) + u * (dot(bb, dx - 1, dy - 1) - dot(ab, dx, dy - 1))
    // Unit gradients peak at ±√½, so scale by √2 to fill [-1, 1].
    return (x1 + v * (x2 - x1)) * Math.SQRT2
  }
}

export interface FbmOptions {
  octaves?: number
  /** Frequency multiplier per octave (usually 2). */
  lacunarity?: number
  /** Amplitude multiplier per octave (usually 0.5). */
  gain?: number
}

/** Fractal Brownian motion: sum of octaves, normalized back to about [-1, 1]. */
export function fbm2D(
  noise: Noise2D,
  x: number,
  y: number,
  { octaves = 5, lacunarity = 2, gain = 0.5 }: FbmOptions = {}
) {
  let sum = 0
  let amp = 1
  let freq = 1
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq, y * freq)
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return sum / norm
}
