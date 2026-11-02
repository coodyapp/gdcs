import { useEffect, useMemo, useRef } from "react"
import { Line } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import {
  requiredDelay,
  RUN_SECONDS,
  simulateRun,
  truePosition,
} from "@/lib/snapshot-interpolation"

import { defineVisual, palette, useClock, useLiveReadout } from "../../kit"

type V = { sendHz: number; jitter: number; delay: number; loss: number }

/** Timeline strip: seconds of server time scroll left from "now" on the right. */
const NOW_X = 5.8
const SCALE = 10
const AXIS_Y = -3.1
const STRIP_HALF = 0.55
const HISTORY = 1.15
const STRIP_LEFT = NOW_X - HISTORY * SCALE
const toRun = (v: V) => ({
  sendHz: v.sendHz,
  jitterMs: v.jitter,
  delayMs: v.delay,
  loss: v.loss / 100,
})

const TRAIL_SEGMENTS = 72
const TRAIL_SECONDS = 1.2
const MARK_SECONDS = 4
const MAX_DOTS = 80
const MAX_MARKS = 64

const PATH_POINTS: [number, number, number][] = Array.from(
  { length: 241 },
  (_, i) => {
    const { x, y } = truePosition((i / 240) * (RUN_SECONDS / 3))
    return [x, y, -0.02]
  }
)

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
  const run = useMemo(() => simulateRun(toRun(v)), [v])
  const runRef = useRef(run)
  runRef.current = run
  const cursorX = NOW_X - run.lag * SCALE

  const disc = useRef<THREE.Mesh>(null)
  const dryCross = useRef<THREE.Mesh>(null)
  const ring = useRef<THREE.Mesh>(null)
  const cursor = useRef<THREE.Mesh>(null)
  const bracket = useRef<THREE.Mesh>(null)
  const trail = useRef<THREE.InstancedMesh>(null)
  const dots = useRef<THREE.InstancedMesh>(null)
  const lost = useRef<THREE.InstancedMesh>(null)
  const crosses = useRef<THREE.InstancedMesh>(null)
  const bands = useRef<THREE.InstancedMesh>(null)

  const cross = useMemo(crossGeometry, [])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])
  const colors = useMemo(
    () => ({
      white: new THREE.Color(palette.subject),
      grey: new THREE.Color(palette.tertiary),
      yellow: new THREE.Color(palette.moving),
      red: new THREE.Color(palette.error),
      stage: new THREE.Color(palette.stage),
    }),
    []
  )
  useEffect(() => () => cross.dispose(), [cross])

  const put = (
    mesh: THREE.InstancedMesh,
    i: number,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy = sx,
    angle = 0
  ) => {
    dummy.position.set(x, y, z)
    dummy.scale.set(sx, sy, 1)
    dummy.rotation.set(0, 0, angle)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  }
  const commit = (mesh: THREE.InstancedMesh, count: number) => {
    mesh.count = count
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }

  useFrame(() => {
    if (
      !disc.current ||
      !dryCross.current ||
      !ring.current ||
      !cursor.current ||
      !bracket.current ||
      !trail.current ||
      !dots.current ||
      !lost.current ||
      !crosses.current ||
      !bands.current
    )
      return
    const clock = time.current % RUN_SECONDS
    const step = Math.min(Math.floor(clock * run.stepHz), run.steps - 1)
    const now = step / run.stepHz
    const renderTime = now - run.lag
    const dry = run.underrun[step] === 1
    const rx = run.renderX[step]
    const ry = run.renderY[step]

    disc.current.position.set(rx, ry, 0.03)
    disc.current.visible = !dry
    dryCross.current.position.set(rx, ry, 0.04)
    dryCross.current.visible = dry
    ring.current.position.set(run.trueX[step], run.trueY[step], 0.02)
    ;(cursor.current.material as THREE.MeshBasicMaterial).color.copy(
      dry ? colors.red : colors.yellow
    )

    const from = run.fromTime[step]
    const to = run.toTime[step]
    bracket.current.visible = !dry
    if (!dry) {
      const a = NOW_X - (now - from) * SCALE
      const b = NOW_X - (now - to) * SCALE
      bracket.current.position.set((a + b) / 2, AXIS_Y, 0.005)
      bracket.current.scale.set(Math.max(b - a, 0.001), 0.14, 1)
    }

    // The rendered path just behind the object, fading out.
    const stride = Math.max(
      1,
      Math.round((TRAIL_SECONDS / TRAIL_SEGMENTS) * run.stepHz)
    )
    for (let i = 0; i < TRAIL_SEGMENTS; i++) {
      const s0 = (step - i * stride + run.steps * 2) % run.steps
      const s1 = (s0 - stride + run.steps) % run.steps
      const dx = run.renderX[s0] - run.renderX[s1]
      const dy = run.renderY[s0] - run.renderY[s1]
      put(
        trail.current,
        i,
        (run.renderX[s0] + run.renderX[s1]) / 2,
        (run.renderY[s0] + run.renderY[s1]) / 2,
        0,
        Math.hypot(dx, dy) + 0.02,
        0.1,
        Math.atan2(dy, dx)
      )
      const base = run.underrun[s0] ? colors.red : colors.yellow
      color.copy(colors.stage).lerp(base, 1 - (0.75 * i) / TRAIL_SEGMENTS)
      trail.current.setColorAt(i, color)
    }
    commit(trail.current, TRAIL_SEGMENTS)

    // Snapshots appear when they arrive: on the path and on the strip.
    let newest = -Infinity
    for (const p of run.packets)
      if (!p.lost && p.arrival <= now && p.time > newest) newest = p.time
    let d = 0
    let l = 0
    for (const p of run.packets) {
      if (p.arrival > now || p.time < now - HISTORY) continue
      const stripX = NOW_X - (now - p.time) * SCALE
      if (p.lost) {
        if (l + 2 > MAX_MARKS) continue
        put(lost.current, l++, p.x, p.y, 0.01, 0.13)
        put(lost.current, l++, stripX, AXIS_Y, 0.01, 0.13)
        continue
      }
      if (d + 2 > MAX_DOTS) continue
      const ahead = p.time > renderTime
      const big = p.time === newest ? 1.5 : 1
      const size = (ahead ? 0.12 : 0.08) * big
      put(dots.current, d, p.x, p.y, 0.01, size)
      dots.current.setColorAt(d++, ahead ? colors.white : colors.grey)
      put(dots.current, d, stripX, AXIS_Y, 0.01, size * 1.15)
      dots.current.setColorAt(d++, ahead ? colors.white : colors.grey)
    }
    commit(dots.current, d)
    commit(lost.current, l)

    // Underruns stay marked for a while: a cross on the path, a band on the strip.
    let m = 0
    for (let shift = 0; shift >= -RUN_SECONDS; shift -= RUN_SECONDS) {
      for (let i = run.events.length - 1; i >= 0 && m < MAX_MARKS; i--) {
        const e = run.events[i]
        const start = e.start + shift
        if (start > now || e.end + shift < now - MARK_SECONDS) continue
        put(crosses.current, m, e.x, e.y, 0.03, 0.2)
        const a = NOW_X - (now - (start - run.lag)) * SCALE
        const b =
          NOW_X - (now - (Math.min(e.end + shift, now) - run.lag)) * SCALE
        const left = Math.max(a, STRIP_LEFT)
        const width = Math.max(b - left, 0)
        put(
          bands.current,
          m,
          left + width / 2,
          AXIS_Y - STRIP_HALF * 0.62,
          0.006,
          b < STRIP_LEFT ? 0 : width + 0.06,
          0.26
        )
        m++
      }
    }
    commit(crosses.current, m)
    commit(bands.current, m)
  })

  useLiveReadout(() => {
    const r = runRef.current
    const step = Math.min(
      Math.floor((time.current % RUN_SECONDS) * r.stepHz),
      r.steps - 1
    )
    const laps = Math.floor(time.current / RUN_SECONDS)
    const count = laps * r.underruns + r.underrunsSoFar[step]
    const interval = 1000 / v.sendHz
    return `Buffered ${r.buffered[step]} · underruns ${count} · error ${r.error[step].toFixed(2)} u · needs ≥ ${Math.ceil(requiredDelay(interval, v.jitter))} ms, ${Math.ceil(requiredDelay(interval, v.jitter, 1))} ms to survive a lost packet`
  })

  const windowWidth = NOW_X - cursorX

  return (
    <>
      <Line
        points={PATH_POINTS}
        color={palette.tertiary}
        lineWidth={1.5}
        dashed
        dashSize={0.16}
        gapSize={0.14}
      />
      <instancedMesh
        ref={trail}
        args={[undefined, undefined, TRAIL_SEGMENTS]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={dots}
        args={[undefined, undefined, MAX_DOTS]}
        frustumCulled={false}
      >
        <circleGeometry args={[1, 20]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={lost}
        args={[undefined, undefined, MAX_MARKS]}
        frustumCulled={false}
      >
        <ringGeometry args={[0.62, 1, 20]} />
        <meshBasicMaterial color={palette.tertiary} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={crosses}
        args={[cross, undefined, MAX_MARKS]}
        frustumCulled={false}
      >
        <meshBasicMaterial color={palette.error} toneMapped={false} />
      </instancedMesh>

      <mesh ref={ring}>
        <ringGeometry args={[0.27, 0.34, 40]} />
        <meshBasicMaterial color={palette.accel} toneMapped={false} />
      </mesh>
      <mesh ref={disc}>
        <circleGeometry args={[0.25, 32]} />
        <meshBasicMaterial color={palette.moving} toneMapped={false} />
      </mesh>
      <mesh ref={dryCross} geometry={cross} scale={0.32} visible={false}>
        <meshBasicMaterial color={palette.error} toneMapped={false} />
      </mesh>

      {/* Timeline strip: the shaded box is the buffer, from render time to now. */}
      <mesh position={[cursorX + windowWidth / 2, AXIS_Y, -0.03]}>
        <planeGeometry args={[windowWidth, STRIP_HALF * 2]} />
        <meshBasicMaterial color={palette.surface} toneMapped={false} />
      </mesh>
      <mesh position={[(STRIP_LEFT + NOW_X) / 2, AXIS_Y, -0.02]}>
        <planeGeometry args={[NOW_X - STRIP_LEFT, 0.03]} />
        <meshBasicMaterial color={palette.tertiary} toneMapped={false} />
      </mesh>
      <mesh position={[NOW_X, AXIS_Y, -0.01]}>
        <planeGeometry args={[0.05, STRIP_HALF * 2]} />
        <meshBasicMaterial color={palette.subject} toneMapped={false} />
      </mesh>
      <mesh ref={bracket}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.moving} toneMapped={false} />
      </mesh>
      <instancedMesh
        ref={bands}
        args={[undefined, undefined, MAX_MARKS]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.error} toneMapped={false} />
      </instancedMesh>
      <mesh ref={cursor} position={[cursorX, AXIS_Y, 0.02]}>
        <planeGeometry args={[0.1, STRIP_HALF * 2]} />
        <meshBasicMaterial color={palette.moving} toneMapped={false} />
      </mesh>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 0, 10], target: [0, 0, 0] },
  grid: false,
  orbit: false,
  params: [
    {
      key: "sendHz",
      label: "Send rate",
      min: 5,
      max: 30,
      step: 1,
      value: 10,
      unit: "Hz",
    },
    {
      key: "jitter",
      label: "Jitter",
      min: 0,
      max: 150,
      step: 5,
      value: 30,
      unit: "ms",
    },
    {
      key: "delay",
      label: "Render delay",
      min: 0,
      max: 500,
      step: 10,
      value: 250,
      unit: "ms",
    },
    {
      key: "loss",
      label: "Packet loss",
      min: 0,
      max: 30,
      step: 1,
      value: 5,
      unit: "%",
    },
  ],
  readout: (v) => {
    const interval = 1000 / v.sendHz
    return `Delay = ${(v.delay / interval).toFixed(1)} send intervals · needs ≥ ${Math.ceil(requiredDelay(interval, v.jitter))} ms, ${Math.ceil(requiredDelay(interval, v.jitter, 1))} ms to survive a lost packet`
  },
  Scene,
})
