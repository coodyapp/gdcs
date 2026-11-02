import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { Pool } from "@/lib/pool"

import { defineVisual, palette, useFixedStep, useVisual } from "../../kit"

type V = { rate: number; size: number; policy: string }

const MAX = 24
const LIFE = 1.5
const SPEED = 6
const TURRET = new THREE.Vector3(-4.2, 0.45, 0)
const SLOT_Z = 2.5
const SLOT_GAP = 0.38

interface Shot {
  x: number
  z: number
  vx: number
  vz: number
  born: number
}

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const pool = useMemo(
    () => new Pool<Shot>(() => ({ x: 0, z: 0, vx: 0, vz: 0, born: 0 }), v.size),
    [v.size]
  )
  const state = useRef({ t: 0, fireAcc: 0, dropAt: -10, aim: 0 })
  useEffect(() => {
    for (let i = 0; i < pool.capacity; i++) pool.release(i)
    state.current = { t: 0, fireAcc: 0, dropAt: -10, aim: 0 }
  }, [pool, resetKey])

  const shots = useRef<THREE.InstancedMesh>(null)
  const slots = useRef<THREE.InstancedMesh>(null)
  const barrel = useRef<THREE.Group>(null)
  const flash = useRef<THREE.MeshStandardMaterial>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  // In use = orange full cube (matches its live projectile); free = green
  // flat tile. Height is the non-hue cue.
  const cActive = useMemo(() => new THREE.Color(palette.moving), [])
  const cFree = useMemo(() => new THREE.Color(palette.success), [])

  useFixedStep((dt) => {
    const s = state.current
    s.t += dt
    s.aim = Math.sin(s.t * 1.4) * 0.3
    // Retire expired shots first so their slots can be reused this tick.
    for (let i = 0; i < pool.capacity; i++) {
      if (!pool.active[i]) continue
      const p = pool.items[i]
      p.x += p.vx * dt
      p.z += p.vz * dt
      if (s.t - p.born >= LIFE) pool.release(i)
    }
    s.fireAcc += v.rate * dt
    while (s.fireAcc >= 1) {
      s.fireAcc -= 1
      let i = pool.acquire()
      if (i < 0 && v.policy === "recycle") {
        let oldest = 0
        for (let k = 1; k < pool.capacity; k++)
          if (pool.items[k].born < pool.items[oldest].born) oldest = k
        pool.release(oldest)
        i = pool.acquire()
      }
      if (i < 0) {
        s.dropAt = s.t
        continue
      }
      const p = pool.items[i]
      p.x = TURRET.x + Math.cos(s.aim) * 0.7
      p.z = TURRET.z + Math.sin(s.aim) * 0.7
      p.vx = Math.cos(s.aim) * SPEED
      p.vz = Math.sin(s.aim) * SPEED
      p.born = s.t
    }
  }, 60)

  useFrame(() => {
    const s = state.current
    if (barrel.current) barrel.current.rotation.y = -s.aim
    if (flash.current)
      flash.current.emissiveIntensity = s.t - s.dropAt < 0.15 ? 1.4 : 0
    const m = shots.current
    const sl = slots.current
    if (!m || !sl) return
    for (let i = 0; i < MAX; i++) {
      const live = i < pool.capacity && pool.active[i]
      if (live) {
        const p = pool.items[i]
        dummy.position.set(p.x, TURRET.y, p.z)
        dummy.scale.setScalar(1)
      } else dummy.scale.setScalar(0)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)

      const x = (i - (pool.capacity - 1) / 2) * SLOT_GAP
      const h = live ? 1 : 0.25
      dummy.position.set(x, 0.01 + 0.14 * h, SLOT_Z)
      if (i < pool.capacity) dummy.scale.set(1, h, 1)
      else dummy.scale.setScalar(0)
      dummy.updateMatrix()
      sl.setMatrixAt(i, dummy.matrix)
      sl.setColorAt(i, live ? cActive : cFree)
    }
    m.instanceMatrix.needsUpdate = true
    sl.instanceMatrix.needsUpdate = true
    if (sl.instanceColor) sl.instanceColor.needsUpdate = true
  })

  return (
    <>
      {/* Turret */}
      <group position={TURRET}>
        <mesh position={[0, -0.25, 0]}>
          <cylinderGeometry args={[0.45, 0.55, 0.4, 24]} />
          <meshStandardMaterial
            ref={flash}
            color={palette.object}
            emissive={palette.error}
            emissiveIntensity={0}
          />
        </mesh>
        <group ref={barrel}>
          <mesh position={[0.45, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.1, 0.12, 0.7, 12]} />
            <meshStandardMaterial color={palette.foreground} />
          </mesh>
        </group>
      </group>
      <instancedMesh ref={shots} args={[undefined, undefined, MAX]}>
        <sphereGeometry args={[0.13, 12, 8]} />
        <meshStandardMaterial
          color={palette.moving}
          emissive={palette.moving}
          emissiveIntensity={0.5}
        />
      </instancedMesh>
      {/* Pool slots: one cube per pre-allocated object */}
      <instancedMesh ref={slots} args={[undefined, undefined, MAX]}>
        <boxGeometry args={[0.28, 0.28, 0.28]} />
        <meshStandardMaterial color="#ffffff" />
      </instancedMesh>
      <mesh position={[0, 0.01, SLOT_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[pool.capacity * SLOT_GAP + 0.2, 0.5]} />
        <meshBasicMaterial color={palette.grid} />
      </mesh>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 6.8, 6], target: [0, 0, 0.5] },
  params: [
    {
      key: "rate",
      label: "Fire rate",
      min: 1,
      max: 20,
      step: 0.5,
      value: 6,
      unit: "/s",
    },
    {
      key: "size",
      label: "Pool size",
      min: 4,
      max: MAX,
      step: 1,
      value: 8,
    },
    {
      key: "policy",
      label: "When empty",
      type: "select",
      value: "drop",
      options: [
        { value: "drop", label: "Drop the shot" },
        { value: "recycle", label: "Recycle oldest" },
      ],
    },
  ],
  readout: (v) =>
    `Needs ≈ ${(v.rate * LIFE).toFixed(1)} live · pool ${v.size} · allocations after warm-up: 0`,
  Scene,
})
