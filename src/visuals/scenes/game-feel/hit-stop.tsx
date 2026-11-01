import { useEffect, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { defineVisual, palette, useVisual } from "../../kit"
import { consumeHitStop } from "@/lib/game-feel"

type V = { duration: number; shake: boolean; speed: number }

const IMPACT = 0.62
const CYCLE = 1.5
const BAR_X = -3.6
const BAR_W = 8.4
const REST_X = -3
const CONTACT_X = -0.55

interface Row {
  game: number
  freeze: number
  triggered: boolean
}

const fresh = (): Row => ({ game: 0, freeze: 0, triggered: false })

/** Attacker x and target knockback for a given game time. */
function pose(g: number) {
  let attacker = REST_X
  if (g < 0.5) attacker = REST_X - 0.35 * Math.sin((g / 0.5) * Math.PI * 0.5)
  else if (g < IMPACT) {
    const u = (g - 0.5) / (IMPACT - 0.5)
    attacker = REST_X - 0.35 + (CONTACT_X + 0.35 - REST_X) * u * u
  } else {
    const u = Math.min(1, (g - IMPACT) / 0.7)
    attacker = CONTACT_X + (REST_X - CONTACT_X) * (1 - (1 - u) * (1 - u))
  }
  const knock = g < IMPACT ? 0 : 2.2 * (1 - Math.exp(-7 * (g - IMPACT)))
  return { attacker, knock }
}

function HitRow({ y, stop, v }: { y: number; stop: boolean; v: V }) {
  const { playing, resetKey } = useVisual()
  const attacker = useRef<THREE.Mesh>(null)
  const target = useRef<THREE.Mesh>(null)
  const targetMat = useRef<THREE.MeshStandardMaterial>(null)
  const spark = useRef<THREE.Mesh>(null)
  const bar = useRef<THREE.Mesh>(null)
  const row = useRef<Row>(fresh())
  const realT = useRef(0)

  useEffect(() => {
    row.current = fresh()
    realT.current = 0
  }, [resetKey, v.duration])

  useFrame((state, delta) => {
    const r = row.current
    if (playing) {
      const dt = Math.min(delta, 0.1) * v.speed
      realT.current += dt
      const step = consumeHitStop(r.freeze, dt)
      r.freeze = step.remaining
      r.game = Math.min(CYCLE, r.game + step.gameDt)
      if (!r.triggered && r.game >= IMPACT) {
        r.triggered = true
        r.game = IMPACT
        if (stop) r.freeze = v.duration / 1000
      }
      // Both rows restart together on the same real-time cycle.
      if (realT.current >= CYCLE + v.duration / 1000 + 0.2) {
        row.current = fresh()
        realT.current = 0
      }
    }
    const { attacker: ax, knock } = pose(r.game)
    const frozen = r.freeze > 0
    const jitter =
      frozen && v.shake ? Math.sin(state.clock.elapsedTime * 120) * 0.07 : 0
    attacker.current?.position.set(ax, y, 0)
    target.current?.position.set(knock + jitter, y, 0)
    if (target.current) target.current.rotation.z = -knock * 0.25
    const sinceHit = r.game - IMPACT
    const flash = frozen || (r.triggered && sinceHit < 0.08)
    targetMat.current?.color.set(flash ? palette.secondary : palette.object)
    targetMat.current?.emissive.set(flash ? palette.secondary : "#000000")
    if (bar.current) {
      const w = Math.max(0.001, (r.game / CYCLE) * BAR_W)
      bar.current.scale.x = w
      bar.current.position.x = BAR_X + w / 2
    }
    if (spark.current) {
      spark.current.visible = flash
      const s = frozen
        ? 0.5 + 0.4 * (1 - r.freeze / Math.max(0.001, v.duration / 1000))
        : 0.5
      spark.current.scale.setScalar(s)
      spark.current.position.set(-0.3, y, 0.4)
    }
  })

  return (
    <group>
      <mesh position={[0.6, y - 0.42, 0]}>
        <boxGeometry args={[8.4, 0.12, 1]} />
        <meshStandardMaterial color={palette.surface} />
      </mesh>
      {/* Game-time progress: the frozen row falls behind. */}
      <mesh ref={bar} position={[BAR_X, y - 0.62, 0]}>
        <boxGeometry args={[1, 0.1, 0.1]} />
        <meshBasicMaterial color={stop ? palette.positive : palette.guide} />
      </mesh>
      <mesh position={[-4.6, y, 0]}>
        <boxGeometry args={[0.12, 0.8, 0.12]} />
        <meshBasicMaterial color={stop ? palette.positive : palette.guide} />
      </mesh>
      <mesh ref={attacker} position={[REST_X, y, 0]}>
        <boxGeometry args={[0.5, 0.7, 0.5]} />
        <meshStandardMaterial
          color={palette.primary}
          emissive={palette.primary}
          emissiveIntensity={0.25}
        />
      </mesh>
      <mesh ref={target} position={[0, y, 0]}>
        <boxGeometry args={[0.6, 0.7, 0.6]} />
        <meshStandardMaterial
          ref={targetMat}
          color={palette.object}
          emissiveIntensity={0.6}
        />
      </mesh>
      <mesh ref={spark} visible={false}>
        <octahedronGeometry args={[0.6, 0]} />
        <meshBasicMaterial color={palette.warning} transparent opacity={0.85} />
      </mesh>
    </group>
  )
}

function Scene({ v }: { v: V }) {
  return (
    <>
      <HitRow y={1.1} stop v={v} />
      <HitRow y={-1.1} stop={false} v={v} />
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 0.2, 9], target: [0, 0, 0] },
  grid: false,
  params: [
    {
      key: "duration",
      label: "Hit-stop duration",
      min: 0,
      max: 300,
      step: 10,
      value: 140,
      unit: "ms",
    },
    {
      key: "shake",
      label: "Shake target while frozen",
      type: "toggle",
      value: true,
    },
    {
      key: "speed",
      label: "Playback speed",
      min: 0.25,
      max: 1,
      step: 0.05,
      value: 1,
      unit: "×",
    },
  ],
  readout: (v) =>
    `Freeze ${v.duration} ms ≈ ${Math.round(v.duration / (1000 / 60))} frames at 60 fps`,
  Scene,
})
