import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import {
  bruteForceChecks,
  circlesOverlap,
  gridPairs,
  SpatialGrid,
  type Circle,
} from "@/lib/spatial-grid"

import { defineVisual, palette, useFixedStep, useVisual } from "../../kit"

type V = { count: number; cell: number }

const W = 10
const H = 6
const R = 0.14
const MAX = 200
const MAX_LINES = 4000

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 2 ** 32
  }
}

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const circles = useMemo<Circle[]>(
    () => Array.from({ length: MAX }, () => ({ x: 0, y: 0, r: R })),
    []
  )
  const vel = useMemo(() => new Float32Array(MAX * 2), [])
  const active = useMemo(() => circles.slice(0, v.count), [circles, v.count])
  const grid = useMemo(
    () => new SpatialGrid(W, H, v.cell, MAX, -W / 2, -H / 2),
    [v.cell]
  )
  const hit = useMemo(() => new Uint8Array(MAX), [])
  const dots = useRef<THREE.InstancedMesh>(null)
  const cells = useRef<THREE.InstancedMesh>(null)
  const m = useMemo(() => new THREE.Matrix4(), [])
  const ok = useMemo(() => new THREE.Color(palette.positive), [])
  const bad = useMemo(() => new THREE.Color(palette.negative), [])
  const cellColor = useMemo(() => new THREE.Color(), [])
  const dim = useMemo(
    () => new THREE.Color(palette.primary).multiplyScalar(0.1),
    []
  )
  const lit = useMemo(
    () => new THREE.Color(palette.primary).multiplyScalar(0.24),
    []
  )

  useEffect(() => {
    const r = rng(11)
    for (let i = 0; i < MAX; i++) {
      circles[i].x = (r() - 0.5) * (W - 2 * R)
      circles[i].y = (r() - 0.5) * (H - 2 * R)
      const a = r() * Math.PI * 2
      const s = 0.35 + r() * 0.8
      vel[i * 2] = Math.cos(a) * s
      vel[i * 2 + 1] = Math.sin(a) * s
    }
  }, [resetKey, circles, vel])

  // Grid lines, rebuilt when the cell size changes.
  const gridLines = useMemo(() => {
    const pts: number[] = []
    for (let c = 0; c <= grid.cols; c++) {
      const x = Math.min(-W / 2 + c * v.cell, W / 2)
      pts.push(x, 0.005, -H / 2, x, 0.005, -H / 2 + grid.rows * v.cell)
    }
    for (let r = 0; r <= grid.rows; r++) {
      const z = -H / 2 + r * v.cell
      pts.push(-W / 2, 0.005, z, -W / 2 + grid.cols * v.cell, 0.005, z)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3))
    return new THREE.LineSegments(
      g,
      new THREE.LineBasicMaterial({
        color: palette.guide,
        transparent: true,
        opacity: 0.5,
      })
    )
  }, [grid, v.cell])
  useEffect(() => () => gridLines.geometry.dispose(), [gridLines])

  // Candidate pairs the grid actually tests.
  const pairLines = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(MAX_LINES * 6), 3)
    )
    return new THREE.LineSegments(
      g,
      new THREE.LineBasicMaterial({
        color: palette.foreground,
        transparent: true,
        opacity: 0.28,
      })
    )
  }, [])

  const visit = useMemo(() => {
    const attr = pairLines.geometry.attributes.position as THREE.BufferAttribute
    const state = { n: 0 }
    const fn = (i: number, j: number) => {
      const a = circles[i]
      const b = circles[j]
      if (state.n < MAX_LINES) {
        attr.setXYZ(state.n * 2, a.x, 0.01, a.y)
        attr.setXYZ(state.n * 2 + 1, b.x, 0.01, b.y)
        state.n++
      }
      if (circlesOverlap(a, b)) hit[i] = hit[j] = 1
    }
    return { fn, state, attr }
  }, [pairLines, circles, hit])

  useFixedStep((dt) => {
    for (let i = 0; i < v.count; i++) {
      const c = circles[i]
      c.x += vel[i * 2] * dt
      c.y += vel[i * 2 + 1] * dt
      if (Math.abs(c.x) > W / 2 - R) {
        vel[i * 2] *= -1
        c.x = Math.sign(c.x) * (W / 2 - R)
      }
      if (Math.abs(c.y) > H / 2 - R) {
        vel[i * 2 + 1] *= -1
        c.y = Math.sign(c.y) * (H / 2 - R)
      }
    }
  }, 60)

  useFrame(() => {
    const d = dots.current
    const cl = cells.current
    if (!d || !cl) return
    hit.fill(0)
    grid.build(active)
    visit.state.n = 0
    grid.candidates(visit.fn)
    pairLines.geometry.setDrawRange(0, visit.state.n * 2)
    visit.attr.needsUpdate = true

    for (let i = 0; i < v.count; i++) {
      m.makeTranslation(circles[i].x, 0.03, circles[i].y)
      d.setMatrixAt(i, m)
      d.setColorAt(i, hit[i] ? bad : ok)
    }
    d.count = v.count
    d.instanceMatrix.needsUpdate = true
    if (d.instanceColor) d.instanceColor.needsUpdate = true

    const n = grid.cols * grid.rows
    for (let c = 0; c < n; c++) {
      const cx = c % grid.cols
      const cy = Math.floor(c / grid.cols)
      const occupied = grid.counts[c] > 0
      m.makeScale(v.cell * 0.96, 1, v.cell * 0.96).setPosition(
        -W / 2 + (cx + 0.5) * v.cell,
        0,
        -H / 2 + (cy + 0.5) * v.cell
      )
      if (!occupied) m.makeScale(0, 0, 0)
      cl.setMatrixAt(c, m)
      cl.setColorAt(c, cellColor.copy(grid.counts[c] > 1 ? lit : dim))
    }
    cl.count = n
    cl.instanceMatrix.needsUpdate = true
    if (cl.instanceColor) cl.instanceColor.needsUpdate = true
  })

  const maxCells = Math.ceil(W / 0.4) * Math.ceil(H / 0.4)
  return (
    <>
      <instancedMesh ref={cells} args={[undefined, undefined, maxCells]}>
        <boxGeometry args={[1, 0.005, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <primitive object={gridLines} />
      <primitive object={pairLines} />
      <instancedMesh ref={dots} args={[undefined, undefined, MAX]}>
        <cylinderGeometry args={[R, R, 0.06, 20]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </>
  )
}

/** Grid test count on a seeded, evenly spread sample (what a typical frame does). */
function sampleChecks(count: number, cell: number) {
  const r = rng(5)
  const sample = Array.from({ length: count }, () => ({
    x: (r() - 0.5) * W,
    y: (r() - 0.5) * H,
    r: R,
  }))
  return gridPairs(sample, new SpatialGrid(W, H, cell, count, -W / 2, -H / 2))
    .checks
}

export default defineVisual<V>({
  camera: { position: [0, 8.2, 0.001], target: [0, 0, 0] },
  grid: false,
  orbit: false,
  params: [
    { key: "count", label: "Circles", min: 10, max: MAX, step: 5, value: 70 },
    {
      key: "cell",
      label: "Cell size",
      min: 0.4,
      max: 3,
      step: 0.1,
      value: 1,
      unit: "u",
    },
  ],
  readout: (v) => {
    const brute = bruteForceChecks(v.count)
    const grid = sampleChecks(v.count, v.cell)
    return `Brute force ${brute.toLocaleString("en-US")} tests · grid ≈ ${grid.toLocaleString("en-US")} tests (${((grid / brute) * 100).toFixed(1)}%) on a typical frame`
  },
  Scene,
})
