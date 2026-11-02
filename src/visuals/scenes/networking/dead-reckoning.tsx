import { useMemo, useRef } from "react"
import { Line } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import {
  COURSE_LATENCY,
  courseRun,
  type ModelOrder,
  pathState,
} from "@/lib/dead-reckoning"

import { defineVisual, palette, useClock, useLiveReadout } from "../../kit"

type V = {
  threshold: number
  order: string
  blend: number
  sharpness: number
}

const toRun = (v: V) => ({
  threshold: v.threshold,
  order: Number(v.order) as ModelOrder,
  blend: v.blend / 1000,
  sharpness: v.sharpness / 100,
})

const TRAIL_SEGMENTS = 90
const TRAIL_SECONDS = 1.5
const MAX_TICKS = 256
const MAX_PEAKS = 64
const LATENCY_MS = Math.round(COURSE_LATENCY * 1000)

function Scene({ v }: { v: V }) {
  const time = useClock()
  const { run, path } = useMemo(() => courseRun(toRun(v)), [v])
  const runRef = useRef(run)
  runRef.current = run

  const points = useMemo(() => {
    const count = 400
    return Array.from({ length: count + 1 }, (_, i) => {
      const p = pathState(path, (i / count) * path.length, 1)
      return [p.x, p.y, -0.02] as [number, number, number]
    })
  }, [path])

  const disc = useRef<THREE.Mesh>(null)
  const ring = useRef<THREE.Mesh>(null)
  const bar = useRef<THREE.Mesh>(null)
  const trail = useRef<THREE.InstancedMesh>(null)
  const ticks = useRef<THREE.InstancedMesh>(null)
  const peaks = useRef<THREE.InstancedMesh>(null)

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])
  const colors = useMemo(
    () => ({
      yellow: new THREE.Color(palette.moving),
      stage: new THREE.Color(palette.stage),
    }),
    []
  )

  const put = (
    mesh: THREE.InstancedMesh,
    i: number,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    angle: number
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
      !ring.current ||
      !bar.current ||
      !trail.current ||
      !ticks.current ||
      !peaks.current
    )
      return
    const firstLap = time.current < run.duration
    const clock = time.current % run.duration
    const step = Math.min(Math.floor(clock * run.hz), run.steps - 1)
    const x = run.drawnX[step]
    const y = run.drawnY[step]
    const tx = run.trueX[step]
    const ty = run.trueY[step]

    disc.current.position.set(x, y, 0.05)
    ring.current.position.set(tx, ty, 0.04)

    // A large error right now: a thick red bar from the truth to the object.
    const large = run.error[step] > v.threshold
    bar.current.visible = large
    if (large) {
      bar.current.position.set((x + tx) / 2, (y + ty) / 2, 0.03)
      bar.current.scale.set(run.error[step], 0.14, 1)
      bar.current.rotation.z = Math.atan2(y - ty, x - tx)
    }

    // What the receiver drew just now, fading out behind the object.
    const stride = Math.max(
      1,
      Math.round((TRAIL_SECONDS / TRAIL_SEGMENTS) * run.hz)
    )
    for (let i = 0; i < TRAIL_SEGMENTS; i++) {
      const s0 = (step - i * stride + run.steps * 2) % run.steps
      const s1 = (s0 - stride + run.steps) % run.steps
      const dx = run.drawnX[s0] - run.drawnX[s1]
      const dy = run.drawnY[s0] - run.drawnY[s1]
      put(
        trail.current,
        i,
        (run.drawnX[s0] + run.drawnX[s1]) / 2,
        (run.drawnY[s0] + run.drawnY[s1]) / 2,
        0.01,
        Math.hypot(dx, dy) + 0.02,
        0.1,
        Math.atan2(dy, dx)
      )
      color
        .copy(colors.stage)
        .lerp(colors.yellow, 1 - (0.8 * i) / TRAIL_SEGMENTS)
      trail.current.setColorAt(i, color)
    }
    commit(trail.current, TRAIL_SEGMENTS)

    // After the first lap every update stays marked, so density reads at a glance.
    let n = 0
    for (const u of run.updates) {
      if (n >= MAX_TICKS) break
      if (firstLap && u.time > clock) break
      put(
        ticks.current,
        n++,
        u.x,
        u.y,
        0.02,
        0.09,
        0.62,
        Math.atan2(u.vy, u.vx)
      )
    }
    commit(ticks.current, n)

    let m = 0
    for (const p of run.peaks) {
      if (m >= MAX_PEAKS) break
      if (firstLap && p.time > clock) break
      put(
        peaks.current,
        m++,
        (p.x + p.drawnX) / 2,
        (p.y + p.drawnY) / 2,
        0.015,
        p.error,
        0.05,
        Math.atan2(p.drawnY - p.y, p.drawnX - p.x)
      )
    }
    commit(peaks.current, m)
  })

  useLiveReadout(() => {
    const r = runRef.current
    const step = Math.min(
      Math.floor((time.current % r.duration) * r.hz),
      r.steps - 1
    )
    return `Updates ${r.updatesPerSecond.toFixed(1)}/s · error ${r.error[step].toFixed(2)} u · max ${r.maxError.toFixed(2)} u · latency ${LATENCY_MS} ms`
  })

  return (
    <>
      <Line
        points={points}
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
        ref={peaks}
        args={[undefined, undefined, MAX_PEAKS]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.error} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={ticks}
        args={[undefined, undefined, MAX_TICKS]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.subject} toneMapped={false} />
      </instancedMesh>
      <mesh ref={bar} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.error} toneMapped={false} />
      </mesh>
      <mesh ref={ring}>
        <ringGeometry args={[0.27, 0.34, 40]} />
        <meshBasicMaterial color={palette.accel} toneMapped={false} />
      </mesh>
      <mesh ref={disc}>
        <circleGeometry args={[0.25, 32]} />
        <meshBasicMaterial color={palette.moving} toneMapped={false} />
      </mesh>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, -0.15, 9.6], target: [0, -0.15, 0] },
  grid: false,
  orbit: false,
  params: [
    {
      key: "threshold",
      label: "Error threshold",
      min: 0.05,
      max: 1.5,
      step: 0.05,
      value: 0.3,
      unit: "u",
      digits: 2,
    },
    {
      key: "order",
      label: "Model",
      type: "select",
      value: "1",
      options: [
        { value: "1", label: "Position + velocity" },
        { value: "2", label: "With acceleration" },
      ],
    },
    {
      key: "blend",
      label: "Blend time",
      min: 0,
      max: 1000,
      step: 50,
      value: 200,
      unit: "ms",
    },
    {
      key: "sharpness",
      label: "Path sharpness",
      min: 0,
      max: 100,
      step: 5,
      value: 60,
      unit: "%",
    },
  ],
  readout: (v) => {
    const { run } = courseRun(toRun(v))
    return `Updates ${run.updatesPerSecond.toFixed(1)}/s · max ${run.maxError.toFixed(2)} u · latency ${LATENCY_MS} ms`
  },
  Scene,
})
