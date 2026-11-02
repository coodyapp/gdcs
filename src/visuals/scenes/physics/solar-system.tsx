import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import { calculateBarycentricRadii } from "@/lib/physics/binary-orbit"

import { defineVisual, palette, useFixedStep, useVisual } from "../../kit"

type V = { ratio: number; rate: number }

const TAU = Math.PI * 2
const SEPARATION = 5

/** Kepler III with fixed separation: ω ∝ √(M_total); normalised so ratio 2 → rate. */
const angularRate = (ratio: number, rate: number) =>
  rate * Math.sqrt((1 + ratio) / 3)

const circle = (r: number) =>
  Array.from(
    { length: 97 },
    (_, i) =>
      [r * Math.cos((i / 96) * TAU), 0, r * Math.sin((i / 96) * TAU)] as [
        number,
        number,
        number,
      ]
  )

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const system = useRef<THREE.Group>(null)
  const phase = useRef(0)
  const { body1: rBlue, body2: rOrange } = calculateBarycentricRadii(
    1,
    v.ratio,
    SEPARATION
  )
  const blueOrbit = useMemo(() => circle(rBlue), [rBlue])
  const orangeOrbit = useMemo(() => circle(rOrange), [rOrange])

  useEffect(() => {
    phase.current = 0
  }, [resetKey])

  useFixedStep((dt) => {
    phase.current = (phase.current + dt * angularRate(v.ratio, v.rate)) % TAU
  }, 120)

  useFrame(() => {
    system.current?.rotation.set(0, phase.current, 0)
  })

  return (
    <>
      <Line
        points={blueOrbit}
        color={palette.subject}
        transparent
        opacity={0.45}
      />
      <Line
        points={orangeOrbit}
        color={palette.moving}
        transparent
        opacity={0.45}
      />
      <group ref={system}>
        <Line
          points={[
            [-rBlue, 0, 0],
            [rOrange, 0, 0],
          ]}
          color={palette.guide}
          lineWidth={1}
          dashed
          dashSize={0.15}
          gapSize={0.1}
        />
        <mesh position={[-rBlue, 0, 0]}>
          <sphereGeometry args={[0.42, 32, 32]} />
          <meshStandardMaterial
            color={palette.subject}
            emissive={palette.subject}
            emissiveIntensity={0.35}
          />
        </mesh>
        <mesh position={[rOrange, 0, 0]}>
          <sphereGeometry args={[0.42 * Math.cbrt(v.ratio), 32, 32]} />
          <meshStandardMaterial
            color={palette.moving}
            emissive={palette.moving}
            emissiveIntensity={0.35}
          />
        </mesh>
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.08, 0.16, 32]} />
        <meshBasicMaterial color={palette.foreground} side={THREE.DoubleSide} />
      </mesh>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 8.5, 6.5], target: [0, -0.3, 0] },
  grid: false,
  params: [
    {
      key: "ratio",
      label: "Mass ratio (yellow / white)",
      min: 0.3,
      max: 4,
      step: 0.1,
      value: 2,
    },
    {
      key: "rate",
      label: "Rate scale",
      min: 0.1,
      max: 2,
      step: 0.1,
      value: 0.6,
    },
  ],
  readout: (v) => {
    const { body1, body2 } = calculateBarycentricRadii(1, v.ratio, SEPARATION)
    const w = angularRate(v.ratio, v.rate)
    return `Radii white ${body1.toFixed(2)} / yellow ${body2.toFixed(2)} u · m₁r₁ = m₂r₂ · period ${(TAU / w).toFixed(2)} s`
  },
  Scene,
})
