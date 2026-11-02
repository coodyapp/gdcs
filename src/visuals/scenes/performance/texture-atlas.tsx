import { useEffect, useMemo } from "react"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import { packAtlas, uvRect, type Atlas, type AtlasRect } from "@/lib/atlas"

import { defineVisual, palette, useAnimationTime, type Vec3 } from "../../kit"

type V = { count: number; padding: number }

const MAX = 24
const SIZES = [16, 24, 32, 40, 48, 64]
// Categorical series in assignment order, minus cyan (reserved for the
// selection outline) and red (errors). Glyphs (circle / diamond / square)
// tell sprites apart without hue.
const COLORS = [
  palette.secondary,
  palette.tertiary,
  palette.positive,
  palette.warning,
  palette.accel,
]

// Deterministic sprite sizes (LCG), so the atlas looks the same every visit.
const SPRITES = (() => {
  let seed = 7
  const next = () => (seed = (seed * 1664525 + 1013904223) >>> 0)
  return Array.from({ length: MAX }, () => ({
    w: SIZES[next() % SIZES.length],
    h: SIZES[next() % SIZES.length],
  }))
})()

const ATLAS_X = 2.75
const ATLAS_L = 4.6 // atlas side in scene units
const WORLD_X = -3.2
const CELL = 1.05 // world grid cell
const COLS = 5

function drawAtlas(atlas: Atlas) {
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = atlas.size
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#171717"
  ctx.fillRect(0, 0, atlas.size, atlas.size)
  const p = atlas.padding
  atlas.rects.forEach((r, i) => {
    const color = COLORS[i % COLORS.length]
    // Padding: the sprite's edge colour extruded outward (drawn faint here).
    ctx.globalAlpha = 0.35
    ctx.fillStyle = color
    ctx.fillRect(r.x - p, r.y - p, r.w + 2 * p, r.h + 2 * p)
    ctx.globalAlpha = 1
    ctx.fillRect(r.x, r.y, r.w, r.h)
    // A simple glyph so each sprite is recognisable.
    ctx.fillStyle = "rgba(10,10,10,0.55)"
    const cx = r.x + r.w / 2
    const cy = r.y + r.h / 2
    const s = Math.min(r.w, r.h) * 0.28
    ctx.beginPath()
    if (i % 3 === 0) ctx.arc(cx, cy, s, 0, Math.PI * 2)
    else if (i % 3 === 1) {
      ctx.moveTo(cx, cy - s)
      ctx.lineTo(cx + s, cy)
      ctx.lineTo(cx, cy + s)
      ctx.lineTo(cx - s, cy)
    } else ctx.rect(cx - s, cy - s, 2 * s, 2 * s)
    ctx.fill()
  })
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return texture
}

/** Centre and display size of sprite i in the "game world" on the left. */
function worldQuad(i: number, r: AtlasRect, count: number) {
  const rows = Math.ceil(count / COLS)
  const x = WORLD_X + ((i % COLS) - (COLS - 1) / 2) * CELL
  const y = ((rows - 1) / 2 - Math.floor(i / COLS)) * CELL
  const k = (CELL * 0.85) / 64
  return { x, y, w: r.w * k, h: r.h * k }
}

/** One mesh, one material: every sprite is a quad sampling the atlas. */
function buildWorld(atlas: Atlas, count: number) {
  const pos: number[] = []
  const uv: number[] = []
  const index: number[] = []
  atlas.rects.forEach((r, i) => {
    const q = worldQuad(i, r, count)
    const t = uvRect(r, atlas.size)
    const b = pos.length / 3
    pos.push(
      q.x - q.w / 2,
      q.y - q.h / 2,
      0,
      q.x + q.w / 2,
      q.y - q.h / 2,
      0,
      q.x + q.w / 2,
      q.y + q.h / 2,
      0,
      q.x - q.w / 2,
      q.y + q.h / 2,
      0
    )
    uv.push(t.u0, t.v0, t.u1, t.v0, t.u1, t.v1, t.u0, t.v1)
    index.push(b, b + 1, b + 2, b, b + 2, b + 3)
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(index)
  return g
}

const toAtlas = (atlas: Atlas, x: number, y: number): Vec3 => [
  ATLAS_X - ATLAS_L / 2 + (x / atlas.size) * ATLAS_L,
  ATLAS_L / 2 - (y / atlas.size) * ATLAS_L,
  0.02,
]

const outline = (x0: number, y0: number, x1: number, y1: number): Vec3[] => [
  [x0, y0, 0.02],
  [x1, y0, 0.02],
  [x1, y1, 0.02],
  [x0, y1, 0.02],
  [x0, y0, 0.02],
]

function Highlight({ atlas, count }: { atlas: Atlas; count: number }) {
  const time = useAnimationTime()
  const i = Math.floor(time / 1.1) % count
  const r = atlas.rects[i]
  const q = worldQuad(i, r, count)
  const [ax0, ay0] = toAtlas(atlas, r.x, r.y)
  const [ax1, ay1] = toAtlas(atlas, r.x + r.w, r.y + r.h)
  const pad = 0.06
  return (
    <>
      <Line
        points={outline(
          q.x - q.w / 2 - pad,
          q.y - q.h / 2 - pad,
          q.x + q.w / 2 + pad,
          q.y + q.h / 2 + pad
        )}
        color={palette.subject}
        lineWidth={2.5}
      />
      <Line
        points={outline(ax0, ay0, ax1, ay1)}
        color={palette.subject}
        lineWidth={2.5}
      />
      <Line
        points={[
          [q.x + q.w / 2 + pad, q.y, 0.02],
          [ax0, (ay0 + ay1) / 2, 0.02],
        ]}
        color={palette.subject}
        lineWidth={1}
        dashed
        dashSize={0.12}
        gapSize={0.08}
      />
    </>
  )
}

function Scene({ v }: { v: V }) {
  const atlas = useMemo(
    () => packAtlas(SPRITES.slice(0, v.count), v.padding)!,
    [v.count, v.padding]
  )
  const texture = useMemo(() => drawAtlas(atlas), [atlas])
  const world = useMemo(() => buildWorld(atlas, v.count), [atlas, v.count])
  useEffect(() => () => texture.dispose(), [texture])
  useEffect(() => () => world.dispose(), [world])

  return (
    <>
      <mesh geometry={world}>
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <mesh position={[ATLAS_X, 0, 0]}>
        <planeGeometry args={[ATLAS_L, ATLAS_L]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <Line
        points={outline(
          ATLAS_X - ATLAS_L / 2,
          -ATLAS_L / 2,
          ATLAS_X + ATLAS_L / 2,
          ATLAS_L / 2
        )}
        color={palette.guide}
        lineWidth={1}
      />
      <Highlight atlas={atlas} count={v.count} />
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 0, 8.4], target: [0, 0, 0] },
  grid: false,
  orbit: false,
  params: [
    { key: "count", label: "Sprites", min: 6, max: MAX, step: 1, value: 20 },
    {
      key: "padding",
      label: "Padding",
      min: 0,
      max: 8,
      step: 1,
      value: 3,
      unit: "px",
    },
  ],
  readout: (v) => {
    const a = packAtlas(SPRITES.slice(0, v.count), v.padding)
    if (!a) return "Does not fit"
    return `${v.count} sprites → one ${a.size}×${a.size} atlas, ${a.shelves} shelves, ${Math.round(a.fill * 100)}% sprite pixels · 1 texture, 1 material, 1 draw call`
  },
  Scene,
})
