import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { defineVisual, palette, useFixedStep, useVisual } from "../../kit"
import { stepVelocity } from "@/lib/game-feel"

type V = { accel: number; decel: number; maxSpeed: number; model: string }

const PERIOD = 5.4
const SAMPLES = 180
const SAMPLE_DT = 6 / SAMPLES
const PLOT_Y = -1.35
const PLOT_H = 1.2 // half-height for |v| = 6
const PLOT_X0 = -5
const PLOT_W = 10
const TRACK_Y = 1.7
const SCALE = 0.6
/** Dashes in the velocity arrow (velocity is drawn dashed). */
const DASHES = 5

const inputAt = (t: number) => {
  const p = t % PERIOD
  if (p < 1.5) return 1
  if (p < 2.7) return 0
  if (p < 4.2) return -1
  return 0
}

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const box = useRef<THREE.Mesh>(null)
  const arrow = useRef<THREE.Group>(null)
  const velDots = useRef<THREE.InstancedMesh>(null)
  const inDots = useRef<THREE.InstancedMesh>(null)
  const sim = useRef({ t: 0, x: 0, v: 0, sampleAcc: 0 })
  const history = useMemo(
    () => ({
      v: new Float32Array(SAMPLES),
      target: new Float32Array(SAMPLES),
      n: 0,
    }),
    []
  )
  const m = useMemo(() => new THREE.Matrix4(), [])

  useEffect(() => {
    sim.current = { t: 0, x: 0, v: 0, sampleAcc: 0 }
    history.v.fill(0)
    history.target.fill(0)
    history.n = 0
  }, [resetKey, v.accel, v.decel, v.maxSpeed, v.model, history])

  useFixedStep((dt) => {
    const s = sim.current
    const input = inputAt(s.t)
    s.v = stepVelocity(s.v, input, dt, {
      accel: v.accel,
      decel: v.decel,
      maxSpeed: v.maxSpeed,
      model: v.model as "linear" | "damped" | "instant",
    })
    s.x += s.v * dt
    s.t += dt
    s.sampleAcc += dt
    if (s.sampleAcc >= SAMPLE_DT) {
      s.sampleAcc -= SAMPLE_DT
      // Scroll left by one sample.
      history.v.copyWithin(0, 1)
      history.target.copyWithin(0, 1)
      history.v[SAMPLES - 1] = s.v
      history.target[SAMPLES - 1] = input * v.maxSpeed
      history.n = Math.min(SAMPLES, history.n + 1)
    }
  }, 120)

  useFrame(() => {
    const s = sim.current
    const vx = Math.max(-4.8, Math.min(4.8, -2.4 + s.x * SCALE))
    box.current?.position.set(vx, TRACK_Y + 0.3, 0)
    if (arrow.current) {
      const len = Math.abs(s.v) * 0.3
      arrow.current.visible = len > 0.02
      arrow.current.scale.x = Math.max(0.001, len)
      arrow.current.position.set(
        vx + Math.sign(s.v) * (0.3 + len / 2),
        TRACK_Y + 0.3,
        0.3
      )
    }
    if (velDots.current && inDots.current) {
      const first = SAMPLES - history.n
      let k = 0
      for (let i = first; i < SAMPLES; i++, k++) {
        const x = PLOT_X0 + (i / (SAMPLES - 1)) * PLOT_W
        m.makeTranslation(x, PLOT_Y + (history.v[i] / 6) * PLOT_H, 0.02)
        velDots.current.setMatrixAt(k, m)
        m.makeTranslation(x, PLOT_Y + (history.target[i] / 6) * PLOT_H, 0)
        inDots.current.setMatrixAt(k, m)
      }
      velDots.current.count = k
      inDots.current.count = k
      velDots.current.instanceMatrix.needsUpdate = true
      inDots.current.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group>
      <mesh position={[0, TRACK_Y - 0.05, 0]}>
        <boxGeometry args={[10.4, 0.1, 1]} />
        <meshStandardMaterial color={palette.surface} />
      </mesh>
      <mesh ref={box} position={[-2.4, TRACK_Y + 0.3, 0]}>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
        <meshStandardMaterial
          color={palette.subject}
          emissive={palette.subject}
          emissiveIntensity={0.25}
        />
      </mesh>
      <group ref={arrow}>
        {Array.from({ length: DASHES }, (_, i) => (
          <mesh key={i} position={[(i + 0.5) / DASHES - 0.5, 0, 0]}>
            <boxGeometry args={[0.6 / DASHES, 0.1, 0.1]} />
            <meshBasicMaterial color={palette.velocity} />
          </mesh>
        ))}
      </group>
      {/* Plot: zero line and ±max frame. */}
      <mesh position={[0, PLOT_Y, -0.02]}>
        <boxGeometry args={[PLOT_W, 0.02, 0.01]} />
        <meshBasicMaterial color={palette.guide} />
      </mesh>
      <mesh position={[0, PLOT_Y, -0.05]}>
        <boxGeometry args={[PLOT_W + 0.3, PLOT_H * 2 + 0.3, 0.01]} />
        <meshBasicMaterial color="#171717" />
      </mesh>
      <instancedMesh
        ref={inDots}
        args={[undefined, undefined, SAMPLES]}
        count={0}
      >
        <boxGeometry args={[0.07, 0.035, 0.01]} />
        <meshBasicMaterial color={palette.guide} />
      </instancedMesh>
      <instancedMesh
        ref={velDots}
        args={[undefined, undefined, SAMPLES]}
        count={0}
      >
        <boxGeometry args={[0.07, 0.07, 0.01]} />
        <meshBasicMaterial color={palette.velocity} />
      </instancedMesh>
    </group>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 0.2, 9.4], target: [0, 0.1, 0] },
  params: [
    {
      key: "accel",
      label: "Acceleration",
      min: 2,
      max: 40,
      step: 1,
      value: 10,
      unit: "u/s²",
    },
    {
      key: "decel",
      label: "Deceleration",
      min: 2,
      max: 40,
      step: 1,
      value: 20,
      unit: "u/s²",
    },
    {
      key: "maxSpeed",
      label: "Max speed",
      min: 1,
      max: 6,
      step: 0.5,
      value: 4,
      unit: "u/s",
    },
    {
      key: "model",
      label: "Model",
      type: "select",
      value: "linear",
      options: [
        { value: "linear", label: "Linear (move towards)" },
        { value: "damped", label: "Exponential damping" },
        { value: "instant", label: "Instant (no ramp)" },
      ],
    },
  ],
  readout: (v) =>
    v.model === "instant"
      ? "Velocity snaps to the input: no ramp at all"
      : `0 → max in ${(v.maxSpeed / v.accel).toFixed(2)} s · max → 0 in ${(v.maxSpeed / v.decel).toFixed(2)} s${v.model === "damped" ? " (initial slope)" : ""}`,
  Scene,
})
