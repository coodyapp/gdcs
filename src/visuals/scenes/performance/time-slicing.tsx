import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { bucketForFrame, bucketRange } from "@/lib/time-slice"

import {
  defineVisual,
  palette,
  useClock,
  useFixedStep,
  useVisual,
} from "../../kit"

type V = { buckets: number; tick: number }

const N = 96
const SPEED = 2.4
const Y = 0.15

// Sunflower layout: each agent's slot relative to the beacon.
const OFFSETS = Array.from({ length: N }, (_, i) => {
  const r = 1.7 * Math.sqrt((i + 0.5) / N)
  const a = i * 2.39996
  return [r * Math.cos(a), r * Math.sin(a)] as const
})

const beaconAt = (t: number, out: THREE.Vector3) =>
  out.set(2.8 * Math.sin(t * 0.8), Y, 1.3 * Math.sin(t * 1.3 + 0.8))

function Scene({ v }: { v: V }) {
  const time = useClock()
  const { resetKey } = useVisual()
  const agents = useRef<THREE.InstancedMesh>(null)
  const beacon = useRef<THREE.Mesh>(null)
  const pos = useMemo(() => new Float32Array(N * 2), [])
  const goal = useMemo(() => new Float32Array(N * 2), [])
  const state = useRef({ frame: 0, acc: 0, bucket: 0 })
  const b = useMemo(() => new THREE.Vector3(), [])
  const m = useMemo(() => new THREE.Matrix4(), [])
  const thinking = useMemo(() => new THREE.Color(palette.secondary), [])
  const idle = useMemo(() => new THREE.Color(palette.primary), [])
  const lines = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(N * 6), 3)
    )
    return new THREE.LineSegments(
      g,
      new THREE.LineBasicMaterial({
        color: palette.foreground,
        transparent: true,
        opacity: 0.8,
      })
    )
  }, [])

  useEffect(() => {
    beaconAt(0, b)
    for (let i = 0; i < N; i++) {
      pos[i * 2] = goal[i * 2] = b.x + OFFSETS[i][0]
      pos[i * 2 + 1] = goal[i * 2 + 1] = b.z + OFFSETS[i][1]
    }
    state.current = { frame: 0, acc: 0, bucket: 0 }
  }, [resetKey, b, pos, goal])

  useFixedStep((dt) => {
    const s = state.current
    beaconAt(time.current, b)
    // A slowed-down "frame": only one bucket re-plans per tick.
    s.acc += dt
    if (s.acc >= 1 / v.tick) {
      s.acc = 0
      s.bucket = bucketForFrame(s.frame++, v.buckets)
      const { start, end } = bucketRange(N, v.buckets, s.bucket)
      for (let i = start; i < end; i++) {
        goal[i * 2] = b.x + OFFSETS[i][0]
        goal[i * 2 + 1] = b.z + OFFSETS[i][1]
      }
    }
    // Cheap per-frame work: everyone keeps moving toward their last goal.
    for (let i = 0; i < N; i++) {
      const dx = goal[i * 2] - pos[i * 2]
      const dz = goal[i * 2 + 1] - pos[i * 2 + 1]
      const d = Math.hypot(dx, dz)
      const step = Math.min(d, SPEED * dt)
      if (d > 1e-5) {
        pos[i * 2] += (dx / d) * step
        pos[i * 2 + 1] += (dz / d) * step
      }
    }
  }, 60)

  useFrame(() => {
    const mesh = agents.current
    if (!mesh) return
    const s = state.current
    const { start, end } = bucketRange(N, v.buckets, s.bucket)
    const attr = lines.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < N; i++) {
      const on = i >= start && i < end
      const sc = on ? 1.35 : 1
      m.makeScale(sc, sc, sc).setPosition(pos[i * 2], Y, pos[i * 2 + 1])
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, on ? thinking : idle)
      attr.setXYZ(i * 2, pos[i * 2], 0.02, pos[i * 2 + 1])
      attr.setXYZ(i * 2 + 1, goal[i * 2], 0.02, goal[i * 2 + 1])
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    attr.needsUpdate = true
    beaconAt(time.current, b)
    beacon.current?.position.copy(b)
  })

  return (
    <>
      <instancedMesh ref={agents} args={[undefined, undefined, N]}>
        <sphereGeometry args={[0.11, 12, 8]} />
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
      <primitive object={lines} />
      <mesh ref={beacon}>
        <octahedronGeometry args={[0.28]} />
        <meshStandardMaterial
          color={palette.warning}
          emissive={palette.warning}
          emissiveIntensity={0.5}
        />
      </mesh>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 7.2, 4.6], target: [0, 0, 0] },
  orbit: false,
  params: [
    { key: "buckets", label: "Buckets", min: 1, max: 12, step: 1, value: 6 },
    {
      key: "tick",
      label: "Slow-motion frames",
      min: 2,
      max: 30,
      step: 1,
      value: 8,
      unit: "/s",
    },
  ],
  readout: (v) => {
    const per = Math.ceil(N / v.buckets)
    return `≤ ${per} of ${N} agents think per frame · each re-plans every ${v.buckets} frame${v.buckets > 1 ? "s" : ""} (${((v.buckets * 1000) / 60).toFixed(0)} ms at 60 fps)`
  },
  Scene,
})
