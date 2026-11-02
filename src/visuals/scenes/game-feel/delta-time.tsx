import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { defineVisual, palette, useVisual } from "../../kit"

type V = { fps: number; speed: number; jitter: boolean }

const START = -5
const FINISH = 5
const LANES = { dt: -1, frame: 1 }
const MAX_DOTS = 600

function Scene({ v }: { v: V }) {
  const { playing, resetKey } = useVisual()
  const dtRunner = useRef<THREE.Mesh>(null)
  const frameRunner = useRef<THREE.Mesh>(null)
  const dtDots = useRef<THREE.InstancedMesh>(null)
  const frameDots = useRef<THREE.InstancedMesh>(null)
  const state = useRef({
    acc: 0,
    next: 1 / 24,
    hold: 0,
    xDt: START,
    xFrame: START,
    n: 0,
    seed: 1,
    reset: true,
  })
  const m = useMemo(() => new THREE.Matrix4(), [])

  const restart = () => {
    const s = state.current
    s.xDt = START
    s.xFrame = START
    s.n = 0
    s.hold = 0
    s.acc = 0
    if (dtDots.current) dtDots.current.count = 0
    if (frameDots.current) frameDots.current.count = 0
    dtRunner.current?.position.set(START, 0.3, LANES.dt)
    frameRunner.current?.position.set(START, 0.3, LANES.frame)
  }
  useEffect(() => {
    state.current.reset = true
  }, [resetKey, v.fps, v.speed, v.jitter])

  const nextFrameTime = (s: typeof state.current) => {
    if (!v.jitter) return 1 / v.fps
    s.seed = (s.seed * 16807) % 2147483647
    return (0.5 + (s.seed / 2147483647) * 1.0) / v.fps
  }

  useFrame((_, delta) => {
    const s = state.current
    if (s.reset) {
      s.reset = false
      restart()
    }
    if (!playing) return
    const real = Math.min(delta, 0.1)
    if (s.hold > 0) {
      s.hold -= real
      if (s.hold <= 0) restart()
      return
    }
    s.acc += real
    // Simulated frames: each one is a "game update" at the chosen frame rate.
    while (s.acc >= s.next) {
      s.acc -= s.next
      const dt = s.next
      s.xDt += v.speed * dt // scaled by delta time
      s.xFrame += v.speed / 60 // fixed step per frame, tuned for 60 fps
      if (s.n < MAX_DOTS && dtDots.current && frameDots.current) {
        m.makeTranslation(Math.min(s.xDt, FINISH), 0.02, LANES.dt)
        dtDots.current.setMatrixAt(s.n, m)
        m.makeTranslation(Math.min(s.xFrame, FINISH), 0.02, LANES.frame)
        frameDots.current.setMatrixAt(s.n, m)
        s.n++
        dtDots.current.count = s.n
        frameDots.current.count = s.n
        dtDots.current.instanceMatrix.needsUpdate = true
        frameDots.current.instanceMatrix.needsUpdate = true
      }
      s.next = nextFrameTime(s)
      if (s.xDt >= FINISH || s.xFrame >= FINISH) {
        s.hold = 0.9
        break
      }
    }
    dtRunner.current?.position.set(Math.min(s.xDt, FINISH), 0.3, LANES.dt)
    frameRunner.current?.position.set(
      Math.min(s.xFrame, FINISH),
      0.3,
      LANES.frame
    )
  })

  return (
    <group>
      {[LANES.dt, LANES.frame].map((z) => (
        <mesh key={z} position={[0, -0.02, z]}>
          <boxGeometry args={[FINISH - START + 0.8, 0.04, 1.1]} />
          <meshStandardMaterial color={palette.surface} />
        </mesh>
      ))}
      <mesh position={[FINISH + 0.05, 0.4, 0]}>
        <boxGeometry args={[0.08, 0.8, 3.4]} />
        <meshStandardMaterial color={palette.foreground} />
      </mesh>
      <mesh ref={dtRunner} position={[START, 0.3, LANES.dt]}>
        <boxGeometry args={[0.5, 0.6, 0.5]} />
        <meshStandardMaterial
          color={palette.subject}
          emissive={palette.subject}
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh ref={frameRunner} position={[START, 0.3, LANES.frame]}>
        <boxGeometry args={[0.5, 0.6, 0.5]} />
        <meshStandardMaterial
          color={palette.error}
          emissive={palette.error}
          emissiveIntensity={0.3}
        />
      </mesh>
      <instancedMesh
        ref={dtDots}
        args={[undefined, undefined, MAX_DOTS]}
        count={0}
      >
        <boxGeometry args={[0.05, 0.03, 0.5]} />
        <meshBasicMaterial color={palette.subject} />
      </instancedMesh>
      <instancedMesh
        ref={frameDots}
        args={[undefined, undefined, MAX_DOTS]}
        count={0}
      >
        <boxGeometry args={[0.05, 0.03, 0.5]} />
        <meshBasicMaterial color={palette.error} />
      </instancedMesh>
    </group>
  )
}

export default defineVisual<V>({
  gridY: 0,
  camera: { position: [0, 6.5, 7.5], target: [0, 0, 0.2] },
  params: [
    {
      key: "fps",
      label: "Simulated FPS",
      min: 10,
      max: 144,
      step: 1,
      value: 24,
      unit: "fps",
    },
    {
      key: "speed",
      label: "Speed",
      min: 2,
      max: 8,
      step: 0.5,
      value: 4,
      unit: "u/s",
    },
    { key: "jitter", label: "Uneven frames", type: "toggle", value: false },
  ],
  readout: (v) =>
    `Per-frame runner: ${(v.fps / 60).toFixed(2)}× intended speed · step ${((v.speed / v.fps) * 100).toFixed(0)} cm/frame`,
  Scene,
})
