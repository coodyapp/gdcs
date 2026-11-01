import { useMemo } from "react"
import { Line } from "@react-three/drei"

import { defineVisual, palette, rad, useAnimationTime } from "../../kit"

type V = { angle: number; speed: number; gravity: number }

const SCALE = 0.6
const LAUNCH_X = -4.5

function Scene({ v }: { v: V }) {
  const time = useAnimationTime(0.6)
  const a = rad(v.angle)
  const vx = v.speed * Math.cos(a)
  const vy = v.speed * Math.sin(a)
  const flight = Math.max(0.1, (2 * vy) / v.gravity)
  const path = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => {
        const t = (i / 79) * flight
        return [
          LAUNCH_X + vx * t * SCALE,
          (vy * t - 0.5 * v.gravity * t * t) * SCALE,
          0,
        ] as [number, number, number]
      }),
    [flight, v.gravity, vx, vy]
  )
  const t = time % flight
  const px = LAUNCH_X + vx * t * SCALE
  const py = (vy * t - 0.5 * v.gravity * t * t) * SCALE
  return (
    <group>
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[10.5, 0.08, 2.4]} />
        <meshStandardMaterial color={palette.surface} />
      </mesh>
      <Line points={path} color={palette.primary} lineWidth={3} />
      <mesh position={[px, py, 0]}>
        <sphereGeometry args={[0.18, 24, 24]} />
        <meshStandardMaterial
          color={palette.secondary}
          emissive={palette.secondary}
          emissiveIntensity={0.4}
        />
      </mesh>
      <Line
        points={[
          [px, py, 0],
          [px + vx * 0.12, py + (vy - v.gravity * t) * 0.12, 0],
        ]}
        color={palette.warning}
        lineWidth={2}
      />
    </group>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 2.5, 10], target: [0, 1.4, 0] },
  params: [
    {
      key: "angle",
      label: "Launch angle",
      min: 10,
      max: 80,
      step: 1,
      value: 42,
      unit: "°",
    },
    {
      key: "speed",
      label: "Launch speed",
      min: 3,
      max: 12,
      step: 0.1,
      value: 7.4,
      unit: "m/s",
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
  ],
  readout: (v) => {
    const a = rad(v.angle)
    const T = (2 * v.speed * Math.sin(a)) / v.gravity
    return `Flight ${T.toFixed(2)} s · Range ${(v.speed * Math.cos(a) * T).toFixed(2)} m · Peak ${((v.speed * Math.sin(a)) ** 2 / (2 * v.gravity)).toFixed(2)} m`
  },
  Scene,
})
