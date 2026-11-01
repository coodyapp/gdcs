import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { defineVisual, palette, useFixedStep, useVisual } from "../../kit"
import { stepJumpTimers, type JumpTimers } from "@/lib/game-feel"

type V = { mode: string; window: number; late: number }

const RUN = 4
const GRAVITY = 30
const JUMP = 9
const START_X = -4.5
const PIT_END = 2.2
const PIT_FLOOR = -2.2
const HALF = 0.25

const overPlatform = (x: number) => x <= 0 || x >= PIT_END

function freshState(run: number) {
  return {
    run,
    t: 0,
    x: START_X,
    y: 0,
    vy: 0,
    timers: { coyote: 0, buffer: 0 } as JumpTimers,
    pressed: false,
    outcome: "running" as "running" | "jumped" | "failed",
    hold: 0,
  }
}

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const body = useRef<THREE.Mesh>(null)
  const zone = useRef<THREE.Mesh>(null)
  const zoneMat = useRef<THREE.MeshBasicMaterial>(null)
  const bodyMat = useRef<THREE.MeshStandardMaterial>(null)
  const state = useRef(freshState(0))
  const color = useMemo(() => new THREE.Color(), [])

  useEffect(() => {
    state.current = freshState(0)
  }, [resetKey, v.mode, v.window, v.late])

  const coyoteOn = (run: number) =>
    v.mode === "alternate" ? run % 2 === 0 : v.mode === "on"

  useFixedStep((dt) => {
    let s = state.current
    if (s.hold > 0) {
      s.hold -= dt
      if (s.hold <= 0) state.current = s = freshState(s.run + 1)
      return
    }
    s.t += dt
    const leaveAt = -START_X / RUN
    const press = !s.pressed && s.t >= leaveAt + v.late / 1000
    if (press) s.pressed = true
    const grounded = s.y >= -1e-6 && s.vy <= 0 && overPlatform(s.x)
    const r = stepJumpTimers(s.timers, { grounded, pressed: press }, dt, {
      coyote: coyoteOn(s.run) ? v.window / 1000 : 0,
      buffer: 0,
    })
    s.timers = r.timers
    if (r.jump) {
      s.vy = JUMP
      s.outcome = "jumped"
    } else if (press) {
      s.outcome = "failed"
    }
    s.x += RUN * dt
    if (!grounded || r.jump) {
      s.vy -= GRAVITY * dt
      s.y += s.vy * dt
      // Pit walls and floor.
      if (s.y < 0 && s.x > PIT_END - HALF && s.x < PIT_END) s.x = PIT_END - HALF
      if (s.y < 0 && overPlatform(s.x) && s.x >= PIT_END && s.vy < 0) {
        s.y = 0
        s.vy = 0
      }
      if (s.y <= PIT_FLOOR) {
        s.y = PIT_FLOOR
        s.vy = 0
        s.outcome = "failed"
        s.hold = 0.8
      }
    }
    if (s.x > 5.2) s.hold = 0.5
  }, 120)

  useFrame(() => {
    const s = state.current
    const on = coyoteOn(s.run)
    body.current?.position.set(s.x, s.y + HALF, 0)
    if (bodyMat.current) {
      color.set(
        s.outcome === "jumped"
          ? palette.positive
          : s.outcome === "failed"
            ? palette.negative
            : palette.primary
      )
      bodyMat.current.color.copy(color)
      bodyMat.current.emissive.copy(color)
    }
    if (zone.current && zoneMat.current) {
      const width = Math.max(0.02, (RUN * v.window) / 1000)
      zone.current.scale.x = width
      zone.current.position.x = width / 2
      zoneMat.current.color.set(on ? palette.positive : palette.guide)
      zoneMat.current.opacity = on ? 0.35 : 0.08
    }
  })

  const pressX = (RUN * v.late) / 1000

  return (
    <group>
      <mesh position={[-3, -1.6, 0]}>
        <boxGeometry args={[6, 3.2, 1]} />
        <meshStandardMaterial color={palette.object} />
      </mesh>
      <mesh position={[4.1, -1.6, 0]}>
        <boxGeometry args={[3.8, 3.2, 1]} />
        <meshStandardMaterial color={palette.object} />
      </mesh>
      <mesh position={[PIT_END / 2, PIT_FLOOR - 0.5, 0]}>
        <boxGeometry args={[PIT_END, 1, 1]} />
        <meshStandardMaterial
          color={palette.negative}
          transparent
          opacity={0.35}
        />
      </mesh>
      {/* Grace window: distance covered after leaving the ledge. */}
      <mesh ref={zone} position={[0.2, 0.9, 0.55]}>
        <boxGeometry args={[1, 1.8, 0.02]} />
        <meshBasicMaterial
          ref={zoneMat}
          color={palette.positive}
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </mesh>
      {/* Where the jump button gets pressed. */}
      <mesh position={[pressX, 1, 0.6]}>
        <boxGeometry args={[0.06, 2, 0.02]} />
        <meshBasicMaterial color={palette.warning} />
      </mesh>
      <mesh position={[0, 0.9, 0.56]}>
        <boxGeometry args={[0.03, 1.8, 0.02]} />
        <meshBasicMaterial color={palette.foreground} />
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
  camera: { position: [0.3, 0.6, 10.5], target: [0.3, -0.2, 0] },
  grid: false,
  params: [
    {
      key: "mode",
      label: "Coyote time",
      type: "select",
      value: "alternate",
      options: [
        { value: "alternate", label: "Alternate on/off" },
        { value: "on", label: "On" },
        { value: "off", label: "Off" },
      ],
    },
    {
      key: "window",
      label: "Grace window",
      min: 0,
      max: 200,
      step: 5,
      value: 110,
      unit: "ms",
    },
    {
      key: "late",
      label: "Press after ledge",
      min: 10,
      max: 250,
      step: 5,
      value: 70,
      unit: "ms",
    },
  ],
  readout: (v) =>
    `Pressed ${v.late} ms after the edge · window ${v.window} ms → ${v.late <= v.window ? "jump with coyote time" : "falls even with coyote time"}`,
  Scene,
})
