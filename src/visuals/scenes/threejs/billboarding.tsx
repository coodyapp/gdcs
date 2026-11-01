import { useEffect, useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"

import { defineVisual, palette, rad, useClock } from "../../kit"

type V = { mode: string; elevation: number; spin: number }

const TARGET = new THREE.Vector3(0, 0.5, 0)
const RADIUS = 11
const CARDS: [number, number][] = [
  [0, 0],
  [2.2, 0.6],
  [-2.1, 0.9],
  [1.0, -2.2],
  [-1.2, -1.9],
  [0.6, 2.4],
  [-2.6, -0.7],
  [2.5, -1.5],
]

/** Flat tree silhouette in the XY plane, base at y = 0, facing +Z. */
function treeShape() {
  const s = new THREE.Shape()
  s.moveTo(-0.12, 0)
  s.lineTo(0.12, 0)
  s.lineTo(0.12, 0.35)
  s.lineTo(0.6, 0.35)
  s.lineTo(0, 1.7)
  s.lineTo(-0.6, 0.35)
  s.lineTo(-0.12, 0.35)
  s.closePath()
  return new THREE.ShapeGeometry(s)
}

function Scene({ v }: { v: V }) {
  const time = useClock()
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as { update?: () => void } | null
  const platform = useRef<THREE.Group>(null)
  const cards = useRef<(THREE.Group | null)[]>([])
  const geometry = useMemo(treeShape, [])
  const tmp = useMemo(
    () => ({
      parentQ: new THREE.Quaternion(),
      pos: new THREE.Vector3(),
      eye: new THREE.Vector3(),
    }),
    []
  )

  // Put the camera at the requested elevation, keeping its azimuth.
  useEffect(() => {
    const offset = camera.position.clone().sub(TARGET)
    const azimuth = Math.atan2(offset.x, offset.z)
    const phi = rad(90 - v.elevation)
    camera.position.setFromSphericalCoords(RADIUS, phi, azimuth).add(TARGET)
    camera.lookAt(TARGET)
    controls?.update?.()
  }, [camera, controls, v.elevation])

  useFrame(() => {
    const p = platform.current
    if (!p) return
    p.rotation.y = time.current * v.spin
    p.updateMatrixWorld()
    p.getWorldQuaternion(tmp.parentQ).invert()
    camera.getWorldPosition(tmp.eye)
    for (const c of cards.current) {
      if (!c) continue
      if (v.mode === "full") {
        c.quaternion.copy(tmp.parentQ).multiply(camera.quaternion)
      } else if (v.mode === "y") {
        c.getWorldPosition(tmp.pos)
        const yaw = Math.atan2(tmp.eye.x - tmp.pos.x, tmp.eye.z - tmp.pos.z)
        c.rotation.set(0, yaw - p.rotation.y, 0)
      } else {
        c.rotation.set(0, 0, 0)
      }
    }
  })

  return (
    <group ref={platform}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[3.6, 64]} />
        <meshStandardMaterial color={palette.surface} roughness={0.9} />
      </mesh>
      {CARDS.map(([x, z], i) => (
        <group key={i} position={[x, 0.02, z]}>
          {/* Pivot at the card centre for full mode; geometry is offset upward. */}
          <group
            position={[0, 0.85, 0]}
            ref={(g) => {
              cards.current[i] = g
            }}
          >
            <mesh geometry={geometry} position={[0, -0.85, 0]}>
              <meshBasicMaterial
                color={palette.positive}
                side={THREE.FrontSide}
              />
            </mesh>
            <mesh geometry={geometry} position={[0, -0.85, 0]}>
              <meshBasicMaterial
                color={palette.negative}
                side={THREE.BackSide}
              />
            </mesh>
            <mesh position={[0, 0, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.025, 0.025, 0.6, 6]} />
              <meshBasicMaterial color={palette.warning} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 7.6, 8.9], target: [0, 0.5, 0] },
  params: [
    {
      key: "mode",
      label: "Billboard mode",
      type: "select",
      value: "y",
      options: [
        { value: "off", label: "Off" },
        { value: "y", label: "Y-axis" },
        { value: "full", label: "Full" },
      ],
    },
    {
      key: "elevation",
      label: "Camera elevation",
      min: 5,
      max: 85,
      step: 1,
      value: 40,
      unit: "°",
    },
    {
      key: "spin",
      label: "Platform spin",
      min: 0,
      max: 1.5,
      step: 0.05,
      value: 0.4,
      digits: 2,
    },
  ],
  readout: (v) =>
    v.mode === "full"
      ? "Full: quad rotation = camera rotation, so it tilts back as the camera rises"
      : v.mode === "y"
        ? "Y-axis: yaw only (atan2 of eye − card on XZ), cards stay upright"
        : "Off: cards keep their own rotation; you see edges and backs",
  Scene,
})
