import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import {
  isGimbalLocked,
  middleAxis,
  type EulerOrder,
  type Vec3,
} from "@/lib/transforms"

import { defineVisual, palette, rad, useClock } from "../../kit"

type V = { order: string; middle: number; wobble: boolean }
type Axis = "X" | "Y" | "Z"

const AXIS_COLOR: Record<Axis, string> = {
  X: palette.negative,
  Y: palette.positive,
  Z: palette.primary,
}
const UNIT: Record<Axis, Vec3> = { X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] }
/** Torus lies in XY (axis Z) by default; turn it so its axis is `a`. */
const RING_ROT: Record<Axis, Vec3> = {
  X: [0, Math.PI / 2, 0],
  Y: [Math.PI / 2, 0, 0],
  Z: [0, 0, 0],
}
const RADII = [2.3, 1.9, 1.5]

function Ring({ axis, radius }: { axis: Axis; radius: number }) {
  return (
    <mesh rotation={RING_ROT[axis]}>
      <torusGeometry args={[radius, 0.06, 10, 96]} />
      <meshBasicMaterial color={AXIS_COLOR[axis]} />
    </mesh>
  )
}

function AxisLine({ axis, dashed }: { axis: Axis; dashed?: boolean }) {
  const [x, y, z] = UNIT[axis]
  const L = 3.1
  return (
    <Line
      points={[
        [-x * L, -y * L, -z * L],
        [x * L, y * L, z * L],
      ]}
      color={AXIS_COLOR[axis]}
      lineWidth={dashed ? 2.5 : 1.5}
      dashed={dashed}
      dashSize={0.18}
      gapSize={0.14}
    />
  )
}

function Ship() {
  return (
    <group scale={0.8}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 1.6, 12]} />
        <meshStandardMaterial color={palette.moving} />
      </mesh>
      <mesh position={[0, 0, 1.0]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.3, 0.5, 16]} />
        <meshStandardMaterial color={palette.moving} />
      </mesh>
      <mesh>
        <boxGeometry args={[1.6, 0.05, 0.4]} />
        <meshStandardMaterial color={palette.moving} />
      </mesh>
      {/* Fin on +Y makes roll readable. */}
      <mesh position={[0, 0.3, -0.6]}>
        <boxGeometry args={[0.05, 0.45, 0.4]} />
        <meshStandardMaterial color={palette.foreground} />
      </mesh>
    </group>
  )
}

function setAxisAngle(g: THREE.Group, axis: Axis, angle: number) {
  g.rotation.set(0, 0, 0)
  g.rotation[axis.toLowerCase() as "x" | "y" | "z"] = angle
}

function Scene({ v }: { v: V }) {
  const time = useClock()
  const [outerAxis, midAxis, innerAxis] = useMemo(
    () => v.order.split("") as Axis[],
    [v.order]
  )
  const outer = useRef<THREE.Group>(null)
  const mid = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)

  useFrame(() => {
    if (!outer.current || !mid.current || !inner.current) return
    const t = time.current
    const a = v.wobble ? rad(35) * Math.sin(t * 1.3) : 0
    const c = v.wobble ? rad(35) * Math.sin(t * 1.3 + 1.7) : 0
    setAxisAngle(outer.current, outerAxis, a)
    setAxisAngle(mid.current, midAxis, rad(v.middle))
    setAxisAngle(inner.current, innerAxis, c)
  })

  return (
    <group position={[0, 2.4, 0]}>
      <AxisLine axis={outerAxis} />
      <group ref={outer}>
        <Ring axis={outerAxis} radius={RADII[0]} />
        <group ref={mid}>
          <Ring axis={midAxis} radius={RADII[1]} />
          <AxisLine axis={innerAxis} dashed />
          <group ref={inner}>
            <Ring axis={innerAxis} radius={RADII[2]} />
            <Ship />
          </group>
        </group>
      </group>
    </group>
  )
}

export default defineVisual<V>({
  gridY: 0,
  camera: { position: [5.2, 5.4, 6.4], target: [0, 2.2, 0] },
  params: [
    {
      key: "order",
      label: "Rotation order",
      type: "select",
      value: "YXZ",
      options: [
        { value: "YXZ", label: "YXZ (yaw, pitch, roll)" },
        { value: "XYZ", label: "XYZ (Three.js default)" },
        { value: "ZXY", label: "ZXY" },
      ],
    },
    {
      key: "middle",
      label: "Middle ring angle",
      min: -90,
      max: 90,
      step: 1,
      value: 90,
      unit: "°",
    },
    {
      key: "wobble",
      label: "Wobble outer + inner",
      type: "toggle",
      value: true,
    },
  ],
  readout: (v) => {
    const order = v.order as EulerOrder
    const [o, , i] = order.split("")
    const m = middleAxis(order)
    const angles: Vec3 = [0, 0, 0]
    angles["XYZ".indexOf(m)] = rad(v.middle)
    if (isGimbalLocked(angles, order, rad(0.5)))
      return `Gimbal lock: middle ${m} at ${v.middle}°, so outer ${o} and inner ${i} spin around the same line`
    return `Middle ${m} at ${v.middle}° · outer ${o} and inner ${i} axes are ${90 - Math.abs(v.middle)}° apart`
  },
  Scene,
})
