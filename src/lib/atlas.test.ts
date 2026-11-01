import { describe, expect, it } from "vite-plus/test"

import { packAtlas, packShelves, uvRect, type AtlasRect } from "./atlas"

function sprites(n: number, seed = 1) {
  const sizes = [8, 16, 24, 32, 48, 64]
  return Array.from({ length: n }, () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    const w = sizes[seed % sizes.length]
    seed = (seed * 1664525 + 1013904223) >>> 0
    return { w, h: sizes[seed % sizes.length] }
  })
}

/** The rect grown by `p` on every side: the slot the sprite really owns. */
const slot = (r: AtlasRect, p: number) => ({
  x0: r.x - p,
  y0: r.y - p,
  x1: r.x + r.w + p,
  y1: r.y + r.h + p,
})

describe("packShelves", () => {
  it.each([0, 1, 2, 4])(
    "padded slots never overlap and stay inside (padding %i)",
    (p) => {
      const input = sprites(40, p + 3)
      const atlas = packAtlas(input, p)!
      expect(atlas).not.toBeNull()
      expect(atlas.rects).toHaveLength(input.length)
      const slots = atlas.rects.map((r) => slot(r, p))
      for (const s of slots) {
        expect(s.x0).toBeGreaterThanOrEqual(0)
        expect(s.y0).toBeGreaterThanOrEqual(0)
        expect(s.x1).toBeLessThanOrEqual(atlas.size)
        expect(s.y1).toBeLessThanOrEqual(atlas.size)
      }
      for (let i = 0; i < slots.length; i++)
        for (let j = i + 1; j < slots.length; j++) {
          const a = slots[i]
          const b = slots[j]
          const overlap =
            a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
          expect(overlap, `${i} vs ${j}`).toBe(false)
        }
    }
  )

  it("keeps sprite sizes, input order, and at least 2·padding between sprites", () => {
    const input = [
      { w: 10, h: 10 },
      { w: 20, h: 5 },
      { w: 7, h: 30 },
    ]
    const atlas = packShelves(input, 64, 3)!
    atlas.rects.forEach((r, i) => {
      expect(r.id).toBe(i)
      expect([r.w, r.h]).toEqual([input[i].w, input[i].h])
      expect(r.x).toBeGreaterThanOrEqual(3)
      expect(r.y).toBeGreaterThanOrEqual(3)
    })
    // Tallest first on one shelf: 7×30, then 10×10, then 20×5.
    const [a, b, c] = [atlas.rects[2], atlas.rects[0], atlas.rects[1]]
    expect(b.x - (a.x + a.w)).toBe(6)
    expect(c.x - (b.x + b.w)).toBe(6)
    expect(atlas.shelves).toBe(1)
    expect(atlas.fill).toBeCloseTo((100 + 100 + 210) / 4096)
  })

  it("returns null when sprites cannot fit", () => {
    expect(packShelves([{ w: 60, h: 60 }], 64, 4)).toBeNull()
    expect(packShelves(sprites(200), 64, 2)).toBeNull()
  })

  it("grows the atlas to the next power of two", () => {
    expect(packAtlas([{ w: 60, h: 60 }], 4)!.size).toBe(128)
  })
})

describe("uvRect", () => {
  it("maps pixels to 0..1, flipping v for flipY textures", () => {
    const r = { id: 0, x: 4, y: 8, w: 16, h: 32 }
    expect(uvRect(r, 64, false)).toEqual({
      u0: 1 / 16,
      u1: 20 / 64,
      v0: 1 / 8,
      v1: 40 / 64,
    })
    const f = uvRect(r, 64)
    expect(f.v0).toBeCloseTo(1 - 40 / 64)
    expect(f.v1).toBeCloseTo(1 - 8 / 64)
  })
})
