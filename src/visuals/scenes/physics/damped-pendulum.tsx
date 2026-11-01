import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import {
  harmonicPendulumAngle,
  pendulumPeriod,
  stepPendulum,
} from "@/lib/physics/mechanics-labs"

import { defineVisual, palette, rad, useFixedStep, useVisual } from "../../kit"

type V = { length: number; gravity: number; damping: number; angle: number }

const PIVOT_Y = 4.3
const SCALE = 2.6

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const arm = useRef<THREE.Group>(null)
  const ghost = useRef<THREE.Group>(null)
  const theta0 = rad(v.angle)
  const L = v.length * SCALE
  const state = useRef({ theta: theta0, omega: 0, t: 0 })

  useEffect(() => {
    state.current = { theta: theta0, omega: 0, t: 0 }
  }, [resetKey, theta0, v.length, v.gravity, v.damping])

  useFixedStep((dt) => {
    stepPendulum(state.current, v.gravity, v.length, v.damping, dt)
  }, 240)

  useFrame(() => {
    const s = state.current
    arm.current?.rotation.set(0, 0, s.theta)
    ghost.current?.rotation.set(
      0,
      0,
      harmonicPendulumAngle(theta0, v.gravity, v.length, v.damping, s.t)
    )
  })

  const arc = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => {
        const a = -theta0 + (i / 47) * 2 * theta0
        return [Math.sin(a) * L, -Math.cos(a) * L, -0.1] as [
          number,
          number,
          number,
        ]
      }),
    [L, theta0]
  )

  return (
    <group position={[0, PIVOT_Y, 0]}>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[1.6, 0.16, 0.5]} />
        <meshStandardMaterial color={palette.object} />
      </mesh>
      <Line points={arc} color={palette.guide} lineWidth={1} />
      <Line
        points={[
          [0, 0, -0.1],
          [0, -L - 0.4, -0.1],
        ]}
        color={palette.grid}
        lineWidth={1}
      />
      <group ref={ghost}>
        <Line
          points={[
            [0, 0, -0.05],
            [0, -L, -0.05],
          ]}
          color={palette.primary}
          lineWidth={1}
          transparent
          opacity={0.5}
        />
        <mesh position={[0, -L, -0.05]}>
          <sphereGeometry args={[0.3, 24, 24]} />
          <meshStandardMaterial
            color={palette.primary}
            transparent
            opacity={0.55}
          />
        </mesh>
      </group>
      <group ref={arm} rotation={[0, 0, theta0]}>
        <Line
          points={[
            [0, 0, 0],
            [0, -L, 0],
          ]}
          color={palette.foreground}
          lineWidth={2}
        />
        <mesh position={[0, -L, 0]}>
          <sphereGeometry args={[0.32, 32, 32]} />
          <meshStandardMaterial
            color={palette.secondary}
            emissive={palette.secondary}
            emissiveIntensity={0.25}
          />
        </mesh>
      </group>
      <mesh>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color={palette.foreground} />
      </mesh>
    </group>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 2.5, 7.2], target: [0, 2.3, 0] },
  grid: false,
  params: [
    {
      key: "length",
      label: "String length",
      min: 0.5,
      max: 1.8,
      step: 0.1,
      value: 1.1,
      unit: "m",
    },
    {
      key: "gravity",
      label: "Gravity",
      min: 1.6,
      max: 16,
      step: 0.1,
      value: 9.8,
      unit: "m/s²",
    },
    {
      key: "damping",
      label: "Damping b",
      min: 0,
      max: 0.9,
      step: 0.05,
      value: 0.22,
      unit: "1/s",
      digits: 2,
    },
    {
      key: "angle",
      label: "Release angle",
      min: 5,
      max: 75,
      step: 1,
      value: 60,
      unit: "°",
    },
  ],
  readout: (v) => {
    const t0 = pendulumPeriod(v.length, v.gravity)
    const t = pendulumPeriod(v.length, v.gravity, rad(v.angle))
    const half =
      v.damping > 0 ? `${((2 * Math.LN2) / v.damping).toFixed(1)} s` : "never"
    return `Small-angle T ${t0.toFixed(2)} s · at ${v.angle}° ≈ ${t.toFixed(2)} s (+${((t / t0 - 1) * 100).toFixed(1)}%) · amplitude halves in ${half}`
  },
  Scene,
})
