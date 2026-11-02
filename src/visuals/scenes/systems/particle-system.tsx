import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { emitCount, ParticleBuffer } from "@/lib/particles"

import { defineVisual, palette, rad, useFixedStep, useVisual } from "../../kit"

type V = { rate: number; life: number; gravity: number; spread: number }

const CAP = 1500
const EMITTER_Y = 0.25
const SPEED = 6
const SIZE = 0.11

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const buf = useMemo(() => new ParticleBuffer(CAP), [])
  const carry = useRef({ carry: 0 })
  useEffect(() => {
    buf.clear()
    carry.current.carry = 0
  }, [buf, resetKey])

  const mesh = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  // Age reads by size as well as hue: yellow (new, big) → orange → gray (small).
  const young = useMemo(() => new THREE.Color(palette.velocity), [])
  const mid = useMemo(() => new THREE.Color(palette.energy), [])
  const old = useMemo(() => new THREE.Color(palette.surface), [])
  const tmp = useMemo(() => new THREE.Color(), [])

  useFixedStep((dt) => {
    buf.update(dt, v.gravity, 0.25)
    // Cheap ground bounce so particles don't sink through the floor.
    for (let i = 0; i < buf.count; i++) {
      if (buf.py[i] < SIZE * 0.5) {
        buf.py[i] = SIZE * 0.5
        buf.vy[i] *= -0.35
        buf.vx[i] *= 0.7
        buf.vz[i] *= 0.7
      }
    }
    const n = emitCount(carry.current, v.rate, dt)
    const half = rad(v.spread)
    for (let k = 0; k < n; k++) {
      const i = buf.spawn(v.life * (0.75 + 0.5 * Math.random()))
      if (i < 0) break
      const theta = half * Math.sqrt(Math.random())
      const phi = Math.random() * Math.PI * 2
      const s = SPEED * (0.8 + 0.4 * Math.random())
      buf.px[i] = (Math.random() - 0.5) * 0.15
      buf.py[i] = EMITTER_Y
      buf.pz[i] = (Math.random() - 0.5) * 0.15
      buf.vx[i] = Math.sin(theta) * Math.cos(phi) * s
      buf.vy[i] = Math.cos(theta) * s
      buf.vz[i] = Math.sin(theta) * Math.sin(phi) * s
    }
  }, 60)

  useFrame(() => {
    const m = mesh.current
    if (!m) return
    for (let i = 0; i < buf.count; i++) {
      const u = Math.min(1, buf.age[i] / buf.life[i])
      dummy.position.set(buf.px[i], buf.py[i], buf.pz[i])
      dummy.scale.setScalar(1 - 0.75 * u)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      if (u < 0.5) tmp.copy(young).lerp(mid, u * 2)
      else tmp.copy(mid).lerp(old, (u - 0.5) * 2)
      m.setColorAt(i, tmp)
    }
    m.count = buf.count
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  })

  // Spawn cone: apex at the emitter, opening upward.
  const coneH = 1
  const coneR = Math.tan(rad(Math.min(v.spread, 80))) * coneH

  return (
    <>
      <instancedMesh
        ref={mesh}
        args={[undefined, undefined, CAP]}
        frustumCulled={false}
      >
        <icosahedronGeometry args={[SIZE, 0]} />
        <meshBasicMaterial color="#ffffff" />
      </instancedMesh>
      <mesh position={[0, EMITTER_Y + coneH / 2, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[Math.max(coneR, 0.02), coneH, 24, 1, true]} />
        <meshBasicMaterial
          color={palette.subject}
          wireframe
          transparent
          opacity={0.35}
        />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.3, 0.38, 0.2, 24]} />
        <meshStandardMaterial color={palette.subject} />
      </mesh>
    </>
  )
}

export default defineVisual<V>({
  gridY: 0,
  camera: { position: [0, 4.2, 7], target: [0, 1.5, 0] },
  params: [
    {
      key: "rate",
      label: "Emission rate",
      min: 10,
      max: 600,
      step: 10,
      value: 180,
      unit: "/s",
    },
    {
      key: "life",
      label: "Lifetime",
      min: 0.3,
      max: 3,
      step: 0.1,
      value: 1.8,
      unit: "s",
    },
    {
      key: "gravity",
      label: "Gravity",
      min: 0,
      max: 20,
      step: 0.5,
      value: 7,
      unit: "u/s²",
    },
    {
      key: "spread",
      label: "Cone half-angle",
      min: 0,
      max: 60,
      step: 1,
      value: 22,
      unit: "°",
    },
  ],
  readout: (v) =>
    `Steady state ≈ rate × lifetime = ${Math.min(CAP, Math.round(v.rate * v.life))} particles · 1 draw call`,
  Scene,
})
