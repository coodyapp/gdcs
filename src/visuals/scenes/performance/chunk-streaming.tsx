import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import { chunkCoords, chunkKey, ChunkStreamer } from "@/lib/chunks"

import {
  defineVisual,
  palette,
  useClock,
  useFixedStep,
  useVisual,
  type Vec3,
} from "../../kit"

type V = { load: number; margin: number; budget: number }

// Visible window of chunks (chunk size 1): x in [X0, X0 + COLS), z in [Z0, Z0 + ROWS).
const X0 = -7
const Z0 = -4
const COLS = 14
const ROWS = 8
const TILES = COLS * ROWS
const STREAM_HZ = 12
const FLASH = 0.7 // seconds an unloaded chunk stays red

const CIRCLE: Vec3[] = Array.from({ length: 65 }, (_, i) => {
  const a = (i / 64) * Math.PI * 2
  return [Math.cos(a), 0, Math.sin(a)]
})

/** Wandering path with a small wiggle, so the player keeps crossing chunk edges. */
const playerAt = (t: number, out: THREE.Vector3) =>
  out.set(
    3.6 * Math.sin(t * 0.3) + 0.3 * Math.sin(t * 4.2),
    0.25,
    1.9 * Math.sin(t * 0.47 + 0.6) + 0.2 * Math.cos(t * 3.1)
  )

const tileIndex = (cx: number, cz: number) => {
  const x = cx - X0
  const z = cz - Z0
  return x < 0 || z < 0 || x >= COLS || z >= ROWS ? -1 : z * COLS + x
}

function Scene({ v }: { v: V }) {
  const time = useClock()
  const { resetKey } = useVisual()
  const streamer = useMemo(() => new ChunkStreamer(1, 2, 3), [])
  const unloadedAt = useMemo(() => new Float32Array(TILES).fill(-99), [])
  const loadedAt = useMemo(() => new Float32Array(TILES).fill(-99), [])
  const tiles = useRef<THREE.InstancedMesh>(null)
  const player = useRef<THREE.Mesh>(null)
  const rings = useRef<THREE.Group>(null)
  const loadRing = useRef<THREE.Group>(null)
  const unloadRing = useRef<THREE.Group>(null)
  const p = useMemo(() => new THREE.Vector3(), [])
  const m = useMemo(() => new THREE.Matrix4(), [])
  const c = useMemo(() => new THREE.Color(), [])
  const colors = useMemo(
    () => ({
      empty: new THREE.Color(palette.surface),
      resident: new THREE.Color(palette.success),
      fresh: new THREE.Color(palette.foreground),
      pending: new THREE.Color(palette.velocity),
      gone: new THREE.Color(palette.error),
    }),
    []
  )

  useEffect(() => {
    streamer.resident.clear()
    unloadedAt.fill(-99)
    loadedAt.fill(-99)
  }, [resetKey, streamer, unloadedAt, loadedAt])

  useFixedStep(() => {
    streamer.loadRadius = v.load
    streamer.unloadRadius = v.load + v.margin
    playerAt(time.current, p)
    const ev = streamer.update(p.x, p.z, v.budget)
    for (const key of ev.loaded) {
      const i = tileIndex(...chunkCoords(key))
      if (i >= 0) loadedAt[i] = time.current
    }
    for (const key of ev.unloaded) {
      const i = tileIndex(...chunkCoords(key))
      if (i >= 0) unloadedAt[i] = time.current
    }
  }, STREAM_HZ)

  useFrame(() => {
    const mesh = tiles.current
    if (!mesh) return
    const t = time.current
    playerAt(t, p)
    player.current?.position.copy(p)
    rings.current?.position.set(p.x, 0.3, p.z)
    loadRing.current?.scale.setScalar(v.load)
    unloadRing.current?.scale.setScalar(v.load + v.margin)
    if (unloadRing.current) unloadRing.current.visible = v.margin > 0.01

    for (let i = 0; i < TILES; i++) {
      const cx = X0 + (i % COLS)
      const cz = Z0 + Math.floor(i / COLS)
      const resident = streamer.resident.has(chunkKey(cx, cz))
      let h = 0.06
      if (resident) {
        const age = t - loadedAt[i]
        c.copy(colors.resident).lerp(colors.fresh, Math.max(0, 1 - age / 0.35))
        h = 0.22
      } else if (streamer.distanceTo(p.x, p.z, cx, cz) <= v.load) {
        c.copy(colors.pending)
        h = 0.1
      } else {
        const since = t - unloadedAt[i]
        c.copy(colors.empty)
        if (since >= 0 && since < FLASH) c.lerp(colors.gone, 1 - since / FLASH)
      }
      m.makeScale(0.9, h, 0.9).setPosition(cx + 0.5, h / 2, cz + 0.5)
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, c)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={tiles} args={[undefined, undefined, TILES]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <group ref={rings}>
        <group ref={loadRing}>
          <Line points={CIRCLE} color={palette.success} lineWidth={2} />
        </group>
        <group ref={unloadRing}>
          <Line
            points={CIRCLE}
            color={palette.error}
            lineWidth={2}
            dashed
            dashSize={0.06}
            gapSize={0.05}
          />
        </group>
      </group>
      <mesh ref={player}>
        <sphereGeometry args={[0.2, 20, 14]} />
        <meshStandardMaterial
          color={palette.subject}
          emissive={palette.subject}
          emissiveIntensity={0.5}
        />
      </mesh>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 11, 3.4], target: [0, 0, 0.3] },
  grid: false,
  orbit: false,
  params: [
    {
      key: "load",
      label: "Load radius",
      min: 1.2,
      max: 3.5,
      step: 0.1,
      value: 2.2,
      unit: "chunks",
    },
    {
      key: "margin",
      label: "Hysteresis margin",
      min: 0,
      max: 2,
      step: 0.1,
      value: 1,
      unit: "chunks",
    },
    {
      key: "budget",
      label: "Loads per update",
      min: 1,
      max: 8,
      step: 1,
      value: 2,
    },
  ],
  readout: (v) => {
    const r = v.load + v.margin / 2
    return `Load ≤ ${v.load.toFixed(1)} · unload > ${(v.load + v.margin).toFixed(1)} chunks · ≈ ${Math.round(Math.PI * r * r)} chunks resident · ≤ ${v.budget} loads per update (${STREAM_HZ} Hz)`
  },
  Scene,
})
