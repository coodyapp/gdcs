import { useCallback, useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { sphereAabbOverlap, sweptSphereAabb } from "@/lib/swept"

import { defineVisual, palette, useFixedStep, useVisual } from "../../kit"

type V = { speed: number; hz: string; wall: number }

const START_X = -4.6
const END_X = 5
const WALL_X = 1.4
const Y = 0.45
const R = 0.08
const LANES = [-1, 1] as const // z of the discrete lane, then the swept lane
const MAX_SAMPLES = 90
const PAUSE = 0.9

interface Lane {
  x: number
  done: boolean
  hit: boolean
  samples: number[]
}

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const lanes = useMemo<Lane[]>(
    () =>
      LANES.map(() => ({ x: START_X, done: false, hit: false, samples: [] })),
    []
  )
  const timer = useRef(0)
  const restart = useCallback(() => {
    for (const l of lanes) {
      l.x = START_X
      l.done = false
      l.hit = false
      l.samples.length = 0
      l.samples.push(START_X)
    }
    timer.current = 0
  }, [lanes])
  useEffect(restart, [restart, resetKey, v.speed, v.hz, v.wall])

  const p0 = useMemo(() => new THREE.Vector3(), [])
  const p1 = useMemo(() => new THREE.Vector3(), [])
  const min = useMemo(() => new THREE.Vector3(), [])
  const max = useMemo(() => new THREE.Vector3(), [])

  useFixedStep((dt) => {
    min.set(WALL_X - v.wall / 2, 0, -2)
    max.set(WALL_X + v.wall / 2, 1.2, 2)
    if (lanes.every((l) => l.done)) {
      timer.current += dt
      if (timer.current > PAUSE) restart()
      return
    }
    lanes.forEach((l, i) => {
      if (l.done) return
      const next = l.x + v.speed * dt
      p0.set(l.x, Y, 0)
      p1.set(next, Y, 0)
      if (i === 0) {
        // Discrete: only look at where the bullet ends up this tick.
        if (sphereAabbOverlap(p1, R, min, max)) l.hit = true
        l.x = next
      } else {
        // Swept: test the whole segment travelled this tick.
        const t = sweptSphereAabb(p0, p1, R, min, max)
        if (t !== null) {
          l.x = l.x + (next - l.x) * t
          l.hit = true
        } else l.x = next
      }
      if (l.samples.length < MAX_SAMPLES) l.samples.push(l.x)
      if (l.hit || l.x > END_X) l.done = true
    })
  }, Number(v.hz))

  const bullets = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)]
  const bulletMats = [
    useRef<THREE.MeshStandardMaterial>(null),
    useRef<THREE.MeshStandardMaterial>(null),
  ]
  const sparks = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)]
  const dots = [
    useRef<THREE.InstancedMesh>(null),
    useRef<THREE.InstancedMesh>(null),
  ]
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const cFly = useMemo(() => new THREE.Color(palette.primary), [])
  const cMiss = useMemo(() => new THREE.Color(palette.negative), [])
  const cHit = useMemo(() => new THREE.Color(palette.secondary), [])

  useFrame(({ clock }) => {
    lanes.forEach((l, i) => {
      const z = LANES[i]
      bullets[i].current?.position.set(l.x, Y, z)
      const passed = !l.hit && l.x > WALL_X
      bulletMats[i].current?.color.copy(l.hit ? cHit : passed ? cMiss : cFly)
      bulletMats[i].current?.emissive.copy(l.hit ? cHit : passed ? cMiss : cFly)
      const spark = sparks[i].current
      if (spark) {
        spark.visible = l.hit
        spark.position.set(l.x, Y, z)
        spark.scale.setScalar(1 + 0.25 * Math.sin(clock.elapsedTime * 20))
      }
      const m = dots[i].current
      if (!m) return
      for (let k = 0; k < l.samples.length; k++) {
        dummy.position.set(l.samples[k], Y, z)
        dummy.updateMatrix()
        m.setMatrixAt(k, dummy.matrix)
      }
      m.count = l.samples.length
      m.instanceMatrix.needsUpdate = true
    })
  })

  return (
    <>
      <mesh position={[WALL_X, 0.6, 0]}>
        <boxGeometry args={[v.wall, 1.2, 3.6]} />
        <meshStandardMaterial
          color={palette.object}
          transparent
          opacity={0.9}
        />
      </mesh>
      {LANES.map((z, i) => (
        <group key={z}>
          <mesh position={[0, 0.005, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[10, 0.5]} />
            <meshBasicMaterial color={palette.surface} />
          </mesh>
          <instancedMesh
            ref={dots[i]}
            args={[undefined, undefined, MAX_SAMPLES]}
            frustumCulled={false}
          >
            <sphereGeometry args={[0.05, 8, 6]} />
            <meshBasicMaterial
              color={i === 0 ? palette.guide : palette.primary}
              transparent
              opacity={0.6}
            />
          </instancedMesh>
          <mesh ref={bullets[i]}>
            <sphereGeometry args={[R * 1.6, 16, 12]} />
            <meshStandardMaterial ref={bulletMats[i]} emissiveIntensity={0.5} />
          </mesh>
          <mesh ref={sparks[i]} visible={false}>
            <icosahedronGeometry args={[0.28, 0]} />
            <meshBasicMaterial color={palette.secondary} wireframe />
          </mesh>
        </group>
      ))}
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 6.5, 5.5], target: [0, 0, 0] },
  params: [
    {
      key: "speed",
      label: "Bullet speed",
      min: 3,
      max: 80,
      step: 1,
      value: 40,
      unit: "u/s",
    },
    {
      key: "hz",
      label: "Physics tick",
      type: "select",
      value: "30",
      options: [
        { value: "15", label: "15 Hz" },
        { value: "30", label: "30 Hz" },
        { value: "60", label: "60 Hz" },
        { value: "120", label: "120 Hz" },
      ],
    },
    {
      key: "wall",
      label: "Wall thickness",
      min: 0.05,
      max: 1,
      step: 0.05,
      value: 0.15,
      unit: "u",
      digits: 2,
    },
  ],
  readout: (v) => {
    const step = v.speed / Number(v.hz)
    const safe = v.wall + 2 * R
    return `Travel per tick ${step.toFixed(2)} u vs wall + diameter ${safe.toFixed(2)} u → ${step > safe ? "discrete can tunnel" : "discrete is safe"}`
  },
  Scene,
})
