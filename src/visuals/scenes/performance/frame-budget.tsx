import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { defineVisual, palette, useClock, useVisual } from "../../kit"

type V = { load: number; hz: string; spikes: boolean }

/** Per-system cost in ms at load 1. `scales` systems grow with the load. */
const SYSTEMS = [
  { name: "gameplay", ms: 2.8, scales: true, color: palette.warning },
  { name: "physics", ms: 3.2, scales: true, color: palette.secondary },
  { name: "ai", ms: 2.4, scales: true, color: palette.tertiary },
  { name: "render", ms: 4.0, scales: true, color: palette.primary },
  { name: "other", ms: 2.0, scales: false, color: palette.object },
] as const

const typicalMs = (load: number) =>
  SYSTEMS.reduce((sum, s) => sum + (s.scales ? s.ms * load : s.ms), 0)

const X0 = -4.6 // left edge of the frame bar
const BUDGET_W = 5.6 // scene units for one budget
const MAX_W = 9.6 // the bar is clipped here (≈1.7 budgets)
const BAR_Y = -1.3
const HIST_Y = 0.2
const HIST_H = 2.2 // height of one budget in the history chart
const HISTORY = 36
const SAMPLE_HZ = 12

function Scene({ v }: { v: V }) {
  const time = useClock()
  const { resetKey, playing } = useVisual()
  const budget = 1000 / Number(v.hz)
  const k = BUDGET_W / budget
  const slices = useRef<(THREE.Mesh | null)[]>([])
  const over = useRef<THREE.Mesh>(null)
  const bars = useRef<(THREE.Mesh | null)[]>([])
  const history = useMemo(() => new Float32Array(HISTORY), [])
  const sampleAcc = useRef(0)
  const ms = useMemo(() => new Float32Array(SYSTEMS.length), [])
  const ok = useMemo(() => new THREE.Color(palette.positive), [])
  const bad = useMemo(() => new THREE.Color(palette.negative), [])

  useEffect(() => {
    history.fill(0)
  }, [resetKey, history])

  useFrame((_, delta) => {
    const t = time.current
    // Load wobbles like a real game; a GC-style spike lands every ~2.6 s.
    const wobble = 1 + 0.1 * Math.sin(t * 1.3) + 0.05 * Math.sin(t * 4.1)
    const spike = v.spikes && t % 2.6 < 0.35 ? 4.5 : 0
    let total = 0
    SYSTEMS.forEach((s, i) => {
      ms[i] = s.scales ? s.ms * v.load * wobble : s.ms + (i === 4 ? spike : 0)
      total += ms[i]
    })
    let cum = 0
    SYSTEMS.forEach((_, i) => {
      const m = slices.current[i]
      if (!m) return
      const x0 = Math.min(cum * k, MAX_W)
      const x1 = Math.min((cum + ms[i]) * k, MAX_W)
      m.visible = x1 > x0
      m.scale.x = Math.max(1e-3, x1 - x0 - 0.04)
      m.position.x = X0 + (x0 + x1) / 2
      cum += ms[i]
    })
    if (over.current) {
      const end = Math.min(total * k, MAX_W)
      over.current.visible = end > BUDGET_W
      over.current.scale.x = Math.max(1e-3, end - BUDGET_W)
      over.current.position.x = X0 + (BUDGET_W + end) / 2
    }

    if (playing) {
      sampleAcc.current += delta
      if (sampleAcc.current >= 1 / SAMPLE_HZ) {
        sampleAcc.current = 0
        history.copyWithin(0, 1)
        history[HISTORY - 1] = total
      }
    }
    for (let i = 0; i < HISTORY; i++) {
      const b = bars.current[i]
      if (!b) continue
      const h = Math.min(history[i] / budget, 1.5) * HIST_H
      b.visible = h > 0
      b.scale.y = Math.max(1e-3, h)
      b.position.y = HIST_Y + h / 2
      ;(b.material as THREE.MeshBasicMaterial).color.copy(
        history[i] > budget ? bad : ok
      )
    }
  })

  const histStep = MAX_W / HISTORY
  return (
    <>
      {/* History of recent frames, with the budget as a horizontal line. */}
      {Array.from({ length: HISTORY }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            bars.current[i] = m
          }}
          position={[X0 + (i + 0.5) * histStep, HIST_Y, 0]}
        >
          <boxGeometry args={[histStep * 0.7, 1, 0.05]} />
          <meshBasicMaterial color={palette.positive} />
        </mesh>
      ))}
      <mesh position={[X0 + MAX_W / 2, HIST_Y + HIST_H, 0.05]}>
        <boxGeometry args={[MAX_W + 0.2, 0.03, 0.02]} />
        <meshBasicMaterial color={palette.foreground} />
      </mesh>
      <mesh position={[X0 + MAX_W / 2, HIST_Y - 0.02, 0]}>
        <boxGeometry args={[MAX_W + 0.2, 0.02, 0.02]} />
        <meshBasicMaterial color={palette.guide} />
      </mesh>

      {/* The current frame: one slice per system. */}
      <mesh position={[X0 + MAX_W / 2, BAR_Y, -0.1]}>
        <boxGeometry args={[MAX_W + 0.1, 0.9, 0.02]} />
        <meshBasicMaterial color={palette.surface} />
      </mesh>
      {SYSTEMS.map((s, i) => (
        <mesh
          key={s.name}
          ref={(m) => {
            slices.current[i] = m
          }}
          position={[X0, BAR_Y, 0]}
        >
          <boxGeometry args={[1, 0.7, 0.05]} />
          <meshBasicMaterial color={s.color} />
        </mesh>
      ))}
      <mesh ref={over} position={[X0, BAR_Y, 0.06]}>
        <boxGeometry args={[1, 0.86, 0.02]} />
        <meshBasicMaterial
          color={palette.negative}
          transparent
          opacity={0.55}
        />
      </mesh>
      <mesh position={[X0 + BUDGET_W, BAR_Y, 0.1]}>
        <boxGeometry args={[0.05, 1.2, 0.02]} />
        <meshBasicMaterial color={palette.foreground} />
      </mesh>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0.2, 0.75, 8.6], target: [0.2, 0.75, 0] },
  grid: false,
  orbit: false,
  params: [
    {
      key: "load",
      label: "Game load",
      min: 0.5,
      max: 2,
      step: 0.05,
      value: 1,
      unit: "×",
    },
    {
      key: "hz",
      label: "Target rate",
      type: "select",
      value: "60",
      options: [
        { value: "30", label: "30 Hz" },
        { value: "60", label: "60 Hz" },
        { value: "120", label: "120 Hz" },
      ],
    },
    {
      key: "spikes",
      label: "GC / loading spikes",
      type: "toggle",
      value: true,
    },
  ],
  readout: (v) => {
    const budget = 1000 / Number(v.hz)
    const t = typicalMs(v.load)
    const shown = Math.ceil(t / budget) * budget
    return `Typical frame ${t.toFixed(1)} ms of ${budget.toFixed(2)} ms (${Math.round((t / budget) * 100)}%) · with vsync shown for ${shown.toFixed(1)} ms = ${(1000 / shown).toFixed(0)} fps`
  },
  Scene,
})
