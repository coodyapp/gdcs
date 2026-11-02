import { useLayoutEffect, useMemo, useRef } from "react"
import { Edges, Line } from "@react-three/drei"
import * as THREE from "three"

import {
  chain,
  rotation,
  scaling,
  transformPoint,
  translation,
  type Mat4,
} from "@/lib/transforms"

import { defineVisual, palette, rad } from "../../kit"

type V = { order: string; tx: number; yaw: number; s: number }

function matrices(v: V) {
  const T = translation(v.tx, 0, 0)
  const R = rotation("Y", rad(v.yaw))
  const S = scaling(v.s)
  const trs = chain(T, R, S)
  const rts = chain(R, T, S)
  return v.order === "TRS"
    ? { main: trs, ghost: rts }
    : { main: rts, ghost: trs }
}

/** A small ship whose nose points down local +X, so rotation is readable. */
function Ship({ m, ghost }: { m: Mat4; ghost?: boolean }) {
  const ref = useRef<THREE.Group>(null)
  useLayoutEffect(() => {
    if (!ref.current) return
    ref.current.matrix.fromArray(m)
    ref.current.matrixWorldNeedsUpdate = true
  }, [m])
  const material = ghost ? (
    <meshBasicMaterial
      color={palette.tertiary}
      transparent
      opacity={0.08}
      depthWrite={false}
    />
  ) : (
    <meshStandardMaterial color={palette.subject} roughness={0.5} />
  )
  const edges = ghost ? <Edges color={palette.tertiary} /> : null
  return (
    <group ref={ref} matrixAutoUpdate={false}>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[1.2, 0.5, 0.7]} />
        {material}
        {edges}
      </mesh>
      <mesh position={[0.9, 0.3, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.32, 0.6, 4]} />
        {material}
        {edges}
      </mesh>
      <mesh position={[-0.4, 0.75, 0]}>
        <boxGeometry args={[0.35, 0.4, 0.08]} />
        {material}
        {edges}
      </mesh>
    </group>
  )
}

function Scene({ v }: { v: V }) {
  const { main, ghost } = useMemo(() => matrices(v), [v])
  const ring = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(a) * v.tx, 0.01, Math.sin(a) * v.tx))
    }
    return pts
  }, [v.tx])
  return (
    <>
      {/* World axes at the origin: X red, Z cyan (Three.js convention). */}
      <Line
        points={[
          [0, 0.02, 0],
          [1.4, 0.02, 0],
        ]}
        color={palette.negative}
        lineWidth={2}
      />
      <Line
        points={[
          [0, 0.02, 0],
          [0, 0.02, 1.4],
        ]}
        color={palette.primary}
        lineWidth={2}
      />
      <mesh position={[0, 0.02, 0]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshBasicMaterial color={palette.foreground} />
      </mesh>
      {v.tx > 0.05 && (
        <Line
          points={ring}
          color={palette.guide}
          lineWidth={1}
          dashed
          dashSize={0.15}
          gapSize={0.12}
          transparent
          opacity={0.6}
        />
      )}
      <Ship m={ghost} ghost />
      <Ship m={main} />
    </>
  )
}

const fmt = (m: Mat4) =>
  transformPoint(m, [0, 0, 0])
    .filter((_, i) => i !== 1)
    .map((x) => (Math.abs(x) < 0.005 ? 0 : x).toFixed(2))
    .join(", ")

export default defineVisual<V>({
  camera: { position: [0, 5.6, 5.2], target: [0, 0, 0.2] },
  params: [
    {
      key: "order",
      label: "Order",
      type: "select",
      value: "TRS",
      options: [
        { value: "TRS", label: "T·R·S (spin in place)" },
        { value: "RTS", label: "R·T·S (orbit origin)" },
      ],
    },
    {
      key: "tx",
      label: "Translate X",
      min: 0,
      max: 3.5,
      step: 0.1,
      value: 2.5,
      unit: "u",
      digits: 1,
    },
    {
      key: "yaw",
      label: "Rotate Y",
      min: -180,
      max: 180,
      step: 1,
      value: 70,
      unit: "°",
    },
    {
      key: "s",
      label: "Scale",
      min: 0.4,
      max: 1.6,
      step: 0.05,
      value: 1,
      digits: 2,
    },
  ],
  readout: (v) => {
    const { main, ghost } = matrices(v)
    const other = v.order === "TRS" ? "R·T·S" : "T·R·S"
    const self = v.order === "TRS" ? "T·R·S" : "R·T·S"
    return `Ship centre (x, z): ${self} (${fmt(main)}) · ${other} (${fmt(ghost)})`
  },
  Scene,
})
