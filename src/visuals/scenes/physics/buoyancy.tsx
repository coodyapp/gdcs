import { useEffect, useRef, type RefObject } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { stepBuoyancy, submergedFraction } from "@/lib/physics/mechanics-labs"

import { defineVisual, palette, useFixedStep, useVisual } from "../../kit"

type V = { objectDensity: number; fluidDensity: number }

const SIZE = 1.4
const TANK_H = 3.6
const SURFACE = TANK_H
const FLOOR_Y = SIZE / 2
const DROP_Y = SURFACE + 1.3
const DRAG = 1.8 // 1/s, scaled by submerged fraction
const FORCE_LEN = 1.4 // arrow length for the larger of the two forces

function Arrow({
  arrow,
  color,
  x,
  up,
}: {
  arrow: RefObject<THREE.Group | null>
  color: string
  x: number
  up: boolean
}) {
  return (
    <group ref={arrow} position={[x, 0, SIZE / 2 + 0.05]} scale={[1, 1, 1]}>
      <group rotation={[0, 0, up ? 0 : Math.PI]}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 1, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>
        <mesh position={[0, 1, 0]}>
          <coneGeometry args={[0.12, 0.28, 12]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>
    </group>
  )
}

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const block = useRef<THREE.Group>(null)
  const buoy = useRef<THREE.Group>(null)
  const weight = useRef<THREE.Group>(null)
  const normal = useRef<THREE.Group>(null)
  const state = useRef({ y: DROP_Y, v: 0 })

  useEffect(() => {
    state.current = { y: DROP_Y, v: 0 }
  }, [resetKey, v.objectDensity, v.fluidDensity])

  useFixedStep((dt) => {
    stepBuoyancy(
      state.current,
      v.objectDensity,
      v.fluidDensity,
      SIZE,
      SURFACE,
      FLOOR_Y,
      DRAG,
      dt
    )
  }, 120)

  useFrame(() => {
    const { y } = state.current
    block.current?.position.setY(y)
    const f = submergedFraction(y, SIZE, SURFACE)
    const scale = FORCE_LEN / Math.max(v.objectDensity, v.fluidDensity)
    const fb = v.fluidDensity * f * scale
    const fw = v.objectDensity * scale
    const resting = y <= FLOOR_Y + 1e-4 && fw > fb
    const setLen = (g: THREE.Group | null, len: number) => {
      if (!g) return
      g.visible = len > 0.02
      g.scale.set(1, Math.max(len, 0.001), 1)
    }
    setLen(buoy.current, fb)
    setLen(weight.current, fw)
    setLen(normal.current, resting ? fw - fb : 0)
  })

  return (
    <>
      <mesh position={[0, TANK_H / 2, 0]}>
        <boxGeometry args={[7, TANK_H, 3]} />
        <meshStandardMaterial
          color={palette.primary}
          transparent
          opacity={0.18}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, SURFACE, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[7, 3]} />
        <meshStandardMaterial
          color={palette.primary}
          transparent
          opacity={0.22}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <group ref={block} position={[0, DROP_Y, 0]}>
        <mesh>
          <boxGeometry args={[SIZE, SIZE, SIZE]} />
          <meshStandardMaterial
            color={palette.secondary}
            emissive={palette.secondary}
            emissiveIntensity={0.15}
          />
        </mesh>
        <Arrow arrow={buoy} color={palette.primary} x={-0.4} up />
        <Arrow arrow={weight} color={palette.warning} x={0.4} up={false} />
        <group position={[0, -SIZE / 2, 0]}>
          <Arrow arrow={normal} color={palette.positive} x={0} up />
        </group>
      </group>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [3.5, 4.6, 9.5], target: [0, 2.1, 0] },
  params: [
    {
      key: "objectDensity",
      label: "Object density",
      min: 200,
      max: 1800,
      step: 50,
      value: 650,
      unit: "kg/m³",
    },
    {
      key: "fluidDensity",
      label: "Fluid density",
      min: 500,
      max: 1400,
      step: 50,
      value: 1000,
      unit: "kg/m³",
    },
  ],
  readout: (v) => {
    const ratio = v.objectDensity / v.fluidDensity
    const state =
      ratio < 1 ? "floats" : ratio === 1 ? "neutrally buoyant" : "sinks"
    return `Equilibrium: ${Math.min(100, ratio * 100).toFixed(0)}% submerged · ${state} · net force when fully under: ${((1 / ratio - 1) * 100).toFixed(0)}% of weight`
  },
  Scene,
})
