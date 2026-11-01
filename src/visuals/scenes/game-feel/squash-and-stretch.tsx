import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { defineVisual, palette, useClock } from "../../kit"
import { squashScale, stretchScale } from "@/lib/game-feel"

type V = { amount: number; volume: boolean; outline: boolean }

const R = 0.55
const HEIGHT = 2.6
const PERIOD = 0.9
const VX = 2.2
const SPAN = 3.5
const IMPACT = 0.09
const AIR = PERIOD - IMPACT
const MAX_VY = (4 * HEIGHT) / AIR
const K = 0.06

function scaleFor(speed: number, amount: number) {
  return stretchScale(speed, amount * K, 1.9)
}

function Scene({ v }: { v: V }) {
  const time = useClock()
  const ball = useRef<THREE.Mesh>(null)
  const ghost = useRef<THREE.Mesh>(null)
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const dir = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const t = time.current
    const phase = t % PERIOD
    // The ball rests on the floor for IMPACT seconds, then flies a parabola.
    const u = Math.max(0, phase - IMPACT) / AIR
    const y = phase < IMPACT ? 0 : HEIGHT * (1 - (2 * u - 1) ** 2)
    const vy = (-4 * HEIGHT * (2 * u - 1)) / AIR
    // Triangle wave across the floor.
    const travel = (t * VX) % (4 * SPAN)
    const x = travel < 2 * SPAN ? -SPAN + travel : 3 * SPAN - travel
    const vx = travel < 2 * SPAN ? VX : -VX

    let along = 1
    let across = 1
    let centerY = R + y
    if (phase < IMPACT) {
      // Just hit the floor: squash along the vertical, decaying back.
      const s = squashScale(v.amount * 0.55 * (1 - phase / IMPACT))
      along = s.along
      across = s.across
      dir.copy(up)
      centerY = R * along
    } else {
      const s = scaleFor(Math.hypot(vx, vy), v.amount)
      along = s.along
      across = s.across
      dir.set(vx, vy, 0).normalize()
    }
    if (!v.volume) across = 1
    if (ball.current) {
      ball.current.position.set(x, centerY, 0)
      ball.current.quaternion.setFromUnitVectors(up, dir)
      ball.current.scale.set(across, along, across)
    }
    if (ghost.current) {
      ghost.current.visible = v.outline
      ghost.current.position.set(x, R + y, 0)
    }
  })

  return (
    <group>
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[9.5, 0.1, 2]} />
        <meshStandardMaterial color={palette.surface} />
      </mesh>
      <mesh ref={ball}>
        <sphereGeometry args={[R, 32, 24]} />
        <meshStandardMaterial
          color={palette.secondary}
          emissive={palette.secondary}
          emissiveIntensity={0.25}
        />
      </mesh>
      <mesh ref={ghost}>
        <sphereGeometry args={[R, 16, 10]} />
        <meshBasicMaterial
          color={palette.primary}
          wireframe
          transparent
          opacity={0.45}
        />
      </mesh>
    </group>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 1.5, 7.2], target: [0, 1.3, 0] },
  params: [
    {
      key: "amount",
      label: "Squash & stretch",
      min: 0,
      max: 1,
      step: 0.05,
      value: 0.6,
      digits: 2,
    },
    { key: "volume", label: "Preserve volume", type: "toggle", value: true },
    {
      key: "outline",
      label: "Show undeformed ball",
      type: "toggle",
      value: true,
    },
  ],
  readout: (v) => {
    const s = scaleFor(Math.hypot(VX, MAX_VY), v.amount)
    const q = squashScale(v.amount * 0.55)
    return `Fastest frame: ${s.along.toFixed(2)}× long, ${(v.volume ? s.across : 1).toFixed(2)}× wide · impact: ${q.along.toFixed(2)}× tall`
  },
  Scene,
})
