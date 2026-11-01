import { useEffect, useMemo, useRef, type RefObject } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { G_EARTH, leverNetTorque } from "@/lib/physics/mechanics-labs"

import {
  clamp,
  defineVisual,
  palette,
  useFixedStep,
  useVisual,
} from "../../kit"

type V = {
  leftMass: number
  leftArm: number
  rightMass: number
  rightArm: number
}

const PIVOT_Y = 1.6
const PLANK = 9
const PLANK_MASS = 2
const HALF_T = 0.11
const ARROW = 0.3 // world units per kg of weight

const boxHeight = (m: number) => 0.5 + m * 0.1

function WeightArrow({
  arrow,
  color,
}: {
  arrow: RefObject<THREE.Group | null>
  color: string
}) {
  return (
    <group ref={arrow}>
      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 1, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh name="tip" rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.12, 0.28, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  )
}

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const plank = useRef<THREE.Group>(null)
  const leftArrow = useRef<THREE.Group>(null)
  const rightArrow = useRef<THREE.Group>(null)
  const state = useRef({ angle: 0, omega: 0 })
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    state.current = { angle: 0, omega: 0 }
  }, [resetKey, v.leftMass, v.leftArm, v.rightMass, v.rightArm])

  useFixedStep((dt) => {
    const s = state.current
    const inertia =
      (PLANK_MASS * PLANK ** 2) / 12 +
      v.leftMass * v.leftArm ** 2 +
      v.rightMass * v.rightArm ** 2
    // Point loads: lever arm shrinks with cos θ as the plank tilts.
    const torque =
      leverNetTorque(v.leftMass, v.leftArm, v.rightMass, v.rightArm) *
      Math.cos(s.angle)
    const overTravel = Math.max(0, Math.abs(s.angle) - 0.4)
    const contact = overTravel ? -Math.sign(s.angle) * overTravel * 90 : 0
    // 0.22 slows the tip into a readable pace.
    s.omega += ((torque / inertia) * 0.22 + contact) * dt
    s.omega *= Math.exp(-(overTravel ? 7 : 2.2) * dt)
    s.angle += s.omega * dt
    if (Math.abs(s.angle) > 0.46) {
      s.angle = clamp(s.angle, -0.46, 0.46)
      s.omega *= -0.12
    }
  }, 120)

  useFrame(() => {
    const a = state.current.angle
    plank.current?.rotation.set(0, 0, a)
    const c = Math.cos(a)
    const sn = Math.sin(a)
    const place = (
      g: THREE.Group | null,
      x: number,
      h: number,
      mass: number
    ) => {
      if (!g) return
      // Arrow starts at the load's centre and points straight down (weight is vertical).
      const ly = HALF_T + h / 2
      tmp.set(x * c - ly * sn, PIVOT_Y + x * sn + ly * c, 0.5)
      g.position.copy(tmp)
      const len = mass * ARROW
      g.children[0].scale.y = len
      g.children[0].position.y = -len / 2
      g.children[1].position.y = -len
    }
    place(leftArrow.current, -v.leftArm, boxHeight(v.leftMass), v.leftMass)
    place(rightArrow.current, v.rightArm, boxHeight(v.rightMass), v.rightMass)
  })

  const lh = boxHeight(v.leftMass)
  const rh = boxHeight(v.rightMass)
  return (
    <>
      <group ref={plank} position={[0, PIVOT_Y, 0]}>
        <mesh>
          <boxGeometry args={[PLANK, HALF_T * 2, 0.8]} />
          <meshStandardMaterial color={palette.object} />
        </mesh>
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} position={[i - 4, HALF_T + 0.01, 0.38]}>
            <boxGeometry args={[0.03, 0.02, 0.06]} />
            <meshBasicMaterial color={palette.foreground} />
          </mesh>
        ))}
        <mesh position={[-v.leftArm, HALF_T + lh / 2, 0]}>
          <boxGeometry args={[0.55, lh, 0.55]} />
          <meshStandardMaterial color={palette.primary} />
        </mesh>
        <mesh position={[v.rightArm, HALF_T + rh / 2, 0]}>
          <boxGeometry args={[0.55, rh, 0.55]} />
          <meshStandardMaterial color={palette.secondary} />
        </mesh>
      </group>
      <WeightArrow arrow={leftArrow} color={palette.warning} />
      <WeightArrow arrow={rightArrow} color={palette.warning} />
      <mesh position={[0, 0.74, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.7, 1.5, 4]} />
        <meshStandardMaterial color={palette.object} />
      </mesh>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 3.4, 8], target: [0, 1.3, 0] },
  params: [
    {
      key: "leftMass",
      label: "Left mass",
      min: 1,
      max: 8,
      step: 1,
      value: 3,
      unit: "kg",
    },
    {
      key: "leftArm",
      label: "Left distance",
      min: 1,
      max: 4,
      step: 0.5,
      value: 2,
      unit: "m",
    },
    {
      key: "rightMass",
      label: "Right mass",
      min: 1,
      max: 8,
      step: 1,
      value: 2,
      unit: "kg",
    },
    {
      key: "rightArm",
      label: "Right distance",
      min: 1,
      max: 4,
      step: 0.5,
      value: 3,
      unit: "m",
    },
  ],
  readout: (v) => {
    const l = v.leftMass * G_EARTH * v.leftArm
    const r = v.rightMass * G_EARTH * v.rightArm
    const net = l - r
    return `Torque left ${l.toFixed(1)} N·m · right ${r.toFixed(1)} N·m · net ${net.toFixed(1)} N·m (${Math.abs(net) < 0.05 ? "balanced" : net > 0 ? "tips left" : "tips right"})`
  },
  Scene,
})
