import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { cross, dot, length, radToDeg, type V3 } from "@/lib/vector-math"

import { Arrow, makeLine, setArrow, setSegment } from "../../arrow"
import { defineVisual, palette, rad, useClock } from "../../kit"

type V = { auto: boolean; angle: number; len: number }

const Y = 0.02
const A: V3 = [2.8, 0, 0]
const ORIGIN = new THREE.Vector3(-0.8, Y, 0.6)
/** The cross product can be long; draw it at this scale so it stays in frame. */
const CROSS_SCALE = 0.45

// b turns counter-clockwise (seen from above) around +Y, starting along a.
const bOf = (angleDeg: number, len: number): V3 => [
  len * Math.cos(rad(angleDeg)),
  0,
  -len * Math.sin(rad(angleDeg)),
]

function Scene({ v }: { v: V }) {
  const time = useClock()
  const aRef = useRef<THREE.Group>(null)
  const bRef = useRef<THREE.Group>(null)
  const cRef = useRef<THREE.Group>(null)
  const projRef = useRef<THREE.Group>(null)
  const p = useMemo(
    () => ({
      a: new THREE.Vector3(...A).add(ORIGIN),
      b: new THREE.Vector3(),
      bRel: new THREE.Vector3(),
      foot: new THREE.Vector3(),
      c: new THREE.Vector3(),
      unitA: new THREE.Vector3(...A).normalize(),
    }),
    []
  )
  const drop = useMemo(
    () => makeLine(palette.positive, 2, { dash: 0.1, gap: 0.08 }),
    []
  )
  const quad = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(4 * 3), 3)
    )
    g.setIndex([0, 1, 2, 0, 2, 3])
    return g
  }, [])

  useFrame(() => {
    const angle = v.auto ? (v.angle + time.current * 30) % 360 : v.angle
    const t = rad(angle)
    p.bRel.set(Math.cos(t) * v.len, 0, -Math.sin(t) * v.len)
    p.b.copy(p.bRel).add(ORIGIN)
    // Projection of b onto a (a is a unit direction times |a|).
    const along = p.bRel.dot(p.unitA)
    p.foot.copy(p.unitA).multiplyScalar(along).add(ORIGIN)
    // a × b, scaled for display, standing on the origin.
    p.c.set(A[0], A[1], A[2]).cross(p.bRel).multiplyScalar(CROSS_SCALE)
    p.c.add(ORIGIN)
    setArrow(aRef.current, ORIGIN, p.a)
    setArrow(bRef.current, ORIGIN, p.b)
    setArrow(cRef.current, ORIGIN, p.c)
    setArrow(projRef.current, ORIGIN, p.foot)
    setSegment(drop, p.b, p.foot)
    // Parallelogram O, a, a+b, b (its area is |a × b|).
    const pos = quad.attributes.position as THREE.BufferAttribute
    pos.setXYZ(0, ORIGIN.x, Y - 0.01, ORIGIN.z)
    pos.setXYZ(1, p.a.x, Y - 0.01, p.a.z)
    pos.setXYZ(2, p.a.x + p.bRel.x, Y - 0.01, p.a.z + p.bRel.z)
    pos.setXYZ(3, p.b.x, Y - 0.01, p.b.z)
    pos.needsUpdate = true
    quad.computeBoundingSphere()
  })

  return (
    <>
      <mesh geometry={quad}>
        <meshBasicMaterial
          color={palette.secondary}
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <primitive object={drop} />
      <Arrow ref={projRef} color={palette.positive} radius={0.09} head={0.2} />
      <Arrow ref={aRef} color={palette.primary} />
      <Arrow ref={bRef} color={palette.tertiary} hollow />
      <Arrow ref={cRef} color={palette.secondary} radius={0.06} head={0.32} />
      <mesh position={ORIGIN}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color={palette.foreground} />
      </mesh>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [2, 4.6, 6.4], target: [0.4, 0.5, 0.4] },
  params: [
    { key: "auto", label: "Rotate b", type: "toggle", value: true },
    {
      key: "angle",
      label: "Angle a→b",
      min: 0,
      max: 360,
      step: 1,
      value: 50,
      unit: "°",
    },
    {
      key: "len",
      label: "|b|",
      min: 0.5,
      max: 2.6,
      step: 0.05,
      value: 2,
      digits: 2,
    },
  ],
  readout: (v) => {
    if (v.auto)
      return "b turns around a: a·b peaks at 0°, hits 0 at 90° and goes negative past it; |a×b| peaks at 90°. Turn rotation off for exact values."
    const b = bOf(v.angle, v.len)
    const d = dot(A, b)
    const c = cross(A, b)
    const cos = d / (length(A) * v.len)
    return `θ = ${v.angle}° · a·b = ${d.toFixed(2)} (cos θ = ${cos.toFixed(2)}) · |a×b| = ${length(c).toFixed(2)} · a×b points ${c[1] >= 0 ? "up" : "down"} · angle via acos = ${radToDeg(Math.acos(Math.max(-1, Math.min(1, cos)))).toFixed(0)}°`
  },
  Scene,
})
