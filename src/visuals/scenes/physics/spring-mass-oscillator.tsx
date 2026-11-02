import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import {
  stepDrivenOscillator,
  steadyStateAmplitude,
} from "@/lib/physics/mechanics-labs"

import { defineVisual, palette, useFixedStep, useVisual } from "../../kit"

type V = { stiffness: number; damping: number; drive: number; omega: number }

const WALL_X = -4.1
const REST_X = 1.2
const Y = 0.6
const COILS = 22
const TRACE = 240
const TRACE_Y = 2.9
const STOP = 2.4

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const mass = useRef<THREE.Mesh>(null)
  const state = useRef({ x: 0, v: 0, t: 0, n: 0 })
  const history = useMemo(() => new Float32Array(TRACE), [])

  const spring = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(COILS * 3), 3)
    )
    return new THREE.Line(
      g,
      new THREE.LineBasicMaterial({ color: palette.subject })
    )
  }, [])
  const trace = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(TRACE * 3), 3)
    )
    return new THREE.Line(
      g,
      new THREE.LineBasicMaterial({ color: palette.moving })
    )
  }, [])

  useEffect(() => {
    state.current = { x: 0, v: 0, t: 0, n: 0 }
    history.fill(0)
  }, [resetKey, v.stiffness, v.damping, v.drive, v.omega, history])

  useFixedStep((dt) => {
    const s = state.current
    stepDrivenOscillator(s, v.stiffness, v.damping, v.drive, v.omega, dt)
    // End stops keep an undamped resonance on screen.
    if (Math.abs(s.x) > STOP) {
      s.x = Math.sign(s.x) * STOP
      s.v = 0
    }
    if (++s.n % 4 === 0) {
      history.copyWithin(0, 1)
      history[TRACE - 1] = s.x
    }
  }, 120)

  useFrame(() => {
    const massX = REST_X + state.current.x
    mass.current?.position.setX(massX)
    const sp = spring.geometry.getAttribute("position") as THREE.BufferAttribute
    const start = WALL_X + 0.1
    const end = massX - 0.6
    for (let i = 0; i < COILS; i++) {
      const f = i / (COILS - 1)
      const zig = i === 0 || i === COILS - 1 ? 0 : i % 2 ? 0.25 : -0.25
      sp.setXYZ(i, start + f * (end - start), Y + zig, 0)
    }
    sp.needsUpdate = true
    const tp = trace.geometry.getAttribute("position") as THREE.BufferAttribute
    for (let i = 0; i < TRACE; i++) {
      tp.setXYZ(i, -4 + (i / (TRACE - 1)) * 8, TRACE_Y + history[i] * 0.55, 0)
    }
    tp.needsUpdate = true
  })

  return (
    <group>
      <mesh position={[WALL_X, 1.2, 0]}>
        <boxGeometry args={[0.2, 2.4, 2.4]} />
        <meshStandardMaterial color={palette.object} />
      </mesh>
      <primitive object={spring} />
      <mesh ref={mass} position={[REST_X, Y, 0]}>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <meshStandardMaterial
          color={palette.moving}
          emissive={palette.moving}
          emissiveIntensity={0.25}
        />
      </mesh>
      <Line
        points={[
          [REST_X, 0, 0.7],
          [REST_X, 1.6, 0.7],
        ]}
        color={palette.guide}
        lineWidth={1}
        dashed
        dashSize={0.12}
        gapSize={0.08}
      />
      <Line
        points={[
          [-4, TRACE_Y, 0],
          [4, TRACE_Y, 0],
        ]}
        color={palette.guide}
        lineWidth={1}
      />
      <primitive object={trace} />
    </group>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 2.2, 8.6], target: [0, 1.55, 0] },
  params: [
    {
      key: "stiffness",
      label: "Spring stiffness k",
      min: 0.4,
      max: 3,
      step: 0.1,
      value: 1.4,
      unit: "N/m",
    },
    {
      key: "damping",
      label: "Damping c",
      min: 0,
      max: 1.1,
      step: 0.05,
      value: 0.35,
      unit: "N·s/m",
      digits: 2,
    },
    {
      key: "drive",
      label: "Drive strength F₀",
      min: 0,
      max: 1.4,
      step: 0.1,
      value: 0.6,
      unit: "N",
    },
    {
      key: "omega",
      label: "Drive frequency ω",
      min: 0.4,
      max: 3,
      step: 0.05,
      value: 1.2,
      unit: "rad/s",
      digits: 2,
    },
  ],
  readout: (v) => {
    const w0 = Math.sqrt(v.stiffness)
    const zeta = v.damping / (2 * w0)
    const amp = steadyStateAmplitude(v.stiffness, v.damping, v.drive, v.omega)
    return `ω₀ ${w0.toFixed(2)} rad/s · ζ ${zeta.toFixed(2)} · steady amplitude ${Number.isFinite(amp) ? amp.toFixed(2) + " m" : "∞"}`
  },
  Scene,
})
