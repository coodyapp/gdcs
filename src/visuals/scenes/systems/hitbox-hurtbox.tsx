import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { attackPhase, type Box, boxesOverlap, HitRegistry } from "@/lib/hitbox"

import {
  defineVisual,
  lerp,
  palette,
  rad,
  useFixedStep,
  useVisual,
} from "../../kit"

type V = { startup: number; active: number; speed: number; once: boolean }

const PIVOT = new THREE.Vector2(-1.1, 1.45)
const REACH = 1.35 // hitbox centre distance along the blade
const HB = 0.45 // hitbox half size
const RECOVERY = 14
const REST = 24
const HURT: Box = { minX: 0.45, minY: 0.1, maxX: 1.05, maxY: 1.75 }
const MAX_PIPS = 8
const BAR_W = 5

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const fd = useMemo(
    () => ({ startup: v.startup, active: v.active, recovery: RECOVERY }),
    [v.startup, v.active]
  )
  const total = fd.startup + fd.active + fd.recovery + REST
  const sim = useRef({ frame: 0, hits: 0, flash: 0, angle: 0, on: false })
  const registry = useMemo(() => new HitRegistry(), [])
  const hitbox = useMemo<Box>(
    () => ({ minX: 0, minY: 0, maxX: 0, maxY: 0 }),
    []
  )
  useEffect(() => {
    sim.current = { frame: 0, hits: 0, flash: 0, angle: 0, on: false }
  }, [resetKey, total])

  // One fixed step = one game frame (60 fps), slowed down by `speed`.
  useFixedStep(() => {
    const s = sim.current
    s.frame = (s.frame + 1) % total
    s.flash = Math.max(0, s.flash - 1)
    if (s.frame === 0) {
      registry.begin()
      s.hits = 0
    }
    const phase = attackPhase(s.frame, fd)
    if (phase === "startup") s.angle = lerp(0, -35, (s.frame + 1) / fd.startup)
    else if (phase === "active")
      s.angle = lerp(30, 150, (s.frame - fd.startup + 0.5) / fd.active)
    else if (phase === "recovery")
      s.angle = lerp(150, 0, (s.frame - fd.startup - fd.active) / fd.recovery)
    else s.angle = 0
    s.on = phase === "active"
    const a = rad(s.angle)
    const cx = PIVOT.x + Math.sin(a) * REACH
    const cy = PIVOT.y + Math.cos(a) * REACH
    hitbox.minX = cx - HB
    hitbox.maxX = cx + HB
    hitbox.minY = cy - HB
    hitbox.maxY = cy + HB
    if (s.on && boxesOverlap(hitbox, HURT) && (!v.once || registry.tryHit(1))) {
      s.hits++
      s.flash = 8
    }
  }, 60 * v.speed)

  const arm = useRef<THREE.Group>(null)
  const hbOff = useRef<THREE.LineSegments>(null)
  const hbOn = useRef<THREE.Mesh>(null)
  const hurtMat = useRef<THREE.LineBasicMaterial>(null)
  const pips = useRef<THREE.InstancedMesh>(null)
  const marker = useRef<THREE.Mesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const hbEdges = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(HB * 2, HB * 2, 0.6)),
    []
  )
  const hurtEdges = useMemo(
    () =>
      new THREE.EdgesGeometry(
        new THREE.BoxGeometry(
          HURT.maxX - HURT.minX,
          HURT.maxY - HURT.minY,
          0.62
        )
      ),
    []
  )
  const green = useMemo(() => new THREE.Color(palette.positive), [])
  const orange = useMemo(() => new THREE.Color(palette.secondary), [])

  useFrame(() => {
    const s = sim.current
    if (arm.current) arm.current.rotation.z = -rad(s.angle)
    const cx = (hitbox.minX + hitbox.maxX) / 2
    const cy = (hitbox.minY + hitbox.maxY) / 2
    for (const m of [hbOff.current, hbOn.current]) m?.position.set(cx, cy, 0)
    if (hbOff.current) hbOff.current.visible = !s.on
    if (hbOn.current) hbOn.current.visible = s.on
    hurtMat.current?.color.copy(s.flash > 0 ? orange : green)
    if (pips.current) {
      for (let i = 0; i < MAX_PIPS; i++) {
        dummy.position.set(0.75 + (i - (MAX_PIPS - 1) / 2) * 0.22, 2.15, 0)
        dummy.scale.setScalar(i < s.hits ? 1 : 0)
        dummy.updateMatrix()
        pips.current.setMatrixAt(i, dummy.matrix)
      }
      pips.current.instanceMatrix.needsUpdate = true
    }
    marker.current?.position.set(
      -BAR_W / 2 + (s.frame / total) * BAR_W,
      0.12,
      1.3
    )
  })

  // Frame-data timeline under the fighters.
  const seg = (from: number, n: number) => ({
    x: -BAR_W / 2 + ((from + n / 2) / total) * BAR_W,
    w: (n / total) * BAR_W,
  })
  const bars = [
    { ...seg(0, fd.startup), color: palette.guide },
    { ...seg(fd.startup, fd.active), color: palette.negative },
    { ...seg(fd.startup + fd.active, fd.recovery), color: palette.tertiary },
    {
      ...seg(fd.startup + fd.active + fd.recovery, REST),
      color: palette.surface,
    },
  ]

  return (
    <>
      {/* Attacker */}
      <mesh position={[-1.45, 0.8, 0]}>
        <boxGeometry args={[0.7, 1.6, 0.5]} />
        <meshStandardMaterial color={palette.primary} />
      </mesh>
      <group ref={arm} position={[PIVOT.x, PIVOT.y, 0.32]}>
        <mesh position={[0, 0.8, 0]}>
          <boxGeometry args={[0.1, 1.6, 0.06]} />
          <meshStandardMaterial color={palette.foreground} />
        </mesh>
      </group>
      <lineSegments ref={hbOff} geometry={hbEdges}>
        <lineBasicMaterial color={palette.guide} />
      </lineSegments>
      <mesh ref={hbOn}>
        <boxGeometry args={[HB * 2, HB * 2, 0.6]} />
        <meshBasicMaterial
          color={palette.negative}
          transparent
          opacity={0.55}
        />
      </mesh>
      {/* Defender + hurtbox */}
      <mesh position={[0.75, 0.85, -0.1]}>
        <boxGeometry args={[0.7, 1.7, 0.5]} />
        <meshStandardMaterial color={palette.object} />
      </mesh>
      <lineSegments
        geometry={hurtEdges}
        position={[(HURT.minX + HURT.maxX) / 2, (HURT.minY + HURT.maxY) / 2, 0]}
      >
        <lineBasicMaterial ref={hurtMat} color={palette.positive} />
      </lineSegments>
      <instancedMesh ref={pips} args={[undefined, undefined, MAX_PIPS]}>
        <sphereGeometry args={[0.08, 12, 8]} />
        <meshBasicMaterial color={palette.secondary} />
      </instancedMesh>
      {bars.map((b, i) => (
        <mesh key={i} position={[b.x, 0.04, 1.3]}>
          <boxGeometry args={[Math.max(0.001, b.w - 0.03), 0.06, 0.22]} />
          <meshBasicMaterial color={b.color} />
        </mesh>
      ))}
      <mesh ref={marker}>
        <boxGeometry args={[0.05, 0.16, 0.34]} />
        <meshBasicMaterial color={palette.foreground} />
      </mesh>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 2.6, 6.2], target: [-0.2, 1.05, 0] },
  params: [
    {
      key: "startup",
      label: "Startup frames",
      min: 2,
      max: 20,
      step: 1,
      value: 8,
    },
    {
      key: "active",
      label: "Active frames",
      min: 1,
      max: 8,
      step: 1,
      value: 4,
    },
    {
      key: "speed",
      label: "Playback speed",
      min: 0.1,
      max: 1,
      step: 0.05,
      value: 0.3,
      unit: "×",
      digits: 2,
    },
    { key: "once", label: "One hit per swing", type: "toggle", value: true },
  ],
  readout: (v) =>
    `Frames: ${v.startup} startup · ${v.active} active · ${RECOVERY} recovery (${((v.startup + v.active + RECOVERY) / 60).toFixed(2)} s at 60 fps)`,
  Scene,
})
