import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import { FixedStepper, interpolate } from "@/lib/fixed-step"

import { defineVisual, palette, useVisual } from "../../kit"

type V = { hz: number; interp: boolean; jitter: boolean }

const H = 3.4 // drop height (ball centre)
const R = 0.25
const G = 9.8
const LEFT_X = -1.8
const RIGHT_X = 1.4
const GHOST_X = 2.4

interface Ball {
  y: number
  vy: number
}

/** Semi-implicit Euler + floor reflection: same code for both balls. */
function step(b: Ball, dt: number) {
  b.vy -= G * dt
  b.y += b.vy * dt
  if (b.y < R) {
    b.y = 2 * R - b.y
    b.vy = Math.abs(b.vy)
  }
}

function Scene({ v }: { v: V }) {
  const { playing, resetKey } = useVisual()
  const sim = useMemo(
    () => ({
      variable: { y: H, vy: 0 } as Ball,
      prev: { y: H, vy: 0 } as Ball,
      curr: { y: H, vy: 0 } as Ball,
      stepper: new FixedStepper(1 / 60),
    }),
    []
  )
  useEffect(() => {
    sim.variable.y = sim.prev.y = sim.curr.y = H
    sim.variable.vy = sim.prev.vy = sim.curr.vy = 0
    sim.stepper.reset()
  }, [sim, resetKey])

  const left = useRef<THREE.Mesh>(null)
  const right = useRef<THREE.Mesh>(null)
  const ghost = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.1)
    if (playing) {
      // Variable timestep: integrate with whatever the frame took (jittered).
      let dt = d
      if (v.jitter) {
        dt *= 0.6 + 0.8 * Math.random()
        if (Math.random() < 0.03) dt = 0.12 // an occasional hitch
      }
      step(sim.variable, dt)

      // Fixed timestep: accumulator drives constant-size steps.
      sim.stepper.dt = 1 / v.hz
      sim.stepper.advance(d, (h) => {
        sim.prev.y = sim.curr.y
        sim.prev.vy = sim.curr.vy
        step(sim.curr, h)
      })
    }
    const alpha = Math.min(1, sim.stepper.alpha)
    left.current?.position.set(LEFT_X, sim.variable.y, 0)
    right.current?.position.set(
      RIGHT_X,
      v.interp ? interpolate(sim.prev.y, sim.curr.y, alpha) : sim.curr.y,
      0
    )
    ghost.current?.position.set(GHOST_X, sim.curr.y, 0)
  })

  return (
    <>
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[7, 0.1, 1.6]} />
        <meshStandardMaterial color={palette.surface} />
      </mesh>
      <Line
        points={[
          [-3.2, H, 0],
          [3.2, H, 0],
        ]}
        color={palette.guide}
        lineWidth={1.5}
        dashed
        dashSize={0.18}
        gapSize={0.12}
      />
      <mesh ref={left}>
        <sphereGeometry args={[R, 24, 16]} />
        <meshStandardMaterial
          color={palette.secondary}
          emissive={palette.secondary}
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh ref={right}>
        <sphereGeometry args={[R, 24, 16]} />
        <meshStandardMaterial
          color={palette.primary}
          emissive={palette.primary}
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh ref={ghost}>
        <sphereGeometry args={[R * 0.7, 16, 12]} />
        <meshBasicMaterial color={palette.guide} transparent opacity={0.5} />
      </mesh>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 2.2, 8.5], target: [0, 1.8, 0] },
  params: [
    {
      key: "hz",
      label: "Physics rate",
      min: 5,
      max: 60,
      step: 1,
      value: 10,
      unit: "Hz",
    },
    { key: "interp", label: "Interpolate render", type: "toggle", value: true },
    {
      key: "jitter",
      label: "Jittery frames (orange)",
      type: "toggle",
      value: true,
    },
  ],
  readout: (v) =>
    `Fixed step ${(1000 / v.hz).toFixed(1)} ms · ${v.interp ? "drawn with lerp(prev, curr, α)" : "drawn at last physics state"}`,
  Scene,
})
