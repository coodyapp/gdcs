import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import { degToRad, radToDeg, wrapAngle } from "@/lib/vector-math"

import { Arrow, makeLine, setArrow, setSegment } from "../../arrow"
import { defineVisual, palette, useClock } from "../../kit"

type V = { auto: boolean; angle: number }

const C = new THREE.Vector3(0, 0, 0)
/** Display radius of the unit circle (1 unit of math = R scene units). */
const R = 2.2
const ARC_R = 0.6
const ARC_N = 48
const BAR = 0.0001 // head size for headless bars

const circle = Array.from({ length: 97 }, (_, i) => {
  const t = (i / 96) * Math.PI * 2
  return [C.x + R * Math.cos(t), C.y + R * Math.sin(t), 0] as [
    number,
    number,
    number,
  ]
})

function Scene({ v }: { v: V }) {
  const time = useClock()
  const radiusRef = useRef<THREE.Group>(null)
  const cosRef = useRef<THREE.Group>(null)
  const sinRef = useRef<THREE.Group>(null)
  const pointRef = useRef<THREE.Mesh>(null)
  const targetRef = useRef<THREE.Mesh>(null)
  const p = useMemo(
    () => ({
      target: new THREE.Vector3(),
      point: new THREE.Vector3(),
      foot: new THREE.Vector3(),
    }),
    []
  )
  const aim = useMemo(
    () => makeLine(palette.primary, 2, { dash: 0.16, gap: 0.12 }, 0.75),
    []
  )
  const arc = useMemo(() => makeLine(palette.foreground, ARC_N + 1), [])

  useFrame(() => {
    const s = time.current
    if (v.auto) {
      const r = 3 + 0.3 * Math.sin(s * 1.3)
      const k = s * 0.5 + 0.8
      p.target.set(C.x + 1.3 * r * Math.cos(k), C.y + 0.85 * r * Math.sin(k), 0)
    } else {
      const k = degToRad(v.angle)
      p.target.set(C.x + 2.8 * Math.cos(k), C.y + 2.8 * Math.sin(k), 0)
    }
    // The whole point of the sheet: heading from a direction via atan2.
    const theta = Math.atan2(p.target.y - C.y, p.target.x - C.x)
    const cos = Math.cos(theta)
    const sin = Math.sin(theta)
    p.point.set(C.x + R * cos, C.y + R * sin, 0)
    p.foot.set(C.x + R * cos, C.y, 0)
    setArrow(radiusRef.current, C, p.point)
    setArrow(cosRef.current, C, p.foot)
    setArrow(sinRef.current, p.foot, p.point)
    setSegment(aim, p.point, p.target)
    pointRef.current?.position.copy(p.point)
    targetRef.current?.position.copy(p.target)
    const pos = arc.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i <= ARC_N; i++) {
      const a = (theta * i) / ARC_N
      pos.setXYZ(i, C.x + ARC_R * Math.cos(a), C.y + ARC_R * Math.sin(a), 0)
    }
    pos.needsUpdate = true
    arc.geometry.computeBoundingSphere()
  })

  return (
    <>
      <Line
        points={[
          [C.x - R - 0.6, C.y, 0],
          [C.x + R + 0.6, C.y, 0],
        ]}
        color={palette.guide}
        lineWidth={1}
        transparent
        opacity={0.6}
      />
      <Line
        points={[
          [C.x, C.y - R - 0.6, 0],
          [C.x, C.y + R + 0.6, 0],
        ]}
        color={palette.guide}
        lineWidth={1}
        transparent
        opacity={0.6}
      />
      <Line points={circle} color={palette.guide} lineWidth={1.5} />
      <primitive object={aim} />
      <primitive object={arc} />
      <Arrow ref={cosRef} color={palette.secondary} radius={0.06} head={BAR} />
      <Arrow ref={sinRef} color={palette.tertiary} radius={0.06} head={BAR} />
      <Arrow ref={radiusRef} color={palette.primary} radius={0.035} />
      <mesh position={C}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color={palette.foreground} />
      </mesh>
      <mesh ref={pointRef}>
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshBasicMaterial color={palette.primary} />
      </mesh>
      <mesh ref={targetRef}>
        <octahedronGeometry args={[0.2]} />
        <meshBasicMaterial color={palette.positive} />
      </mesh>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 0, 7.4], target: [0, 0, 0] },
  grid: false,
  orbit: false,
  params: [
    { key: "auto", label: "Move target", type: "toggle", value: true },
    {
      key: "angle",
      label: "Target angle",
      min: -360,
      max: 360,
      step: 1,
      value: 135,
      unit: "°",
    },
  ],
  readout: (v) => {
    if (v.auto)
      return "θ = atan2(dy, dx) follows the green target in (−180°, 180°]; the point on the circle is (cos θ, sin θ). Turn the target off to read exact values."
    const theta = wrapAngle(degToRad(v.angle))
    return `slider ${v.angle}° wraps to θ = ${radToDeg(theta).toFixed(0)}° = ${theta.toFixed(3)} rad · cos θ = ${Math.cos(theta).toFixed(3)} · sin θ = ${Math.sin(theta).toFixed(3)}`
  },
  Scene,
})
