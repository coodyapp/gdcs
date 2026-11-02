import { useEffect, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"

import { defineVisual, palette, useClock } from "../../kit"

type V = { fix: string; gap: number; nearExp: number }

const FAR = 500
const LIFT = 0.02
const near = (exp: number) => 10 ** exp
/** Smallest depth gap a 24-bit buffer resolves at distance z. */
const depthStep = (z: number, n: number) =>
  (z * z * (FAR - n)) / (FAR * n * 2 ** 24)

function Scene({ v }: { v: V }) {
  const time = useClock()
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const group = useRef<THREE.Group>(null)

  useEffect(() => {
    const prev = camera.near
    camera.near = near(v.nearExp)
    camera.updateProjectionMatrix()
    return () => {
      camera.near = prev
      camera.updateProjectionMatrix()
    }
  }, [camera, v.nearExp])

  useFrame(() => {
    if (group.current) group.current.rotation.y = time.current * 0.15
  })

  const offset = v.fix === "offset"
  const lift = v.gap / 1000 + (v.fix === "lift" ? LIFT : 0)

  return (
    <group ref={group}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 8, 3, 3]} />
        <meshStandardMaterial color={palette.subject} roughness={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 6]} position={[0, lift, 0]}>
        <planeGeometry args={[4.6, 4.6, 5, 5]} />
        <meshStandardMaterial
          color={palette.moving}
          roughness={0.8}
          polygonOffset={offset}
          polygonOffsetFactor={offset ? -1 : 0}
          polygonOffsetUnits={offset ? -4 : 0}
        />
      </mesh>
      {/* Two coincident boxes: the classic modular-kit overlap. */}
      <mesh position={[2.6, 0.6, 2.6]}>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <meshStandardMaterial color={palette.object} />
      </mesh>
      <mesh
        position={[2.6, 0.6 + (v.fix === "lift" ? LIFT : 0), 2.6]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <boxGeometry args={[1.2, 1.2, 1.2, 2, 2, 2]} />
        <meshStandardMaterial
          color={palette.tertiary}
          polygonOffset={offset}
          polygonOffsetFactor={offset ? -1 : 0}
          polygonOffsetUnits={offset ? -4 : 0}
        />
      </mesh>
    </group>
  )
}

export default defineVisual<V>({
  gridY: -0.05,
  camera: { position: [0, 3.2, 10.5], target: [0, 0, 0] },
  params: [
    {
      key: "fix",
      label: "Fix",
      type: "select",
      value: "none",
      options: [
        { value: "none", label: "None" },
        { value: "offset", label: "polygonOffset" },
        { value: "lift", label: `Lift ${LIFT} u` },
      ],
    },
    {
      key: "gap",
      label: "Gap between layers",
      min: 0,
      max: 10,
      step: 0.1,
      value: 2,
      unit: "mm",
      digits: 1,
    },
    {
      key: "nearExp",
      label: "Near plane (log₁₀)",
      min: -5,
      max: 0,
      step: 0.1,
      value: -4,
      digits: 1,
    },
  ],
  readout: (v) => {
    const n = near(v.nearExp)
    const step = depthStep(10.5, n)
    return `near ${n < 0.01 ? n.toExponential(1) : n.toFixed(3)} · far ${FAR} · 24-bit depth step at 10.5 u ≈ ${step < 0.001 ? (step * 1000).toFixed(3) + " mm" : step.toFixed(4) + " u"}`
  },
  Scene,
})
