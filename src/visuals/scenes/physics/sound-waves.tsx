import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { defineVisual, palette, useClock } from "../../kit"

type V = { frequency: number; amplitude: number }

const TAU = Math.PI * 2
const SOUND_SPEED = 343
const WORLD_PER_M = 4
const SLOW_MOTION = 0.005 // 200× slower than real time
const COLS = 90
const ROWS = 6
const COUNT = COLS * ROWS
const X_MIN = -4.3
const X_MAX = 4.7
const CURVE_Y = 1.75
const CURVE_N = 160

function Scene({ v }: { v: V }) {
  const time = useClock()
  const particles = useRef<THREE.InstancedMesh>(null)
  const cone = useRef<THREE.Mesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const low = useMemo(() => new THREE.Color(palette.subject), [])
  const high = useMemo(() => new THREE.Color(palette.energy), [])
  const mix = useMemo(() => new THREE.Color(), [])
  const colors = useMemo(() => new Float32Array(COUNT * 3), [])
  const curve = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(CURVE_N * 3), 3)
    )
    return new THREE.Line(
      g,
      // Pressure is force per area, so it uses the force colour.
      new THREE.LineBasicMaterial({ color: palette.force })
    )
  }, [])

  useFrame(() => {
    const mesh = particles.current
    if (!mesh) return
    const lambda = (SOUND_SPEED / v.frequency) * WORLD_PER_M
    const k = TAU / lambda
    const phase = TAU * v.frequency * SLOW_MOTION * time.current
    // Cap k·A below 1 so neighbouring particles never cross (that would be a shock).
    const amp = Math.min(v.amplitude * 0.12, 0.8 / k)
    const gain = Math.min(1, 0.35 + 0.45 * v.amplitude)
    for (let i = 0; i < COUNT; i++) {
      const col = i % COLS
      const row = Math.floor(i / COLS)
      const x = X_MIN + (col / (COLS - 1)) * (X_MAX - X_MIN)
      const arg = k * (x - X_MIN) - phase
      dummy.position.set(x + amp * Math.sin(arg), row * 0.36 - 0.9, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      // Pressure ∝ −∂ξ/∂x = −kA cos(arg): orange = compression, cyan = rarefaction.
      mix.copy(low).lerp(high, 0.5 - 0.5 * Math.cos(arg) * gain)
      mix.toArray(colors, i * 3)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    const cp = curve.geometry.getAttribute("position") as THREE.BufferAttribute
    for (let i = 0; i < CURVE_N; i++) {
      const x = X_MIN + (i / (CURVE_N - 1)) * (X_MAX - X_MIN)
      const p = -Math.cos(k * (x - X_MIN) - phase) * k * amp
      cp.setXYZ(i, x, CURVE_Y + p * 1.2, 0)
    }
    cp.needsUpdate = true
    cone.current?.position.setX(-4.95 + amp * Math.sin(-phase))
  })

  return (
    <>
      <instancedMesh ref={particles} args={[undefined, undefined, COUNT]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial />
        <instancedBufferAttribute attach="instanceColor" args={[colors, 3]} />
      </instancedMesh>
      <mesh position={[-5.6, 0, 0]}>
        <boxGeometry args={[0.8, 2.6, 1.6]} />
        <meshStandardMaterial color={palette.object} />
      </mesh>
      <mesh ref={cone} position={[-4.95, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[1, 0.6, 32, 1, true]} />
        <meshStandardMaterial color={palette.guide} side={THREE.DoubleSide} />
      </mesh>
      <primitive object={curve} />
      <mesh position={[0.2, CURVE_Y, -0.02]}>
        <boxGeometry args={[X_MAX - X_MIN, 0.01, 0.01]} />
        <meshBasicMaterial color={palette.guide} />
      </mesh>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [-0.6, 0.5, 8.2], target: [-0.6, 0.45, 0] },
  params: [
    {
      key: "frequency",
      label: "Frequency",
      min: 100,
      max: 1000,
      step: 10,
      value: 440,
      unit: "Hz",
    },
    {
      key: "amplitude",
      label: "Amplitude",
      min: 0.1,
      max: 2,
      step: 0.1,
      value: 1.2,
    },
  ],
  readout: (v) =>
    `λ = v/f = ${(SOUND_SPEED / v.frequency).toFixed(2)} m · v = 343 m/s · period ${(1000 / v.frequency).toFixed(2)} ms · shown 200× slower`,
  Scene,
})
