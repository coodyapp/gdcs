import { useEffect, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import { defineVisual, palette, useVisual, type Vec3 } from "../../kit"
import {
  addTrauma,
  decayTrauma,
  shakeAmount,
  smoothNoise,
} from "@/lib/game-feel"

type V = { perHit: number; decay: number; squared: boolean; noise: string }

const MAX_OFFSET = 0.6
const MAX_ROLL = 0.08
const NOISE_HZ = 14
const CYCLE = 2.6
const HITS = [0.2, 0.45, 1.5]
const METER_X = 3.85
const METER_H = 3

const FRAME: Vec3[] = [
  [-4.3, -0.6, 1.6],
  [3.2, -0.6, 1.6],
  [3.2, 3.4, 1.6],
  [-4.3, 3.4, 1.6],
  [-4.3, -0.6, 1.6],
]

function jaggedNoise(x: number, seed: number) {
  const s = Math.sin(Math.floor(x) * 91.7 + seed * 13.1) * 43758.5453
  return (s - Math.floor(s)) * 2 - 1
}

const PROPS: { pos: Vec3; size: Vec3 }[] = [
  { pos: [-3, 0.6, -1.2], size: [1, 1.2, 1] },
  { pos: [-1.8, 1, -2.2], size: [0.8, 2, 0.8] },
  { pos: [1.7, 0.45, -1.6], size: [1.2, 0.9, 1] },
  { pos: [0, 1.3, -2.8], size: [1, 2.6, 0.8] },
]

function Scene({ v }: { v: V }) {
  const { playing, resetKey } = useVisual()
  const world = useRef<THREE.Group>(null)
  const playerMat = useRef<THREE.MeshStandardMaterial>(null)
  const ring = useRef<THREE.Mesh>(null)
  const traumaBar = useRef<THREE.Mesh>(null)
  const shakeBar = useRef<THREE.Mesh>(null)
  const sim = useRef({ t: 0, trauma: 0, sinceHit: 9 })

  useEffect(() => {
    sim.current = { t: 0, trauma: 0, sinceHit: 9 }
  }, [resetKey, v.perHit, v.decay])

  useFrame((_, delta) => {
    const s = sim.current
    if (playing) {
      const dt = Math.min(delta, 0.1)
      const before = s.t % CYCLE
      s.t += dt
      const after = s.t % CYCLE
      s.trauma = decayTrauma(s.trauma, v.decay, dt)
      for (const h of HITS) {
        const crossed =
          after >= before ? before < h && after >= h : before < h || after >= h
        if (crossed) {
          s.trauma = addTrauma(s.trauma, v.perHit)
          s.sinceHit = 0
        }
      }
      s.sinceHit += dt
    }
    const shake = shakeAmount(s.trauma, v.squared ? 2 : 1)
    const n = v.noise === "smooth" ? smoothNoise : jaggedNoise
    const x = s.t * NOISE_HZ
    if (world.current) {
      world.current.position.set(
        MAX_OFFSET * shake * n(x, 1),
        MAX_OFFSET * shake * n(x, 2),
        0
      )
      world.current.rotation.z = MAX_ROLL * shake * n(x, 3)
    }
    const flash = s.sinceHit < 0.1
    playerMat.current?.color.set(flash ? palette.error : palette.subject)
    if (ring.current) {
      ring.current.visible = s.sinceHit < 0.25
      ring.current.scale.setScalar(0.4 + s.sinceHit * 6)
    }
    if (traumaBar.current) {
      const h = Math.max(0.001, s.trauma * METER_H)
      traumaBar.current.scale.y = h
      traumaBar.current.position.y = -0.5 + h / 2
    }
    if (shakeBar.current) {
      const h = Math.max(0.001, shake * METER_H)
      shakeBar.current.scale.y = h
      shakeBar.current.position.y = -0.5 + h / 2
    }
  })

  return (
    <>
      <group ref={world}>
        <mesh position={[-0.55, -0.05, -1]}>
          <boxGeometry args={[7, 0.1, 5]} />
          <meshStandardMaterial color={palette.surface} />
        </mesh>
        {PROPS.map((p, i) => (
          <mesh key={i} position={p.pos}>
            <boxGeometry args={p.size} />
            <meshStandardMaterial color={palette.object} />
          </mesh>
        ))}
        <mesh position={[-0.6, 0.45, 0]}>
          <boxGeometry args={[0.7, 0.9, 0.7]} />
          <meshStandardMaterial
            ref={playerMat}
            color={palette.subject}
            emissive={palette.subject}
            emissiveIntensity={0.25}
          />
        </mesh>
        <mesh ref={ring} position={[-0.6, 0.45, 0.4]} visible={false}>
          <torusGeometry args={[0.5, 0.05, 8, 32]} />
          <meshBasicMaterial color={palette.energy} />
        </mesh>
      </group>
      {/* Static screen frame and trauma meter: these do not shake. */}
      <Line
        points={FRAME}
        color={palette.guide}
        lineWidth={1.5}
        dashed
        dashSize={0.2}
        gapSize={0.12}
      />
      <mesh position={[METER_X + 0.2, -0.5 + METER_H / 2, 1.6]}>
        <boxGeometry args={[0.9, METER_H + 0.06, 0.02]} />
        <meshBasicMaterial color="#18181b" />
      </mesh>
      <mesh position={[METER_X + 0.2, -0.5 + METER_H, 1.63]}>
        <boxGeometry args={[0.9, 0.03, 0.02]} />
        <meshBasicMaterial color={palette.guide} />
      </mesh>
      <mesh ref={traumaBar} position={[METER_X, -0.5, 1.62]}>
        <boxGeometry args={[0.3, 1, 0.02]} />
        <meshBasicMaterial color={palette.tertiary} />
      </mesh>
      <mesh ref={shakeBar} position={[METER_X + 0.4, -0.5, 1.62]}>
        <boxGeometry args={[0.3, 1, 0.02]} />
        <meshBasicMaterial color={palette.energy} />
      </mesh>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 2.4, 9.4], target: [0, 1.1, 0] },
  grid: false,
  params: [
    {
      key: "perHit",
      label: "Trauma per hit",
      min: 0.1,
      max: 1,
      step: 0.05,
      value: 0.55,
      digits: 2,
    },
    {
      key: "decay",
      label: "Trauma decay",
      min: 0.3,
      max: 3,
      step: 0.1,
      value: 1,
      unit: "/s",
      digits: 1,
    },
    { key: "squared", label: "Shake = trauma²", type: "toggle", value: true },
    {
      key: "noise",
      label: "Noise",
      type: "select",
      value: "smooth",
      options: [
        { value: "smooth", label: "Smooth noise" },
        { value: "random", label: "Random per sample" },
      ],
    },
  ],
  readout: (v) =>
    `One hit fades in ${(v.perHit / v.decay).toFixed(2)} s · peak shake ${(shakeAmount(Math.min(1, v.perHit), v.squared ? 2 : 1) * 100).toFixed(0)}% from one hit`,
  Scene,
})
