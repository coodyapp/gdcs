/**
 * Shelf (row) packer for texture atlases.
 *
 * Sprites are sorted tallest first and placed left to right on horizontal
 * shelves; a new shelf opens when the current one is full. Every sprite gets
 * `padding` pixels of gutter on each side so linear filtering and mipmaps do
 * not bleed neighbouring sprites into it.
 */

export interface SpriteSize {
  w: number
  h: number
}

export interface AtlasRect {
  /** Index of the sprite in the input array. */
  id: number
  /** Top-left of the sprite's own pixels (padding excluded), y down. */
  x: number
  y: number
  w: number
  h: number
}

export interface Atlas {
  size: number
  padding: number
  /** One rect per input sprite, in input order. */
  rects: AtlasRect[]
  shelves: number
  /** Fraction of the atlas covered by sprite pixels (padding excluded). */
  fill: number
}

export interface UvRect {
  u0: number
  v0: number
  u1: number
  v1: number
}

/** Packs into a square of `size` pixels, or returns null if it doesn't fit. */
export function packShelves(
  sprites: readonly SpriteSize[],
  size: number,
  padding = 2
): Atlas | null {
  const order = sprites
    .map((s, id) => ({ ...s, id }))
    .sort((a, b) => b.h - a.h || b.w - a.w)
  const rects: AtlasRect[] = []
  let x = 0
  let y = 0
  let shelfH = 0
  let shelves = 0
  let used = 0
  for (const s of order) {
    const sw = s.w + 2 * padding
    const sh = s.h + 2 * padding
    if (sw > size) return null
    if (x + sw > size) {
      y += shelfH
      x = 0
      shelfH = 0
    }
    if (shelfH === 0) shelves++
    if (y + sh > size) return null
    rects[s.id] = { id: s.id, x: x + padding, y: y + padding, w: s.w, h: s.h }
    x += sw
    shelfH = Math.max(shelfH, sh)
    used += s.w * s.h
  }
  return { size, padding, rects, shelves, fill: used / (size * size) }
}

/** Smallest power-of-two square (up to `maxSize`) that fits every sprite. */
export function packAtlas(
  sprites: readonly SpriteSize[],
  padding = 2,
  maxSize = 4096
): Atlas | null {
  for (let size = 64; size <= maxSize; size *= 2) {
    const atlas = packShelves(sprites, size, padding)
    if (atlas) return atlas
  }
  return null
}

/**
 * UV rectangle for a sprite. With `flipY` (the WebGL/Three.js default for
 * image textures) v = 0 is the bottom row of the image.
 */
export function uvRect(r: AtlasRect, size: number, flipY = true): UvRect {
  const u0 = r.x / size
  const u1 = (r.x + r.w) / size
  const top = r.y / size
  const bottom = (r.y + r.h) / size
  return flipY
    ? { u0, u1, v0: 1 - bottom, v1: 1 - top }
    : { u0, u1, v0: top, v1: bottom }
}
