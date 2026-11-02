import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import {
  circlesOverlap,
  pairCount,
  scatterCircles,
  seededRandom,
  SpatialGrid,
  typicalCandidates,
  type Circle,
} from "@/lib/collision-detection"

import {
  defineVisual,
  palette,
  useFixedStep,
  useVisual,
  useLiveReadout,
} from "../../kit"

type V = { broad: boolean; count: number; cell: number }

const W = 10
const H = 5.6
const MIN_R = 0.2
const MAX_R = 0.34
const MAX = 60
const MAX_PAIRS = pairCount(MAX)
const BOX_Z = -0.35 // the box sits above the pair meter
const METER_Z = 2.92
const METER_H = 0.24
const FLAT = -Math.PI / 2

// Drawn flat from above, so paint order replaces depth testing (no z-fighting).
enum Layer {
  Grid = 1,
  Pairs,
  Fill,
  Outline,
  HitFill,
  HitOutline,
  Meter,
}

const lineSegments = (points: number[], color: string, opacity: number) => {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3))
  const lines = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthTest: false,
    })
  )
  return lines
}

const rectPoints = (x0: number, z0: number, x1: number, z1: number) => [
  x0,
  0,
  z0,
  x1,
  0,
  z0,
  x1,
  0,
  z0,
  x1,
  0,
  z1,
  x1,
  0,
  z1,
  x0,
  0,
  z1,
  x0,
  0,
  z1,
  x0,
  0,
  z0,
]

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const circles = useMemo<Circle[]>(
    () => Array.from({ length: MAX }, () => ({ x: 0, y: 0, r: MIN_R })),
    []
  )
  const vel = useMemo(() => new Float32Array(MAX * 2), [])
  const hit = useMemo(() => new Uint8Array(MAX), [])
  const active = useMemo(() => circles.slice(0, v.count), [circles, v.count])
  const grid = useMemo(
    () => new SpatialGrid(W, H, v.cell, MAX, -W / 2, -H / 2),
    [v.cell]
  )

  useEffect(() => {
    const start = scatterCircles(MAX, W, H, MIN_R, MAX_R, 7)
    const rand = seededRandom(23)
    for (let i = 0; i < MAX; i++) {
      Object.assign(circles[i], start[i])
      const angle = rand() * Math.PI * 2
      const speed = 0.35 + rand() * 0.6
      vel[i * 2] = Math.cos(angle) * speed
      vel[i * 2 + 1] = Math.sin(angle) * speed
    }
  }, [resetKey, circles, vel])

  useFixedStep((dt) => {
    for (let i = 0; i < v.count; i++) {
      const c = circles[i]
      c.x += vel[i * 2] * dt
      c.y += vel[i * 2 + 1] * dt
      if (Math.abs(c.x) > W / 2 - c.r) {
        vel[i * 2] *= -1
        c.x = Math.sign(c.x) * (W / 2 - c.r)
      }
      if (Math.abs(c.y) > H / 2 - c.r) {
        vel[i * 2 + 1] *= -1
        c.y = Math.sign(c.y) * (H / 2 - c.r)
      }
    }
  }, 60)

  const unit = useMemo(
    () => ({
      disc: new THREE.CircleGeometry(1, 32).rotateX(FLAT),
      thin: new THREE.RingGeometry(0.88, 1, 32).rotateX(FLAT),
      thick: new THREE.RingGeometry(0.8, 1, 32).rotateX(FLAT),
      bar: new THREE.PlaneGeometry(1, 1).rotateX(FLAT).translate(0.5, 0, 0),
    }),
    []
  )
  useEffect(
    () => () => {
      for (const g of Object.values(unit)) g.dispose()
    },
    [unit]
  )

  const box = useMemo(
    () =>
      lineSegments(
        rectPoints(-W / 2, -H / 2, W / 2, H / 2),
        palette.accel,
        0.9
      ),
    []
  )
  const track = useMemo(
    () =>
      lineSegments(
        rectPoints(-W / 2, -METER_H / 2, W / 2, METER_H / 2),
        palette.accel,
        0.9
      ),
    []
  )
  const cells = useMemo(() => {
    const points: number[] = []
    for (let c = 1; c < grid.cols; c++) {
      const x = -W / 2 + c * v.cell
      points.push(x, 0, -H / 2, x, 0, H / 2)
    }
    for (let r = 1; r < grid.rows; r++) {
      const z = -H / 2 + r * v.cell
      points.push(-W / 2, 0, z, W / 2, 0, z)
    }
    return lineSegments(points, palette.tertiary, 0.35)
  }, [grid, v.cell])
  const pairs = useMemo(() => {
    const lines = lineSegments([], palette.tertiary, 1)
    lines.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(MAX_PAIRS * 6), 3)
    )
    lines.frustumCulled = false
    return lines
  }, [])
  useEffect(() => () => cells.geometry.dispose(), [cells])
  useEffect(
    () => () => {
      box.geometry.dispose()
      track.geometry.dispose()
      pairs.geometry.dispose()
    },
    [box, track, pairs]
  )

  // One narrow-phase test: record the candidate line and any true overlap.
  const test = useMemo(() => {
    const attr = pairs.geometry.attributes.position as THREE.BufferAttribute
    const state = { tested: 0, hits: 0 }
    const visit = (i: number, j: number) => {
      const a = circles[i]
      const b = circles[j]
      attr.setXYZ(state.tested * 2, a.x, 0, a.y)
      attr.setXYZ(state.tested * 2 + 1, b.x, 0, b.y)
      state.tested++
      if (circlesOverlap(a, b)) {
        hit[i] = hit[j] = 1
        state.hits++
      }
    }
    return { attr, state, visit }
  }, [pairs, circles, hit])

  const fill = useRef<THREE.InstancedMesh>(null)
  const outline = useRef<THREE.InstancedMesh>(null)
  const hitFill = useRef<THREE.InstancedMesh>(null)
  const hitOutline = useRef<THREE.InstancedMesh>(null)
  const testedBar = useRef<THREE.Mesh>(null)
  const hitBar = useRef<THREE.Mesh>(null)
  const matrix = useMemo(() => new THREE.Matrix4(), [])

  useLiveReadout(() => {
    const all = pairCount(v.count)
    const { tested, hits } = test.state
    return `${tested} of ${all} pairs tested this frame: ${Math.round((1 - tested / all) * 100)}% skipped · ${hits} overlapping`
  })

  useFrame(() => {
    const { state, visit, attr } = test
    hit.fill(0)
    state.tested = 0
    state.hits = 0
    if (v.broad) {
      grid.build(active)
      grid.candidates(visit)
    } else {
      for (let i = 0; i < v.count; i++)
        for (let j = i + 1; j < v.count; j++) visit(i, j)
    }
    pairs.geometry.setDrawRange(0, state.tested * 2)
    attr.needsUpdate = true

    let calm = 0
    let touching = 0
    for (let i = 0; i < v.count; i++) {
      const c = circles[i]
      matrix.makeScale(c.r, 1, c.r).setPosition(c.x, 0, c.y)
      if (hit[i]) {
        hitFill.current?.setMatrixAt(touching, matrix)
        hitOutline.current?.setMatrixAt(touching++, matrix)
      } else {
        fill.current?.setMatrixAt(calm, matrix)
        outline.current?.setMatrixAt(calm++, matrix)
      }
    }
    for (const [mesh, count] of [
      [fill.current, calm],
      [outline.current, calm],
      [hitFill.current, touching],
      [hitOutline.current, touching],
    ] as const) {
      if (!mesh) continue
      mesh.count = count
      mesh.instanceMatrix.needsUpdate = true
    }

    const all = pairCount(v.count)
    testedBar.current?.scale.setX(Math.max(1e-3, (W * state.tested) / all))
    hitBar.current?.scale.setX(Math.max(1e-3, (W * state.hits) / all))
  })

  // Transparent so meshes and lines share one queue ordered by renderOrder.
  const flat = {
    toneMapped: false,
    depthTest: false,
    transparent: true,
  }
  const instances = [undefined, undefined, MAX] as const
  return (
    <>
      <group position={[0, 0, BOX_Z]}>
        <primitive object={cells} visible={v.broad} renderOrder={Layer.Grid} />
        <primitive object={box} renderOrder={Layer.Grid} />
        <primitive
          object={pairs}
          renderOrder={Layer.Pairs}
          material-opacity={v.broad ? 0.9 : 0.3}
        />
        <instancedMesh
          ref={fill}
          args={instances}
          geometry={unit.disc}
          frustumCulled={false}
          renderOrder={Layer.Fill}
        >
          <meshBasicMaterial color={palette.surface} {...flat} />
        </instancedMesh>
        <instancedMesh
          ref={outline}
          args={instances}
          geometry={unit.thin}
          frustumCulled={false}
          renderOrder={Layer.Outline}
        >
          <meshBasicMaterial color={palette.subject} {...flat} />
        </instancedMesh>
        <instancedMesh
          ref={hitFill}
          args={instances}
          geometry={unit.disc}
          frustumCulled={false}
          renderOrder={Layer.HitFill}
        >
          <meshBasicMaterial color={palette.error} {...flat} />
        </instancedMesh>
        <instancedMesh
          ref={hitOutline}
          args={instances}
          geometry={unit.thick}
          frustumCulled={false}
          renderOrder={Layer.HitOutline}
        >
          <meshBasicMaterial color={palette.subject} {...flat} />
        </instancedMesh>
      </group>
      <group position={[0, 0, METER_Z]}>
        <mesh
          ref={testedBar}
          position={[-W / 2, 0, 0]}
          scale={[1, 1, METER_H]}
          geometry={unit.bar}
          renderOrder={Layer.Meter}
        >
          <meshBasicMaterial color={palette.accel} {...flat} />
        </mesh>
        <mesh
          ref={hitBar}
          position={[-W / 2, 0, 0]}
          scale={[1, 1, METER_H]}
          geometry={unit.bar}
          renderOrder={Layer.Meter + 1}
        >
          <meshBasicMaterial color={palette.error} {...flat} />
        </mesh>
        <primitive object={track} renderOrder={Layer.Meter + 2} />
      </group>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 8.2, 0.001], target: [0, 0, 0] },
  orbit: false,
  params: [
    { key: "broad", label: "Broad phase", type: "toggle", value: true },
    { key: "count", label: "Objects", min: 10, max: MAX, step: 5, value: 30 },
    {
      key: "cell",
      label: "Cell size",
      min: 0.7,
      max: 4,
      step: 0.1,
      value: 1.2,
      unit: "u",
    },
  ],
  readout: (v) => {
    const all = pairCount(v.count)
    if (!v.broad)
      return `Broad phase off: all ${all} pairs tested exactly, every frame`
    const tested = typicalCandidates(v.count, W, H, MIN_R, MAX_R, v.cell)
    const saved = Math.round((1 - tested / all) * 100)
    return `Grid tests about ${tested} of ${all} pairs on a typical frame: ${saved}% skipped`
  },
  Scene,
})
