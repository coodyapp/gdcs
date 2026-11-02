import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { createNoise2D, fbm2D, mulberry32 } from "@/lib/noise"

import { defineVisual, palette, useClock } from "../../kit"

type V = { seed: number; octaves: number; frequency: number; height: number }

const SIZE = 8
const RES = 72
const WATER = 0.0

const water = new THREE.Color(palette.primary)
const low = new THREE.Color(palette.positive)
const rock = new THREE.Color(palette.object)
const snow = new THREE.Color(palette.foreground)

function Scene({ v }: { v: V }) {
  const time = useClock()
  const group = useRef<THREE.Group>(null)

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(SIZE, SIZE, RES, RES)
    g.rotateX(-Math.PI / 2)
    g.setAttribute(
      "color",
      new THREE.BufferAttribute(
        new Float32Array(g.attributes.position.count * 3),
        3
      )
    )
    return g
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])

  useEffect(() => {
    const noise = createNoise2D(v.seed)
    const pos = geometry.attributes.position as THREE.BufferAttribute
    const col = geometry.attributes.color as THREE.BufferAttribute
    const c = new THREE.Color()
    // Fixed offset keeps samples off integer lattice points.
    const f = v.frequency / SIZE
    for (let i = 0; i < pos.count; i++) {
      const n = fbm2D(noise, pos.getX(i) * f + 0.37, pos.getZ(i) * f + 0.71, {
        octaves: v.octaves,
      })
      const h = Math.max(n, WATER)
      pos.setY(i, h * v.height)
      if (n <= WATER) c.copy(water).multiplyScalar(0.55 + 0.45 * (1 + n))
      else if (n < 0.28) c.copy(low).lerp(rock, n / 0.28)
      else c.copy(rock).lerp(snow, Math.min(1, (n - 0.28) / 0.22))
      col.setXYZ(i, c.r, c.g, c.b)
    }
    pos.needsUpdate = true
    col.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
  }, [geometry, v.seed, v.octaves, v.frequency, v.height])

  useFrame(() => {
    if (group.current) group.current.rotation.y = time.current * 0.08
  })

  return (
    <group ref={group}>
      <mesh geometry={geometry}>
        <meshStandardMaterial vertexColors roughness={0.9} flatShading />
      </mesh>
    </group>
  )
}

export default defineVisual<V>({
  gridY: 0,
  camera: { position: [0, 8, 9.8], target: [0, 0.3, 0] },
  params: [
    { key: "seed", label: "Seed", min: 1, max: 999, step: 1, value: 42 },
    { key: "octaves", label: "Octaves", min: 1, max: 8, step: 1, value: 5 },
    {
      key: "frequency",
      label: "Base frequency",
      min: 1,
      max: 8,
      step: 0.1,
      value: 3,
      digits: 1,
    },
    {
      key: "height",
      label: "Height scale",
      min: 0.5,
      max: 4,
      step: 0.1,
      value: 2.2,
      unit: "u",
      digits: 1,
    },
  ],
  readout: (v) => {
    const r = mulberry32(v.seed)
    return `seed ${v.seed} → mulberry32: ${[r(), r(), r()].map((x) => x.toFixed(4)).join(", ")} … (always)`
  },
  Scene,
})
