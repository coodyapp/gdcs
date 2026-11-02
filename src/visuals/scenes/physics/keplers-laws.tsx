import { useEffect, useMemo, useRef, type ComponentRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import { solveKepler } from "@/lib/physics/mechanics-labs"

import { defineVisual, palette, useFixedStep, useVisual } from "../../kit"

type V = { eccentricity: number; rate: number }

const TAU = Math.PI * 2
const A = 4
const SECTORS = 8
/** Velocity arrow length per unit speed. */
const V_SCALE = 0.5

type LineRef = ComponentRef<typeof Line>

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const e = v.eccentricity
  const b = A * Math.sqrt(1 - e * e)
  const focus = A * e
  const meanAnomaly = useRef(0)
  const planet = useRef<THREE.Mesh>(null)
  const materials = useRef<(THREE.MeshBasicMaterial | null)[]>([])

  useEffect(() => {
    meanAnomaly.current = 0
  }, [resetKey])

  useFixedStep((dt) => {
    meanAnomaly.current = (meanAnomaly.current + dt * v.rate) % TAU
  }, 120)

  const orbit = useMemo(
    () =>
      Array.from({ length: 129 }, (_, i) => {
        const E = (i / 128) * TAU
        return [A * Math.cos(E), 0, b * Math.sin(E)] as [number, number, number]
      }),
    [b]
  )

  // Each wedge spans 1/8 of the period, so all eight have equal area.
  const sectors = useMemo(
    () =>
      Array.from({ length: SECTORS }, (_, sector) => {
        const pos: number[] = []
        const sub = 12
        for (let j = 0; j < sub; j++) {
          const E1 = solveKepler(((sector + j / sub) / SECTORS) * TAU, e)
          const E2 = solveKepler(((sector + (j + 1) / sub) / SECTORS) * TAU, e)
          pos.push(focus, 0.01, 0)
          pos.push(A * Math.cos(E1), 0.01, b * Math.sin(E1))
          pos.push(A * Math.cos(E2), 0.01, b * Math.sin(E2))
        }
        const g = new THREE.BufferGeometry()
        g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
        return g
      }),
    [b, e, focus]
  )
  useEffect(() => () => sectors.forEach((g) => g.dispose()), [sectors])

  const velocity = useRef<LineRef>(null)
  const radius = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(6), 3)
    )
    return new THREE.Line(
      g,
      new THREE.LineBasicMaterial({ color: palette.foreground })
    )
  }, [])

  useFrame(() => {
    const M = meanAnomaly.current
    const E = solveKepler(M, e)
    const x = A * Math.cos(E)
    const z = b * Math.sin(E)
    planet.current?.position.set(x, 0.2, z)
    // dE/dt = n / (1 − e cos E); n is the mean motion (here `rate`).
    const dE = 1 / (1 - e * Math.cos(E))
    const vx = -A * Math.sin(E) * dE
    const vz = b * Math.cos(E) * dE
    // Dashed velocity line: rewrite its one segment and dash distance in place.
    const vel = velocity.current
    if (vel) {
      const attrs = vel.geometry.attributes
      const seg = attrs.instanceStart as THREE.InterleavedBufferAttribute
      const s = seg.data.array as Float32Array
      s[0] = x
      s[1] = 0.2
      s[2] = z
      s[3] = x + vx * V_SCALE
      s[4] = 0.2
      s[5] = z + vz * V_SCALE
      seg.data.needsUpdate = true
      const dist =
        attrs.instanceDistanceStart as THREE.InterleavedBufferAttribute
      const d = dist.data.array as Float32Array
      d[0] = 0
      d[1] = Math.hypot(vx, vz) * V_SCALE
      dist.data.needsUpdate = true
    }
    const rp = radius.geometry.getAttribute("position") as THREE.BufferAttribute
    rp.setXYZ(0, focus, 0.02, 0)
    rp.setXYZ(1, x, 0.02, z)
    rp.needsUpdate = true
    const current = Math.floor((M / TAU) * SECTORS) % SECTORS
    materials.current.forEach((m, i) => {
      if (m) m.opacity = i === current ? 0.55 : 0.16
    })
  })

  return (
    <>
      <Line points={orbit} color={palette.guide} lineWidth={2} />
      {sectors.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshBasicMaterial
            ref={(m) => {
              materials.current[i] = m
            }}
            color={i % 2 ? palette.tertiary : palette.subject}
            transparent
            opacity={0.16}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      <mesh position={[focus, 0.2, 0]}>
        <sphereGeometry args={[0.36, 32, 32]} />
        <meshStandardMaterial
          color={palette.foreground}
          emissive={palette.foreground}
          emissiveIntensity={0.6}
        />
      </mesh>
      <mesh position={[-focus, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.06, 0.12, 24]} />
        <meshBasicMaterial color={palette.guide} />
      </mesh>
      <mesh ref={planet}>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshStandardMaterial
          color={palette.moving}
          emissive={palette.moving}
          emissiveIntensity={0.3}
        />
      </mesh>
      <primitive object={radius} />
      <Line
        ref={velocity}
        points={[
          [0, 0.2, 0],
          [0, 0.2, 0],
        ]}
        color={palette.velocity}
        lineWidth={2.5}
        dashed
        dashSize={0.12}
        gapSize={0.08}
        frustumCulled={false}
      />
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 9, 4.2], target: [0, 0, 0.2] },
  params: [
    {
      key: "eccentricity",
      label: "Eccentricity e",
      min: 0,
      max: 0.85,
      step: 0.01,
      value: 0.5,
      digits: 2,
    },
    {
      key: "rate",
      label: "Orbital rate",
      min: 0.1,
      max: 2,
      step: 0.1,
      value: 0.8,
      unit: "rad/s",
    },
  ],
  readout: (v) => {
    const e = v.eccentricity
    return `Period ${(TAU / v.rate).toFixed(2)} s · perihelion/aphelion speed ${((1 + e) / (1 - e)).toFixed(2)}× · distance ${(A * (1 - e)).toFixed(2)}–${(A * (1 + e)).toFixed(2)} u`
  },
  Scene,
})
