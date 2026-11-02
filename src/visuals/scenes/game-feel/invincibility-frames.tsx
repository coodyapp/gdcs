import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { defineVisual, palette, useVisual } from "../../kit"
import { blinkVisible, tryHit } from "@/lib/game-feel"

type V = { iframes: number; interval: number; blink: boolean }

const PLAYER_X = -2.5
const SPAWN_X = 5
const SPEED = 7
const POOL = 16
const MAX_HP = 5

interface Shot {
  x: number
  active: boolean
  ignored: boolean
  y: number
}

function Scene({ v }: { v: V }) {
  const { playing, resetKey } = useVisual()
  const player = useRef<THREE.Mesh>(null)
  const playerMat = useRef<THREE.MeshStandardMaterial>(null)
  const timerBar = useRef<THREE.Mesh>(null)
  const shotRefs = useRef<(THREE.Mesh | null)[]>([])
  const pipMats = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  const sim = useRef({
    spawn: 0,
    inv: 0,
    hp: MAX_HP,
    flash: 0,
    refill: 0,
    n: 0,
  })
  const shots = useMemo<Shot[]>(
    () =>
      Array.from({ length: POOL }, () => ({
        x: SPAWN_X,
        active: false,
        ignored: false,
        y: 0,
      })),
    []
  )
  const color = useMemo(() => new THREE.Color(), [])

  useEffect(() => {
    sim.current = { spawn: 0, inv: 0, hp: MAX_HP, flash: 0, refill: 0, n: 0 }
    shots.forEach((s) => (s.active = false))
  }, [resetKey, v.iframes, v.interval, shots])

  useFrame((_, delta) => {
    const s = sim.current
    if (playing) {
      const dt = Math.min(delta, 0.1)
      s.inv = Math.max(0, s.inv - dt)
      s.flash = Math.max(0, s.flash - dt)
      if (s.refill > 0) {
        s.refill -= dt
        if (s.refill <= 0) s.hp = MAX_HP
      }
      s.spawn -= dt
      if (s.spawn <= 0) {
        s.spawn += v.interval
        const shot = shots.find((x) => !x.active)
        if (shot) {
          shot.active = true
          shot.ignored = false
          shot.x = SPAWN_X
          shot.y = 0.15 * Math.sin(s.n++ * 2.3)
        }
      }
      for (const shot of shots) {
        if (!shot.active) continue
        const before = shot.x
        shot.x -= SPEED * dt
        if (
          before > PLAYER_X + 0.35 &&
          shot.x <= PLAYER_X + 0.35 &&
          !shot.ignored
        ) {
          const r = tryHit(s.inv, v.iframes)
          s.inv = r.remaining
          if (r.hit && s.hp > 0) {
            shot.active = false
            s.hp--
            s.flash = 0.12
            if (s.hp === 0) s.refill = 0.8
          } else {
            shot.ignored = true // passes straight through
          }
        }
        if (shot.x < -6.5) shot.active = false
      }
    }
    shots.forEach((shot, i) => {
      const m = shotRefs.current[i]
      if (!m) return
      m.visible = shot.active
      m.position.set(shot.x, shot.y, 0)
      const mat = m.material as THREE.MeshBasicMaterial
      mat.color.set(shot.ignored ? palette.guide : palette.moving)
      // Ignored shots also become outlines: they pass through.
      mat.wireframe = shot.ignored
    })
    if (playerMat.current) {
      const visible = !v.blink || blinkVisible(s.inv, 8)
      color.set(
        s.flash > 0
          ? palette.error
          : s.inv > 0
            ? palette.tertiary
            : palette.subject
      )
      playerMat.current.color.copy(color)
      playerMat.current.emissive.copy(color)
      playerMat.current.opacity = visible ? 1 : 0.12
    }
    if (timerBar.current) {
      const w = v.iframes > 0 ? (s.inv / v.iframes) * 1.6 : 0
      timerBar.current.visible = w > 0.001
      timerBar.current.scale.x = Math.max(0.001, w)
      timerBar.current.position.x = PLAYER_X - 0.8 + w / 2
    }
    pipMats.current.forEach((m, i) =>
      m?.color.set(i < s.hp ? palette.success : palette.surface)
    )
    player.current?.position.set(PLAYER_X, 0, 0)
  })

  return (
    <group>
      <mesh position={[0, -0.7, 0]}>
        <boxGeometry args={[12, 0.1, 1.4]} />
        <meshStandardMaterial color={palette.surface} />
      </mesh>
      <mesh ref={player} position={[PLAYER_X, 0, 0]}>
        <boxGeometry args={[0.7, 1.2, 0.7]} />
        <meshStandardMaterial
          ref={playerMat}
          color={palette.subject}
          emissiveIntensity={0.3}
          transparent
        />
      </mesh>
      {/* Invulnerability timer, drains to zero. */}
      <mesh position={[PLAYER_X, 1.05, 0]}>
        <boxGeometry args={[1.64, 0.18, 0.05]} />
        <meshBasicMaterial color={palette.surface} />
      </mesh>
      <mesh ref={timerBar} position={[PLAYER_X, 1.05, 0.03]}>
        <boxGeometry args={[1, 0.14, 0.05]} />
        <meshBasicMaterial color={palette.tertiary} />
      </mesh>
      {Array.from({ length: MAX_HP }, (_, i) => (
        <mesh key={i} position={[PLAYER_X - 0.72 + i * 0.36, 1.45, 0]}>
          <boxGeometry args={[0.26, 0.2, 0.05]} />
          <meshBasicMaterial
            ref={(m) => void (pipMats.current[i] = m)}
            color={palette.success}
          />
        </mesh>
      ))}
      {shots.map((_, i) => (
        <mesh
          key={i}
          ref={(m) => void (shotRefs.current[i] = m)}
          visible={false}
        >
          <sphereGeometry args={[0.16, 16, 12]} />
          <meshBasicMaterial color={palette.moving} />
        </mesh>
      ))}
    </group>
  )
}

export default defineVisual<V>({
  camera: { position: [-0.5, 0.5, 6.2], target: [-0.5, 0.4, 0] },
  grid: false,
  params: [
    {
      key: "iframes",
      label: "I-frame window",
      min: 0,
      max: 1.5,
      step: 0.05,
      value: 0.8,
      unit: "s",
      digits: 2,
    },
    {
      key: "interval",
      label: "Time between shots",
      min: 0.15,
      max: 1,
      step: 0.05,
      value: 0.25,
      unit: "s",
      digits: 2,
    },
    {
      key: "blink",
      label: "Blink while invulnerable",
      type: "toggle",
      value: true,
    },
  ],
  readout: (v) => {
    const per = v.iframes > 0 ? Math.ceil(v.iframes / v.interval + 1e-9) : 1
    return `${v.iframes.toFixed(2)} s ≈ ${Math.round(v.iframes * 60)} frames · about 1 in ${per} shots can hurt`
  },
  Scene,
})
