import { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { Line } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import {
  DeltaSim,
  fullPacketBytes,
  FULL,
  LOST,
  TICK_HZ,
} from "@/lib/delta-compression"

import { defineVisual, palette, useClock, useLiveReadout } from "../../kit"

type V = { share: number; loss: number; count: number; delta: boolean }

const MAX_ENTITIES = 400
/** Entity grid, on the left. */
const GRID_SIDE = 6.5
const GRID_X = -3.15
/** Packet strip, on the right: newest at the right edge, one bar per tick. */
const STRIP_LEFT = 0.85
const STRIP_RIGHT = 6.25
const STRIP_BASE = -3.25
const STRIP_FULL = 2.75
const BARS = 30
const BAR_PITCH = (STRIP_RIGHT - STRIP_LEFT) / BARS
const BAR_WIDTH = BAR_PITCH * 0.72

function crossGeometry() {
  const a = 1
  const b = 0.3
  const shape = new THREE.Shape()
  const outline: [number, number][] = [
    [b, 0],
    [a, a - b],
    [a - b, a],
    [0, b],
    [b - a, a],
    [-a, a - b],
    [-b, 0],
    [-a, b - a],
    [b - a, -a],
    [0, -b],
    [a - b, -a],
    [a, b - a],
  ]
  shape.moveTo(...outline[0])
  outline.slice(1).forEach((p) => shape.lineTo(...p))
  return new THREE.ShapeGeometry(shape)
}

function Scene({ v }: { v: V }) {
  const time = useClock()
  const sim = useRef<DeltaSim | null>(null)
  const makeSim = (startTick: number) =>
    new DeltaSim({
      n: v.count,
      share: v.share / 100,
      loss: v.loss / 100,
      delta: v.delta,
      startTick,
    })
  // A new count is a new world. Other settings apply in place, so bars keep going.
  useMemo(() => {
    sim.current = makeSim(Math.floor(time.current * TICK_HZ))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.count])

  const outlines = useRef<THREE.InstancedMesh>(null)
  const fresh = useRef<THREE.InstancedMesh>(null)
  const carried = useRef<THREE.InstancedMesh>(null)
  const wasted = useRef<THREE.InstancedMesh>(null)
  const deltaBars = useRef<THREE.InstancedMesh>(null)
  const fullBars = useRef<THREE.InstancedMesh>(null)
  const lostBars = useRef<THREE.InstancedMesh>(null)
  const crosses = useRef<THREE.InstancedMesh>(null)

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const cross = useMemo(crossGeometry, [])
  const square = useMemo(() => {
    // A square ring whose outer side is 1.
    const ring = new THREE.RingGeometry(0.585, Math.SQRT1_2, 4, 1)
    ring.rotateZ(Math.PI / 4)
    return ring
  }, [])
  useEffect(() => () => cross.dispose(), [cross])
  useEffect(() => () => square.dispose(), [square])

  const layout = useMemo(() => {
    const cols = Math.ceil(Math.sqrt(v.count))
    const rows = Math.ceil(v.count / cols)
    const cell = GRID_SIDE / Math.max(cols, rows)
    const xs = new Float32Array(v.count)
    const ys = new Float32Array(v.count)
    for (let e = 0; e < v.count; e++) {
      xs[e] = GRID_X + (e % cols) * cell - ((cols - 1) * cell) / 2
      ys[e] = ((rows - 1) * cell) / 2 - Math.floor(e / cols) * cell
    }
    return { cell, xs, ys }
  }, [v.count])

  const put = (
    mesh: THREE.InstancedMesh,
    i: number,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy = sx
  ) => {
    dummy.position.set(x, y, z)
    dummy.scale.set(sx, sy, 1)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  }
  const commit = (mesh: THREE.InstancedMesh, count: number) => {
    mesh.count = count
    mesh.instanceMatrix.needsUpdate = true
  }

  useLayoutEffect(() => {
    const mesh = outlines.current
    if (!mesh) return
    for (let e = 0; e < v.count; e++)
      put(mesh, e, layout.xs[e], layout.ys[e], 0, layout.cell * 0.88)
    commit(mesh, v.count)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, v.count])

  const drawnTick = useRef(-1)

  useFrame(() => {
    if (
      !fresh.current ||
      !carried.current ||
      !wasted.current ||
      !deltaBars.current ||
      !fullBars.current ||
      !lostBars.current ||
      !crosses.current ||
      !sim.current
    )
      return
    const now = time.current
    const target = Math.floor(now * TICK_HZ)
    if (target + 1 < sim.current.tick) sim.current = makeSim(target) // reset
    const s = sim.current
    s.share = v.share / 100
    s.loss = v.loss / 100
    s.delta = v.delta
    while (s.tick <= target) s.step()

    // The grid shows the newest packet and changes only on server ticks.
    if (s.tick !== drawnTick.current) {
      drawnTick.current = s.tick
      const { cell, xs, ys } = layout
      let a = 0
      let b = 0
      let c = 0
      for (let e = 0; e < s.n; e++) {
        if (s.changedNow[e])
          put(fresh.current, a++, xs[e], ys[e], 0.01, cell * 0.72)
        else if (s.inPacket[e]) {
          if (s.lastKind === "delta")
            put(carried.current, b++, xs[e], ys[e], 0.01, cell * 0.32)
          else put(wasted.current, c++, xs[e], ys[e], 0.01, cell * 0.2)
        }
      }
      commit(fresh.current, a)
      commit(carried.current, b)
      commit(wasted.current, c)
    }

    // Bars scroll left between ticks, newest entering at the right edge.
    const scroll = (now * TICK_HZ - target) * BAR_PITCH
    const span = STRIP_FULL - STRIP_BASE
    const full = fullPacketBytes(s.n)
    let d = 0
    let f = 0
    let l = 0
    let x = 0
    const bars = Math.min(s.recorded, BARS)
    for (let back = 0; back < bars; back++) {
      const cx = STRIP_RIGHT - BAR_PITCH * (back + 0.5) - scroll
      if (cx < STRIP_LEFT + BAR_WIDTH / 2) break
      const flags = s.recordFlags(back)
      const h = (s.recordBytes(back) / full) * span
      const y = STRIP_BASE + h / 2
      if (flags & LOST) {
        put(lostBars.current, l++, cx, y, 0, BAR_WIDTH, h)
        put(crosses.current, x++, cx, STRIP_BASE + h + 0.17, 0.02, 0.1)
      } else if (flags & FULL)
        put(fullBars.current, f++, cx, y, 0, BAR_WIDTH, h)
      else put(deltaBars.current, d++, cx, y, 0, BAR_WIDTH, h)
    }
    commit(deltaBars.current, d)
    commit(fullBars.current, f)
    commit(lostBars.current, l)
    commit(crosses.current, x)
  })

  useLiveReadout(() => {
    const s = sim.current
    if (!s) return null
    const { bytesPerSecond, fullPerSecond, saving } = s.rates()
    const rate = `${Math.round(bytesPerSecond).toLocaleString("en-US")} B/s vs ${fullPerSecond.toLocaleString("en-US")} B/s for full snapshots · saving ${Math.round(saving * 100)}%`
    if (s.lastKind === "delta")
      return `${rate} · baseline age ${s.lastAge} ticks (${s.lastAge * (1000 / TICK_HZ)} ms)`
    const why =
      s.lastKind === "full-too-old"
        ? "too old, full snapshot"
        : s.lastKind === "full-delta-off"
          ? "none, delta off"
          : "none, full snapshot"
    return `${rate} · baseline ${why}`
  })

  return (
    <>
      <instancedMesh
        ref={outlines}
        args={[square, undefined, MAX_ENTITIES]}
        frustumCulled={false}
      >
        <meshBasicMaterial color={palette.tertiary} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={fresh}
        args={[undefined, undefined, MAX_ENTITIES]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.moving} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={carried}
        args={[undefined, undefined, MAX_ENTITIES]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.moving} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={wasted}
        args={[undefined, undefined, MAX_ENTITIES]}
        frustumCulled={false}
      >
        <circleGeometry args={[0.5, 16]} />
        <meshBasicMaterial color={palette.accel} toneMapped={false} />
      </instancedMesh>

      <Line
        points={[
          [STRIP_LEFT, STRIP_BASE, 0],
          [STRIP_RIGHT, STRIP_BASE, 0],
        ]}
        color={palette.tertiary}
        lineWidth={1}
      />
      <Line
        points={[
          [STRIP_LEFT, STRIP_FULL, 0],
          [STRIP_RIGHT, STRIP_FULL, 0],
        ]}
        color={palette.subject}
        lineWidth={1.5}
        dashed
        dashSize={0.18}
        gapSize={0.14}
      />
      <instancedMesh
        ref={deltaBars}
        args={[undefined, undefined, BARS]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.moving} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={fullBars}
        args={[undefined, undefined, BARS]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.subject} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={lostBars}
        args={[undefined, undefined, BARS]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.tertiary} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={crosses}
        args={[cross, undefined, BARS]}
        frustumCulled={false}
      >
        <meshBasicMaterial color={palette.error} toneMapped={false} />
      </instancedMesh>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 0, 10], target: [0, 0, 0] },
  orbit: false,
  params: [
    {
      key: "share",
      label: "Entities moving",
      min: 0,
      max: 100,
      step: 5,
      value: 15,
      unit: "%",
    },
    {
      key: "loss",
      label: "Packet loss",
      min: 0,
      max: 50,
      step: 1,
      value: 10,
      unit: "%",
    },
    {
      key: "count",
      label: "Entities",
      min: 25,
      max: MAX_ENTITIES,
      step: 25,
      value: 100,
    },
    { key: "delta", label: "Delta compression", type: "toggle", value: true },
  ],
  readout: (v) =>
    `${v.count} entities · full snapshot ${fullPacketBytes(v.count).toLocaleString("en-US")} bytes · ${TICK_HZ} Hz`,
  Scene,
})
