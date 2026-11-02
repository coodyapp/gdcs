import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import { easings, type EasingName } from "@/lib/easing"

import { defineVisual, palette, useClock } from "../../kit"

type V = { curve: string; duration: number }

// Plot space: t in [0, 1] → x in [X0, X1]; value in [0, 1] → y in [Y0, Y1].
const X0 = -3
const X1 = 3
const Y0 = 1.2
const Y1 = 3.6
const TRACK_Y = 0.25
const px = (t: number) => X0 + (X1 - X0) * t
const py = (v: number) => Y0 + (Y1 - Y0) * v
const HOLD = 0.6

const OPTIONS: { value: EasingName; label: string }[] = [
  { value: "inOutCubic", label: "In-out cubic" },
  { value: "outQuad", label: "Out quad" },
  { value: "inQuad", label: "In quad" },
  { value: "outBack", label: "Out back" },
  { value: "outElastic", label: "Out elastic" },
  { value: "outBounce", label: "Out bounce" },
]

function Scene({ v }: { v: V }) {
  const time = useClock()
  const f = easings[v.curve as EasingName] ?? easings.linear
  const dot = useRef<THREE.Mesh>(null)
  const ball = useRef<THREE.Mesh>(null)
  const linBall = useRef<THREE.Mesh>(null)
  const curve = useMemo(() => {
    const pts: [number, number, number][] = []
    for (let i = 0; i <= 120; i++) pts.push([px(i / 120), py(f(i / 120)), 0])
    return pts
  }, [f])

  useFrame(() => {
    const cycle = v.duration + HOLD * 2
    const local = (time.current % cycle) - HOLD
    const t = THREE.MathUtils.clamp(local / v.duration, 0, 1)
    const y = f(t)
    dot.current?.position.set(px(t), py(y), 0)
    ball.current?.position.set(px(y), TRACK_Y, 0.45)
    linBall.current?.position.set(px(t), TRACK_Y, -0.45)
  })

  return (
    <>
      {/* Axes and the 0 / 1 value lines. */}
      <Line
        points={[
          [X0, Y0, 0],
          [X1, Y0, 0],
        ]}
        color={palette.guide}
        lineWidth={1}
      />
      <Line
        points={[
          [X0, Y0, 0],
          [X0, Y1 + 0.5, 0],
        ]}
        color={palette.guide}
        lineWidth={1}
      />
      <Line
        points={[
          [X0, Y1, 0],
          [X1, Y1, 0],
        ]}
        color={palette.guide}
        lineWidth={1}
        dashed
        dashSize={0.12}
        gapSize={0.1}
      />
      <Line
        points={[
          [X0, Y0, 0],
          [X1, Y1, 0],
        ]}
        color={palette.guide}
        lineWidth={1}
        transparent
        opacity={0.6}
      />
      <Line points={curve} color={palette.subject} lineWidth={3} />
      <mesh ref={dot}>
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshBasicMaterial color={palette.moving} />
      </mesh>

      {/* Tracks: eased ball in front, linear reference behind. */}
      {[0.45, -0.45].map((z) => (
        <mesh key={z} position={[0, TRACK_Y - 0.2, z]}>
          <boxGeometry args={[X1 - X0 + 0.6, 0.05, 0.3]} />
          <meshStandardMaterial color={palette.surface} />
        </mesh>
      ))}
      {/* Start and end posts on the eased track. */}
      {[X0, X1].map((x, i) => (
        <mesh key={x} position={[x, TRACK_Y, 0.45]}>
          <boxGeometry args={[0.04, 0.5, 0.32]} />
          <meshBasicMaterial color={i ? palette.success : palette.guide} />
        </mesh>
      ))}
      <mesh ref={ball}>
        <sphereGeometry args={[0.2, 24, 16]} />
        <meshStandardMaterial color={palette.moving} />
      </mesh>
      <mesh ref={linBall}>
        <sphereGeometry args={[0.16, 24, 16]} />
        <meshStandardMaterial color={palette.object} />
      </mesh>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 2.6, 8.2], target: [0, 1.85, 0] },
  params: [
    {
      key: "curve",
      label: "Easing",
      type: "select",
      value: "outBack",
      options: OPTIONS,
    },
    {
      key: "duration",
      label: "Duration",
      min: 0.3,
      max: 3,
      step: 0.05,
      value: 1.4,
      unit: "s",
      digits: 2,
    },
  ],
  readout: (v) => {
    const f = easings[v.curve as EasingName]
    let max = 0
    for (let i = 0; i <= 200; i++) max = Math.max(max, f(i / 200))
    return `f(0.25) = ${f(0.25).toFixed(2)} · f(0.5) = ${f(0.5).toFixed(2)} · f(0.75) = ${f(0.75).toFixed(2)} · peak ${max.toFixed(2)}`
  },
  Scene,
})
