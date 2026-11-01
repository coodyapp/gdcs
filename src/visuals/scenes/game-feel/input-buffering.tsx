import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { defineVisual, palette, useFixedStep, useVisual } from "../../kit"
import { stepJumpTimers, type JumpTimers } from "@/lib/game-feel"

type V = { mode: string; buffer: number; early: number }

const RUN = 2.4
const GRAVITY = 24
const JUMP = 8
const AIR = (2 * JUMP) / GRAVITY
const START_X = -3
const HALF = 0.25
const STRIP_Y = -0.75
/** Zoomed timeline: 1 unit = 1/15 s, landing at x = 0. */
const TIME_SCALE = 15
const toStrip = (t: number) => (t - AIR) * TIME_SCALE

function freshState(run: number) {
  return {
    run,
    t: 0,
    x: START_X,
    y: 0,
    vy: JUMP,
    jumps: 1,
    timers: { coyote: 0, buffer: 0 } as JumpTimers,
    pressed: false,
    outcome: "air" as "air" | "chained" | "dropped",
    hold: 0,
  }
}

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const body = useRef<THREE.Mesh>(null)
  const bodyMat = useRef<THREE.MeshStandardMaterial>(null)
  const pressMat = useRef<THREE.MeshBasicMaterial>(null)
  const playhead = useRef<THREE.Mesh>(null)
  const bufferBar = useRef<THREE.Mesh>(null)
  const state = useRef(freshState(0))
  const color = useMemo(() => new THREE.Color(), [])

  useEffect(() => {
    state.current = freshState(0)
  }, [resetKey, v.mode, v.buffer, v.early])

  const bufferOn = (run: number) =>
    v.mode === "alternate" ? run % 2 === 0 : v.mode === "on"

  useFixedStep((dt) => {
    let s = state.current
    if (s.hold > 0) {
      s.hold -= dt
      if (s.hold <= 0) state.current = s = freshState(s.run + 1)
      return
    }
    s.t += dt
    const press = !s.pressed && s.t >= AIR - v.early / 1000
    if (press) s.pressed = true
    const grounded = s.y <= 1e-6 && s.vy <= 0
    const r = stepJumpTimers(s.timers, { grounded, pressed: press }, dt, {
      coyote: 0,
      buffer: bufferOn(s.run) ? v.buffer / 1000 : 0,
    })
    s.timers = r.timers
    if (r.jump) {
      s.vy = JUMP
      s.jumps++
      s.outcome = "chained"
    }
    if (!grounded || r.jump) {
      s.x += RUN * dt
      s.vy -= GRAVITY * dt
      s.y += s.vy * dt
      if (s.y <= 0) {
        s.y = 0
        s.vy = 0
        if (s.jumps >= 2) s.hold = 0.6
      }
    } else if (s.outcome === "air") {
      // Landed and nothing fired: the early press was thrown away.
      s.outcome = "dropped"
    }
    if (s.outcome === "dropped" && s.t > 2 * AIR) s.hold = 0.4
  }, 120)

  const pressX = START_X + RUN * (AIR - v.early / 1000)
  const pressT = toStrip(AIR - v.early / 1000)

  useFrame(() => {
    const s = state.current
    const on = bufferOn(s.run)
    body.current?.position.set(s.x, s.y + HALF, 0)
    if (bodyMat.current) {
      color.set(
        s.outcome === "chained"
          ? palette.positive
          : s.outcome === "dropped"
            ? palette.negative
            : palette.primary
      )
      bodyMat.current.color.copy(color)
      bodyMat.current.emissive.copy(color)
    }
    if (bufferBar.current) {
      const w = Math.max(0.001, TIME_SCALE * (v.buffer / 1000))
      bufferBar.current.visible = on
      bufferBar.current.scale.x = w
      bufferBar.current.position.x = pressT + w / 2
    }
    if (playhead.current) {
      const x = toStrip(s.t)
      playhead.current.visible = Math.abs(x) < 4.6 && s.hold <= 0
      playhead.current.position.x = x
    }
    if (pressMat.current) pressMat.current.opacity = s.pressed ? 1 : 0.35
  })

  return (
    <group>
      <mesh position={[0, -0.6, 0]}>
        <boxGeometry args={[11, 1.2, 1]} />
        <meshStandardMaterial color={palette.object} />
      </mesh>
      {/* Zoomed timeline around the landing (white tick). */}
      <mesh position={[0, STRIP_Y, 0.51]}>
        <boxGeometry args={[9.4, 0.7, 0.02]} />
        <meshBasicMaterial color={palette.surface} />
      </mesh>
      <mesh ref={bufferBar} position={[pressT, STRIP_Y, 0.52]}>
        <boxGeometry args={[1, 0.4, 0.02]} />
        <meshBasicMaterial color={palette.primary} transparent opacity={0.6} />
      </mesh>
      <mesh position={[pressT, STRIP_Y, 0.53]}>
        <boxGeometry args={[0.08, 0.7, 0.02]} />
        <meshBasicMaterial color={palette.warning} />
      </mesh>
      <mesh position={[0, STRIP_Y, 0.54]}>
        <boxGeometry args={[0.08, 0.7, 0.02]} />
        <meshBasicMaterial color={palette.foreground} />
      </mesh>
      <mesh ref={playhead} position={[0, STRIP_Y, 0.55]}>
        <boxGeometry args={[0.04, 0.9, 0.02]} />
        <meshBasicMaterial color={palette.guide} />
      </mesh>
      {/* Where the character was when jump was pressed. */}
      <mesh position={[pressX, 0.9, 0]}>
        <boxGeometry args={[0.05, 1.8, 0.05]} />
        <meshBasicMaterial ref={pressMat} color={palette.warning} transparent />
      </mesh>
      <mesh ref={body} position={[START_X, HALF, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial
          ref={bodyMat}
          color={palette.primary}
          emissiveIntensity={0.35}
        />
      </mesh>
    </group>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 0.9, 8.6], target: [0, 0.5, 0] },
  grid: false,
  params: [
    {
      key: "mode",
      label: "Input buffer",
      type: "select",
      value: "alternate",
      options: [
        { value: "alternate", label: "Alternate on/off" },
        { value: "on", label: "On" },
        { value: "off", label: "Off" },
      ],
    },
    {
      key: "buffer",
      label: "Buffer window",
      min: 0,
      max: 250,
      step: 5,
      value: 130,
      unit: "ms",
    },
    {
      key: "early",
      label: "Press before landing",
      min: 10,
      max: 250,
      step: 5,
      value: 90,
      unit: "ms",
    },
  ],
  readout: (v) =>
    `Pressed ${v.early} ms before landing · buffer ${v.buffer} ms → ${v.early <= v.buffer ? "jumps again on touchdown" : "too early, dropped even with a buffer"}`,
  Scene,
})
