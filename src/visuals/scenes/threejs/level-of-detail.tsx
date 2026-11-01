import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import { selectLod } from "@/lib/lod"

import { defineVisual, palette, useClock } from "../../kit"

type V = { hysteresis: number; near: number; speed: number }

const DETAIL = [5, 2, 0] // icosahedron subdivisions per level
const TRIS = DETAIL.map((d) => 20 * (d + 1) ** 2)
const COLORS = [palette.primary, palette.tertiary, palette.object]
const SPACING = 1.9
const SPHERES: [number, number, number][] = []
for (let ix = -2; ix <= 2; ix++)
  for (const z of [-2.1, 0.7]) SPHERES.push([ix * SPACING, 0.45, z])
const VIEW_Z = -0.7
const BAR_MAX = 3
const MAX_TRIS = SPHERES.length * TRIS[0]

const circle = (r: number) => {
  const pts: [number, number, number][] = []
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2
    pts.push([Math.cos(a) * r, 0.02, Math.sin(a) * r])
  }
  return pts
}

function Scene({ v }: { v: V }) {
  const time = useClock()
  const viewer = useRef<THREE.Group>(null)
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const bar = useRef<THREE.Mesh>(null)
  const current = useMemo(() => new Int8Array(SPHERES.length), [])
  const switchAt = useMemo(() => [v.near, v.near * 2], [v.near])
  const geos = useMemo(
    () => DETAIL.map((d) => new THREE.IcosahedronGeometry(0.45, d)),
    []
  )
  const rings = useMemo(
    () => ({
      solid: switchAt.map(circle),
      band: switchAt.map((d) => circle(d * (1 - v.hysteresis / 100))),
    }),
    [switchAt, v.hysteresis]
  )

  useFrame(() => {
    if (!viewer.current) return
    const x = Math.sin(time.current * v.speed) * 4.6
    viewer.current.position.set(x, 0, VIEW_Z)
    let total = 0
    SPHERES.forEach(([sx, , sz], i) => {
      const d = Math.hypot(sx - x, sz - VIEW_Z)
      const level = selectLod(d, switchAt, current[i], v.hysteresis / 100)
      current[i] = level
      total += TRIS[level]
      for (let l = 0; l < 3; l++) {
        const m = meshes.current[i * 3 + l]
        if (m) m.visible = l === level
      }
    })
    if (bar.current) {
      const h = Math.max(0.02, (total / MAX_TRIS) * BAR_MAX)
      bar.current.scale.y = h
      bar.current.position.y = h / 2
    }
  })

  return (
    <>
      {SPHERES.map((p, i) => (
        <group key={i} position={p}>
          {geos.map((g, l) => (
            <mesh
              key={l}
              geometry={g}
              visible={l === 0}
              ref={(m) => {
                meshes.current[i * 3 + l] = m
              }}
            >
              <meshStandardMaterial
                color={COLORS[l]}
                flatShading
                roughness={0.6}
              />
            </mesh>
          ))}
        </group>
      ))}
      <group ref={viewer}>
        <mesh position={[0, 0.25, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.2, 0.5, 16]} />
          <meshBasicMaterial color={palette.secondary} />
        </mesh>
        {rings.solid.map((pts, i) => (
          <Line
            key={`s${i}`}
            points={pts}
            color={palette.guide}
            lineWidth={1.5}
          />
        ))}
        {v.hysteresis > 0 &&
          rings.band.map((pts, i) => (
            <Line
              key={`b${i}`}
              points={pts}
              color={palette.warning}
              lineWidth={1}
              dashed
              dashSize={0.15}
              gapSize={0.12}
            />
          ))}
      </group>
      <group position={[5.9, 0, -2.4]}>
        <mesh ref={bar}>
          <boxGeometry args={[0.4, 1, 0.4]} />
          <meshBasicMaterial color={palette.primary} />
        </mesh>
        <mesh position={[0, BAR_MAX / 2, 0]}>
          <boxGeometry args={[0.44, BAR_MAX, 0.44]} />
          <meshBasicMaterial color={palette.guide} wireframe />
        </mesh>
      </group>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 9.5, 7.2], target: [0.4, 0, -0.5] },
  params: [
    {
      key: "hysteresis",
      label: "Hysteresis",
      min: 0,
      max: 30,
      step: 1,
      value: 15,
      unit: "%",
    },
    {
      key: "near",
      label: "First switch distance",
      min: 1.2,
      max: 3,
      step: 0.1,
      value: 2,
      unit: "u",
    },
    {
      key: "speed",
      label: "Viewer speed",
      min: 0,
      max: 1.5,
      step: 0.05,
      value: 0.45,
      digits: 2,
    },
  ],
  readout: (v) =>
    `Tris per sphere ${TRIS.join(" / ")} · switch at ${v.near.toFixed(1)} / ${(v.near * 2).toFixed(1)} u, back at ${(v.near * (1 - v.hysteresis / 100)).toFixed(2)} / ${(v.near * 2 * (1 - v.hysteresis / 100)).toFixed(2)} u · max ${MAX_TRIS.toLocaleString("en-US")}`,
  Scene,
})
