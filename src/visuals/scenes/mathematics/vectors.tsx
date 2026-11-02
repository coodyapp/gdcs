import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { add, length, type V3 } from "@/lib/vector-math"

import { Arrow, makeLine, setArrow, setSegment } from "../../arrow"
import { defineVisual, palette, rad, useClock } from "../../kit"

type V = { auto: boolean; angle: number; len: number }

const ORIGIN = new THREE.Vector3(-2.3, -1.5, 0)
const A: V3 = [3.2, 0.9, 0]
const SWING = 40

const bOf = (angleDeg: number, len: number): V3 => [
  len * Math.cos(rad(angleDeg)),
  len * Math.sin(rad(angleDeg)),
  0,
]

function Scene({ v }: { v: V }) {
  const time = useClock()
  const aRef = useRef<THREE.Group>(null)
  const bRef = useRef<THREE.Group>(null)
  const sumRef = useRef<THREE.Group>(null)
  const tips = useMemo(
    () => ({
      a: new THREE.Vector3(...A).add(ORIGIN),
      b: new THREE.Vector3(),
      sum: new THREE.Vector3(),
    }),
    []
  )
  // Parallelogram edges: b moved to a's tip, a moved to b's tip.
  const bAtA = useMemo(
    () => makeLine(palette.tertiary, 2, { dash: 0.16, gap: 0.1 }, 0.9),
    []
  )
  const aAtB = useMemo(
    () => makeLine(palette.primary, 2, { dash: 0.16, gap: 0.1 }, 0.9),
    []
  )

  useFrame(() => {
    const angle = v.auto
      ? v.angle + SWING * Math.sin(time.current * 0.7)
      : v.angle
    const t = rad(angle)
    tips.b.set(Math.cos(t) * v.len, Math.sin(t) * v.len, 0).add(ORIGIN)
    tips.sum.copy(tips.a).add(tips.b).sub(ORIGIN)
    setArrow(aRef.current, ORIGIN, tips.a)
    setArrow(bRef.current, ORIGIN, tips.b)
    setArrow(sumRef.current, ORIGIN, tips.sum)
    setSegment(bAtA, tips.a, tips.sum)
    setSegment(aAtB, tips.b, tips.sum)
  })

  return (
    <>
      <gridHelper
        args={[24, 24, palette.grid, palette.grid]}
        rotation={[Math.PI / 2, 0, 0]}
        position={[ORIGIN.x, ORIGIN.y, -0.05]}
      />
      <primitive object={bAtA} />
      <primitive object={aAtB} />
      <Arrow ref={sumRef} color={palette.secondary} radius={0.07} head={0.34} />
      <Arrow ref={aRef} color={palette.primary} />
      <Arrow ref={bRef} color={palette.tertiary} hollow />
      <mesh position={ORIGIN}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color={palette.foreground} />
      </mesh>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 0, 7.4], target: [0, 0, 0] },
  grid: false,
  orbit: false,
  params: [
    { key: "auto", label: "Swing b", type: "toggle", value: true },
    {
      key: "angle",
      label: "Angle of b",
      min: 0,
      max: 180,
      step: 1,
      value: 70,
      unit: "°",
    },
    {
      key: "len",
      label: "|b|",
      min: 0.3,
      max: 3,
      step: 0.05,
      value: 2.2,
      digits: 2,
    },
  ],
  readout: (v) => {
    const b = bOf(v.angle, v.len)
    const s = add(A, b)
    const head = `|a| = ${length(A).toFixed(2)} · |b| = ${v.len.toFixed(2)}`
    if (v.auto)
      return `${head} · |a+b| ≤ |a| + |b| = ${(length(A) + v.len).toFixed(2)} (turn swing off for exact values)`
    return `${head} · a+b = (${s[0].toFixed(2)}, ${s[1].toFixed(2)}) · |a+b| = ${length(s).toFixed(2)} · |a+b|² = ${(s[0] ** 2 + s[1] ** 2).toFixed(2)}`
  },
  Scene,
})
