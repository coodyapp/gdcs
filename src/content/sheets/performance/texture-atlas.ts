import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "texture-atlas",
  category: "performance",
  subcategory: "gpu",
  title: "Texture Atlas",
  hook: "many images, one texture, one material",
  summary:
    "Pack many sprites into one texture and address each by its UV rectangle, so objects share a material and batch into few draw calls. Pad to stop bleeding.",
  level: "common",
  tags: ["sprites", "uv", "packing", "batching", "mipmaps"],
  updated: "2026-11-01",
  prompt:
    "Write a texture-atlas builder in TypeScript for Three.js. Input: an array of HTMLImageElement or ImageBitmap with ids. Pack them with a shelf packer (sort by height, rows left to right) into the smallest power-of-two square up to 4096, with configurable padding filled by extruding each sprite's edge pixels on an OffscreenCanvas. Output a CanvasTexture (flipY true, sRGB colour space) and a map from id to UV rect {u0, v0, u1, v1}. Provide a helper that remaps a PlaneGeometry's uv attribute into a given rect. Return null if the sprites can't fit. Write tests: padded rects never overlap, all lie inside the atlas, and UVs stay inside 0–1.",
  related: ["draw-calls", "overdraw", "frame-budget"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A **texture atlas** (sprite sheet) is one large texture holding many small images. Each image is addressed by its **UV rectangle** `(u0, v0) – (u1, v1)` instead of by its own texture. Objects that used to need different textures can now share one material, which is what lets them batch or instance into a handful of [draw calls](/performance/gpu/draw-calls) and avoids texture-binding state changes.",
    "Packing is a 2D bin-packing problem. A **shelf packer** sorts sprites by height and fills rows left to right. It is simple, fast and good enough for most atlases (often 70–85% full). Guillotine and MaxRects packers squeeze more in for offline tools. Atlases are usually power-of-two squares (1024, 2048, 4096) for the widest mipmap and compression support.",
    "Neighbouring sprites **bleed** into each other because linear filtering samples a 2×2 texel neighbourhood and mipmaps average whole blocks. Leave **padding** around each sprite, fill it by extruding the sprite's edge pixels, and keep UVs on the sprite's own pixels. Each mip level halves the gutter, so 2 px of padding protects about one mip level. More levels need more padding or a capped `maxLevel`.",
    "Texture arrays (`DataArrayTexture` in Three.js) are an alternative when every sprite is the same size: layers never bleed and each keeps full mipmaps.",
  ],
  formulas: [
    {
      label: "Pixel rect → UV (flipY texture)",
      math: tex`u_0 = \frac{x}{S},\; u_1 = \frac{x+w}{S},\; v_0 = 1-\frac{y+h}{S},\; v_1 = 1-\frac{y}{S}`,
      note: "S is the atlas size in pixels; (x, y) is the sprite's top-left with y pointing down.",
    },
    {
      label: "Remap a mesh's 0–1 UVs into the rect",
      math: tex`uv' = uv_0 + uv \odot (uv_1 - uv_0)`,
    },
  ],
  rules: [
    "Use 2–4 px of padding per side for filtered, mipmapped sprites; 1 px is enough for nearest-filtered pixel art without mipmaps.",
    "Fill padding by extruding edge pixels, not with transparent or black pixels.",
    "Group sprites that appear together into the same atlas (one per level or UI screen) so you don't load unused images.",
    "Keep atlases ≤ 4096² for broad device support, and check `renderer.capabilities.maxTextureSize`.",
    "Disable mipmaps or clamp `maxLevel` for UI atlases that are always drawn at 1:1.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Shelf packing plus UV rects for a sprite atlas:",
      code: `function packShelves(sizes: { w: number; h: number }[], S: number, pad = 2) {
  const order = sizes.map((s, id) => ({ ...s, id })).sort((a, b) => b.h - a.h)
  const rects = new Array(sizes.length)
  let x = 0, y = 0, shelfH = 0
  for (const s of order) {
    const w = s.w + 2 * pad, h = s.h + 2 * pad
    if (x + w > S) { y += shelfH; x = 0; shelfH = 0 } // next shelf
    if (y + h > S || w > S) return null              // doesn't fit
    rects[s.id] = { x: x + pad, y: y + pad, w: s.w, h: s.h }
    x += w
    shelfH = Math.max(shelfH, h)
  }
  return rects
}

// UV rect for a Three.js texture (flipY = true): v grows upward.
const uv = (r: { x: number; y: number; w: number; h: number }, S: number) => ({
  u0: r.x / S, u1: (r.x + r.w) / S,
  v0: 1 - (r.y + r.h) / S, v1: 1 - r.y / S,
})`,
    },
  ],
  mistakes: [
    "No padding, so mipmapped sprites show thin lines of their neighbours' colours at their edges.",
    "Forgetting that image textures are flipped in Y, so every UV rect samples the wrong row.",
    "Packing unrelated sprites together, which forces loading a 4K texture for one icon.",
    "Repeating (tiling) a sprite inside an atlas with `RepeatWrapping`. Wrap modes apply to the whole atlas, so tile in the shader with `fract()` instead.",
  ],
  reading: [
    {
      title: "Three.js docs — Texture (offset, repeat, flipY)",
      url: "https://threejs.org/docs/#api/en/textures/Texture",
    },
    {
      title: "Khronos OpenGL wiki — Texture (filtering and mipmaps)",
      url: "https://www.khronos.org/opengl/wiki/Texture",
    },
  ],
  visual:
    "Left: sprites in the game world, drawn as one mesh that samples the atlas on the right. The highlighted sprite and its UV rectangle are outlined in white, and the faint border around each tile is its padding. Change the padding and sprite count to see the packer refill the shelves.",
}

export default sheet
