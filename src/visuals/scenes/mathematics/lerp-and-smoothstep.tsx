import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import { clamp, damp, lerp, smootherstep, smoothstep } from "@/lib/interp"

import { defineVisual, palette, useClock, useVisual } from "../../kit"

type V = { duration: number; lambda: number; smoother: boolean }

// Plot: t in [0, 1] → x in [X0, X1]; value in [0, 1] → y in [Y0, Y1].
const X0 = -3
const X1 = 3
const Y0 = 0.7
const Y1 = 3.1
const px = (t: number) => lerp(X0, X1, t)
const py = (v: number) => lerp(Y0, Y1, v)
const TRACKS = { lerp: -0.35, smooth: -1.05, damp: -1.75 }
const HOLD_START = 0.5
const HOLD_END = 0.9
const N = 120

type P3 = [number, number, number]

function plot(f: (t: number) => number): P3[] {
  return Array.from({ length: N + 1 }, (_, i) => [px(i / N), py(f(i / N)), 0])
}

function Scene({ v }: { v: V }) {
  const time = useClock()
  const { playing, resetKey } = useVisual()
  const ease = v.smoother ? smootherstep : smoothstep
  const linPts = useMemo(() => plot((t) => t), [])
  const smoothPts = useMemo(() => plot((t) => ease(0, 1, t)), [ease])
  const dampPts = useMemo(
    () => plot((t) => 1 - Math.exp(-v.lambda * t * v.duration)),
    [v.lambda, v.duration]
  )
  const lin = useRef<THREE.Mesh>(null)
  const smooth = useRef<THREE.Mesh>(null)
  const dmp = useRef<THREE.Mesh>(null)
  const linDot = useRef<THREE.Mesh>(null)
  const smoothDot = useRef<THREE.Mesh>(null)
  const dampDot = useRef<THREE.Mesh>(null)
  const state = useRef({ value: 0, key: resetKey })

  useFrame((_, delta) => {
    const cycle = HOLD_START + v.duration + HOLD_END
    const local = (time.current % cycle) - HOLD_START
    const t = clamp(local / v.duration)
    const st = state.current
    if (st.key !== resetKey || local < 0) {
      st.key = resetKey
      st.value = 0
    } else if (playing) {
      // Real per-frame stepping: same curve at any frame rate.
      st.value = damp(st.value, 1, v.lambda, Math.min(delta, 0.1))
    }
    const s = ease(0, 1, t)
    lin.current?.position.set(px(t), TRACKS.lerp, 0)
    smooth.current?.position.set(px(s), TRACKS.smooth, 0)
    dmp.current?.position.set(px(st.value), TRACKS.damp, 0)
    linDot.current?.position.set(px(t), py(t), 0)
    smoothDot.current?.position.set(px(t), py(s), 0)
    dampDot.current?.position.set(
      px(Math.min(1, Math.max(0, local) / v.duration)),
      py(Math.min(st.value, 1 - Math.exp(-v.lambda * v.duration))),
      0
    )
  })

  return (
    <>
      {/* Plot axes and the value-1 line. */}
      <Line
        points={[
          [X0, Y0, 0],
          [X1 + 0.2, Y0, 0],
        ]}
        color={palette.guide}
        lineWidth={1}
      />
      <Line
        points={[
          [X0, Y0, 0],
          [X0, Y1 + 0.3, 0],
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
        transparent
        opacity={0.4}
      />
      <Line points={linPts} color={palette.primary} lineWidth={2} />
      <Line points={smoothPts} color={palette.secondary} lineWidth={3.5} />
      <Line
        points={dampPts}
        color={palette.tertiary}
        lineWidth={2.5}
        dashed
        dashSize={0.14}
        gapSize={0.09}
      />
      <mesh ref={linDot}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshBasicMaterial color={palette.primary} />
      </mesh>
      <mesh ref={smoothDot}>
        <boxGeometry args={[0.16, 0.16, 0.16]} />
        <meshBasicMaterial color={palette.secondary} />
      </mesh>
      <mesh ref={dampDot}>
        <octahedronGeometry args={[0.12]} />
        <meshBasicMaterial color={palette.tertiary} />
      </mesh>

      {/* Tracks from A (grey post) to B (green post). */}
      {Object.values(TRACKS).map((y) => (
        <group key={y}>
          <Line
            points={[
              [X0, y, 0],
              [X1, y, 0],
            ]}
            color={palette.guide}
            lineWidth={1}
            transparent
            opacity={0.5}
          />
          <mesh position={[X0, y, 0]}>
            <boxGeometry args={[0.05, 0.45, 0.05]} />
            <meshBasicMaterial color={palette.guide} />
          </mesh>
          <mesh position={[X1, y, 0]}>
            <boxGeometry args={[0.05, 0.45, 0.05]} />
            <meshBasicMaterial color={palette.positive} />
          </mesh>
        </group>
      ))}
      <mesh ref={lin}>
        <sphereGeometry args={[0.2, 24, 16]} />
        <meshBasicMaterial color={palette.primary} />
      </mesh>
      <mesh ref={smooth}>
        <boxGeometry args={[0.34, 0.34, 0.34]} />
        <meshBasicMaterial color={palette.secondary} />
      </mesh>
      <mesh ref={dmp}>
        <octahedronGeometry args={[0.24]} />
        <meshBasicMaterial color={palette.tertiary} />
      </mesh>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 0.65, 7.4], target: [0, 0.65, 0] },
  grid: false,
  orbit: false,
  params: [
    {
      key: "duration",
      label: "Duration (lerp, smoothstep)",
      min: 0.4,
      max: 3,
      step: 0.05,
      value: 1.6,
      unit: "s",
      digits: 2,
    },
    {
      key: "lambda",
      label: "Damping rate λ",
      min: 0.5,
      max: 15,
      step: 0.5,
      value: 4,
      unit: "/s",
    },
    {
      key: "smoother",
      label: "Use smootherstep",
      type: "toggle",
      value: false,
    },
  ],
  readout: (v) => {
    const f = v.smoother ? smootherstep : smoothstep
    const name = v.smoother ? "smootherstep" : "smoothstep"
    return `t = 0.25: lerp 0.25 · ${name} ${f(0, 1, 0.25).toFixed(3)} · exp damp reaches 99% after ${(Math.log(100) / v.lambda).toFixed(2)} s and never quite arrives`
  },
  Scene,
})
