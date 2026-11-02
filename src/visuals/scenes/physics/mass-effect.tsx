import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { PHYSICS_CONSTANTS } from "@/lib/physics/constants"
import {
  calculatePotentialWellProxy,
  schwarzschildRadius,
} from "@/lib/physics/gravity"

import { defineVisual, palette, useClock } from "../../kit"

type V = { mass: number; resolution: number; curvature: boolean }

const SIZE = 20 // model units (as in the original), scaled down by SCALE
const SCALE = 0.42
const DEPTH = 0.9 // extra vertical squash so 10 M☉ still fits the card
const PROBE_R = 4.2

function Scene({ v }: { v: V }) {
  const time = useClock()
  const star = useRef<THREE.Mesh>(null)
  const probe = useRef<THREE.Mesh>(null)
  const res = Math.min(40, Math.round(v.resolution))

  // The well is static for a given mass, so it is rebuilt only when inputs change.
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, res, res)
    const pos = geo.attributes.position.array as Float32Array
    if (v.curvature) {
      for (let i = 0; i < pos.length; i += 3) {
        pos[i + 2] =
          calculatePotentialWellProxy(pos[i], pos[i + 1], v.mass) * DEPTH
      }
    }
    geo.computeVertexNormals()
    return geo
  }, [res, v.mass, v.curvature])
  useEffect(() => () => geometry.dispose(), [geometry])

  const radius = 0.35 + 0.1 * Math.cbrt(v.mass) // symbolic size, not to scale
  const depthAt = (r: number) =>
    v.curvature ? calculatePotentialWellProxy(r, 0, v.mass) * DEPTH : 0
  const probeDepth = depthAt(PROBE_R)

  useFrame((_, delta) => {
    if (star.current) star.current.rotation.y += delta * 0.3
    if (!probe.current) return
    // Kepler: ω = √(GM/r³), in display units with GM ∝ mass.
    const omega = Math.sqrt(v.mass / PROBE_R ** 3) * 2.2
    const a = time.current * omega
    probe.current.position.set(
      Math.cos(a) * PROBE_R,
      probeDepth + 0.25,
      Math.sin(a) * PROBE_R
    )
  })

  return (
    <group scale={SCALE}>
      <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial
          color={palette.subject}
          wireframe
          transparent
          opacity={0.6}
        />
      </mesh>
      <mesh ref={star} position={[0, depthAt(0) + radius, 0]}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial
          color={palette.foreground}
          emissive={palette.foreground}
          emissiveIntensity={0.6}
        />
      </mesh>
      <mesh ref={probe}>
        <sphereGeometry args={[0.25, 20, 20]} />
        <meshStandardMaterial
          color={palette.moving}
          emissive={palette.moving}
          emissiveIntensity={0.4}
        />
      </mesh>
    </group>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 4.6, 8.2], target: [0, -0.6, 0] },
  params: [
    {
      key: "mass",
      label: "Mass",
      min: 0.1,
      max: 10,
      step: 0.1,
      value: 3,
      unit: "M☉",
      digits: 1,
    },
    {
      key: "resolution",
      label: "Grid resolution",
      min: 10,
      max: 40,
      step: 5,
      value: 30,
      digits: 0,
    },
    {
      key: "curvature",
      label: "Show gravity well",
      type: "toggle",
      value: true,
    },
  ],
  readout: (v) => {
    const rs = schwarzschildRadius(v.mass * PHYSICS_CONSTANTS.M_sun)
    return `Schwarzschild radius ${(rs / 1000).toFixed(2)} km · ${(rs / 1000 / v.mass).toFixed(2)} km per M☉`
  },
  Scene,
})
