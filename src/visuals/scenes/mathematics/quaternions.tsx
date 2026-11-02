import { useEffect, useMemo, useRef, type RefObject } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import { eulerLerp, fromEuler, slerp, sweptAngle, type Quat } from "@/lib/quat"

import { defineVisual, palette, rad, useClock } from "../../kit"

type V = { preset: string; shortest: boolean; auto: boolean; t: number }

type E = [number, number, number]
const PRESETS: Record<string, { a: E; b: E }> = {
  seam: { a: [0, 165, 20], b: [0, -165, -20] },
  tumble: { a: [0, 0, 0], b: [80, 120, -60] },
  flip: { a: [-30, 40, 0], b: [150, -20, 110] },
}
const toRad = (e: E): E => [rad(e[0]), rad(e[1]), rad(e[2])]
const NOSE = new THREE.Vector3(0, 0, 1.55)
const SAMPLES = 96

function paths(preset: string, shortest: boolean) {
  const { a, b } = PRESETS[preset]
  const ea = toRad(a)
  const eb = toRad(b)
  const qa = fromEuler(...ea)
  const qb = fromEuler(...eb)
  return {
    euler: (t: number) => eulerLerp(ea, eb, t),
    slerp: (t: number) => slerp(qa, qb, t, shortest),
  }
}

function trail(path: (t: number) => Quat) {
  const q = new THREE.Quaternion()
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= SAMPLES; i++) {
    q.fromArray(path(i / SAMPLES))
    pts.push(NOSE.clone().applyQuaternion(q))
  }
  return pts
}

function Arrow({ color }: { color: string }) {
  return (
    <>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 2, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0, 1.2]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.28, 0.6, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* A fin on +Y makes roll visible. */}
      <mesh position={[0, 0.3, -0.6]}>
        <boxGeometry args={[0.05, 0.5, 0.6]} />
        <meshStandardMaterial color={palette.foreground} />
      </mesh>
    </>
  )
}

function Rig({
  x,
  color,
  path,
  progress,
  dashed = false,
}: {
  x: number
  color: string
  dashed?: boolean
  path: (t: number) => Quat
  progress: RefObject<number>
}) {
  const body = useRef<THREE.Group>(null)
  const pts = useMemo(() => trail(path), [path])
  useFrame(() => {
    body.current?.quaternion.fromArray(path(progress.current))
  })
  return (
    <group position={[x, 1.6, 0]}>
      <mesh>
        <sphereGeometry args={[1.55, 18, 10]} />
        <meshBasicMaterial
          color={palette.guide}
          wireframe
          transparent
          opacity={0.09}
        />
      </mesh>
      <Line
        points={pts}
        color={color}
        lineWidth={2.5}
        dashed={dashed}
        dashSize={0.12}
        gapSize={0.08}
      />
      <mesh position={pts[0]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshBasicMaterial color={palette.foreground} />
      </mesh>
      <mesh position={pts[pts.length - 1]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshBasicMaterial color={palette.success} />
      </mesh>
      <group ref={body}>
        <Arrow color={color} />
      </group>
    </group>
  )
}

function Scene({ v }: { v: V }) {
  const time = useClock()
  const progress = useRef(0)
  const { euler, slerp: sl } = useMemo(
    () => paths(v.preset, v.shortest),
    [v.preset, v.shortest]
  )
  useEffect(() => {
    progress.current = v.t
  }, [v.t])
  useFrame(() => {
    if (!v.auto) {
      progress.current = v.t
      return
    }
    // Ease in and out, hold at both ends.
    const phase = (time.current * 0.35) % 2
    const s = THREE.MathUtils.clamp(
      phase < 1 ? phase * 1.3 - 0.15 : (2 - phase) * 1.3 - 0.15,
      0,
      1
    )
    progress.current = s * s * (3 - 2 * s)
  })
  return (
    <>
      <Rig
        x={-2.3}
        color={palette.moving}
        path={euler}
        progress={progress}
        dashed
      />
      <Rig x={2.3} color={palette.subject} path={sl} progress={progress} />
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 3.6, 7.4], target: [0, 1.5, 0] },
  params: [
    {
      key: "preset",
      label: "From → to",
      type: "select",
      value: "seam",
      options: [
        { value: "seam", label: "Across ±180° yaw" },
        { value: "tumble", label: "Tumble" },
        { value: "flip", label: "Big flip" },
      ],
    },
    {
      key: "shortest",
      label: "Slerp: shortest arc",
      type: "toggle",
      value: true,
    },
    { key: "auto", label: "Animate", type: "toggle", value: true },
    {
      key: "t",
      label: "t (animate off)",
      min: 0,
      max: 1,
      step: 0.01,
      value: 0.5,
      digits: 2,
    },
  ],
  readout: (v) => {
    const p = paths(v.preset, v.shortest)
    const e = (sweptAngle(p.euler) * 180) / Math.PI
    const s = (sweptAngle(p.slerp) * 180) / Math.PI
    return `Rotation swept: Euler lerp ${e.toFixed(0)}° · slerp ${s.toFixed(0)}°`
  },
  Scene,
})
