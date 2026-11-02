import { useEffect, useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"

import { metalRoughF0, type V3 } from "@/lib/optics"

import { neutral, sim } from "@/styles/tokens"

import { defineVisual, palette, useClock } from "../../kit"

type V = {
  roughness: number
  metalness: number
  base: string
  clearcoat: boolean
}

const BASES: Record<string, { label: string; hex: string }> = {
  gold: { label: "Gold", hex: sim.yellow },
  copper: { label: "Green paint", hex: sim.green },
  red: { label: "Red paint", hex: sim.red },
  white: { label: "Off-white", hex: neutral.light },
}

const STEPS = 5
const GAP = 0.95
const GRID_X = -4.5
const GRID_Y = 0.55
const BIG: [number, number, number] = [2.75, 2.45, 0]

/**
 * Image-based lighting without any network fetch: render Three.js's
 * procedural RoomEnvironment into a prefiltered (PMREM) cube once.
 */
function ProceduralEnvironment() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const time = useClock(0.15)
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const env = pmrem.fromScene(room, 0.04).texture
    const previous = scene.environment
    const previousIntensity = scene.environmentIntensity
    scene.environment = env
    scene.environmentIntensity = 0.6
    // The stage's flat fill lights would wash out the diffuse spheres; let
    // the environment do most of the lighting while this scene is mounted.
    const dimmed: [THREE.Light, number][] = []
    scene.traverse((o) => {
      if (!(o instanceof THREE.Light)) return
      const scale =
        o instanceof THREE.AmbientLight || o instanceof THREE.HemisphereLight
          ? 0.1
          : 0.5
      dimmed.push([o, o.intensity])
      o.intensity *= scale
    })
    return () => {
      for (const [light, intensity] of dimmed) light.intensity = intensity
      scene.environment = previous
      scene.environmentIntensity = previousIntensity
      env.dispose()
      pmrem.dispose()
      room.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          ;(o.material as THREE.Material).dispose()
        }
      })
    }
  }, [gl, scene])
  // Slowly turn the environment so highlights slide across the spheres.
  useFrame(() => {
    scene.environmentRotation.y = time.current
  })
  return null
}

const cell = (i: number) => i / (STEPS - 1)

function Scene({ v }: { v: V }) {
  const base = BASES[v.base]?.hex ?? BASES.gold.hex
  const ring = useRef<THREE.Mesh>(null)
  const geometry = useMemo(() => new THREE.SphereGeometry(0.36, 48, 24), [])
  const near = (x: number) => Math.round(x * (STEPS - 1))
  const ci = near(v.roughness)
  const cj = near(v.metalness)

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <group>
      <ProceduralEnvironment />
      {Array.from({ length: STEPS * STEPS }, (_, k) => {
        const i = k % STEPS // roughness →
        const j = Math.floor(k / STEPS) // metalness ↑
        return (
          <mesh
            key={k}
            geometry={geometry}
            position={[GRID_X + i * GAP, GRID_Y + j * GAP, 0]}
          >
            <meshStandardMaterial
              color={base}
              roughness={Math.max(0.04, cell(i))}
              metalness={cell(j)}
            />
          </mesh>
        )
      })}
      {/* Selection: cyan ring on the nearest grid cell */}
      <mesh ref={ring} position={[GRID_X + ci * GAP, GRID_Y + cj * GAP, 0.05]}>
        <torusGeometry args={[0.45, 0.035, 8, 48]} />
        <meshBasicMaterial color={palette.subject} />
      </mesh>
      {/* Axes: roughness grows to the right, metalness grows upward */}
      <Line
        points={[
          [GRID_X - 0.4, GRID_Y - 0.6, 0],
          [GRID_X + (STEPS - 1) * GAP + 0.4, GRID_Y - 0.6, 0],
        ]}
        color={palette.guide}
        lineWidth={1}
      />
      <Line
        points={[
          [GRID_X - 0.6, GRID_Y - 0.4, 0],
          [GRID_X - 0.6, GRID_Y + (STEPS - 1) * GAP + 0.4, 0],
        ]}
        color={palette.guide}
        lineWidth={1}
      />
      <mesh
        position={[GRID_X + (STEPS - 1) * GAP + 0.45, GRID_Y - 0.6, 0]}
        rotation={[0, 0, -Math.PI / 2]}
      >
        <coneGeometry args={[0.07, 0.18, 12]} />
        <meshBasicMaterial color={palette.guide} />
      </mesh>
      <mesh position={[GRID_X - 0.6, GRID_Y + (STEPS - 1) * GAP + 0.45, 0]}>
        <coneGeometry args={[0.07, 0.18, 12]} />
        <meshBasicMaterial color={palette.guide} />
      </mesh>
      {/* Selected material, large */}
      <mesh position={BIG}>
        <sphereGeometry args={[1.55, 96, 48]} />
        <meshPhysicalMaterial
          color={base}
          roughness={v.roughness}
          metalness={v.metalness}
          clearcoat={v.clearcoat ? 1 : 0}
          clearcoatRoughness={0.05}
        />
      </mesh>
      <mesh position={[BIG[0], BIG[1], 0]}>
        <torusGeometry args={[1.68, 0.03, 8, 96]} />
        <meshBasicMaterial color={palette.subject} />
      </mesh>
    </group>
  )
}

const toLinear = (hex: string): V3 => {
  const c = new THREE.Color(hex) // stored linear under ColorManagement
  return [c.r, c.g, c.b]
}

export default defineVisual<V>({
  camera: { position: [0, 2.45, 10.2], target: [-0.3, 2.45, 0] },
  params: [
    {
      key: "roughness",
      label: "Roughness",
      min: 0,
      max: 1,
      step: 0.01,
      value: 0.25,
      digits: 2,
    },
    {
      key: "metalness",
      label: "Metalness",
      min: 0,
      max: 1,
      step: 0.01,
      value: 1,
      digits: 2,
    },
    {
      key: "base",
      label: "Base colour (albedo)",
      type: "select",
      value: "gold",
      options: Object.entries(BASES).map(([value, b]) => ({
        value,
        label: b.label,
      })),
    },
    {
      key: "clearcoat",
      label: "Clear coat (physical)",
      type: "toggle",
      value: false,
    },
  ],
  readout: (v) => {
    const f0 = metalRoughF0(
      toLinear(BASES[v.base]?.hex ?? BASES.gold.hex),
      v.metalness
    )
    const diffuse = (1 - v.metalness) * 100
    return `F0 = (${f0.map((x) => x.toFixed(2)).join(", ")}) · diffuse ${diffuse.toFixed(0)}% of albedo · roughness ${v.roughness.toFixed(2)}`
  },
  Scene,
})
