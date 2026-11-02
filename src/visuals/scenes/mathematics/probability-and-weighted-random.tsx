import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import {
  bagCounts,
  mulberry32,
  ShuffleBag,
  weightedPick,
  worstBagDrought,
} from "@/lib/weighted-random"

import { defineVisual, palette, useVisual, useLiveReadout } from "../../kit"

type V = { rare: number; rate: number; mode: string }

const SEED = 20261102
const RARE = 3
const RUN_ROLLS = 1500
const RUN_SECONDS = 40
const HOLD_SECONDS = 1.5
const SETTLE = 12

// Histogram: probability × Y_SCALE = bar height, clamped for the first rolls.
const Y_SCALE = 8.5
const MAX_HEIGHT = 5.6
const BAR_XS = [-4.5, -1.5, 1.5, 4.5]
const BAR_W = 2.2
const BAR_D = 1.2
// Drought meter under the bars: one unit of length per DROUGHT_U rolls.
const METER_X = -5.6
const METER_Y = -0.75
const METER_W = 11.2
const METER_ROLLS = 160
const METER_TICKS = [20, 40, 60, 80, 100, 120, 140]
const DROUGHT_U = METER_W / METER_ROLLS
const LONGEST_H = 0.34
const CURRENT_H = 0.12

const pct = (x: number) => `${(x * 100).toFixed(1)}%`

interface Run {
  rand: () => number
  bag: ShuffleBag
  counts: Int32Array
  rolls: number
  drought: number
  longest: number
  elapsed: number
  acc: number
  hold: number
  pulse: number
}

function Scene({ v }: { v: V }) {
  const { playing, resetKey } = useVisual()
  const useBag = v.mode === "bag"
  const weights = useMemo(() => [60, 25, 10, v.rare], [v.rare])
  const total = 95 + v.rare
  const copies = useMemo(() => bagCounts(weights), [weights])
  const bagSize = copies.reduce((sum, c) => sum + c, 0)
  const ceiling = worstBagDrought(bagSize, copies[RARE])

  const run = useRef<Run | null>(null)
  const heights = useRef([0, 0, 0, 0])
  const bars = useRef<(THREE.Mesh | null)[]>([])
  const longest = useRef<THREE.Mesh>(null)
  const current = useRef<THREE.Mesh>(null)
  const flash = useRef<THREE.Mesh>(null)

  // A new setting or Reset replays from the same seed. Periodic restarts keep
  // drawing from the same stream, so each run differs but stays reproducible.
  useEffect(() => {
    const rand = mulberry32(SEED)
    run.current = {
      rand,
      bag: new ShuffleBag(copies, rand),
      counts: new Int32Array(weights.length),
      rolls: 0,
      drought: 0,
      longest: 0,
      elapsed: 0,
      acc: 0,
      hold: 0,
      pulse: 0,
    }
  }, [copies, weights, useBag, resetKey])

  useLiveReadout(() => {
    const r = run.current
    if (!r) return null
    const seen = r.rolls ? r.counts[RARE] / r.rolls : 0
    const cap = useBag ? ` of at most ${ceiling}` : ", no upper limit"
    return (
      `${r.rolls} rolls · rare ${pct(seen)} observed vs ${pct(v.rare / total)} expected · ` +
      `longest drought ${r.longest}${cap}`
    )
  })

  useFrame((_, delta) => {
    const r = run.current
    if (!r) return
    const dt = Math.min(delta, 0.1)
    if (playing) {
      if (r.hold > 0) {
        r.hold -= dt
        if (r.hold <= 0) {
          r.counts.fill(0)
          r.rolls = r.drought = r.longest = r.elapsed = r.acc = 0
          r.bag.reset()
        }
      } else {
        r.elapsed += dt
        r.acc += dt * v.rate
        while (r.acc >= 1 && r.rolls < RUN_ROLLS) {
          r.acc -= 1
          const item = useBag ? r.bag.next() : weightedPick(weights, r.rand)
          r.counts[item]++
          r.rolls++
          if (item === RARE) {
            r.drought = 0
            r.pulse = 1
          } else {
            r.drought++
            if (r.drought > r.longest) r.longest = r.drought
          }
        }
        if (r.rolls >= RUN_ROLLS || r.elapsed >= RUN_SECONDS)
          r.hold = HOLD_SECONDS
      }
      r.pulse = Math.max(0, r.pulse - dt * 5)
    }

    const ease = 1 - Math.exp(-SETTLE * dt)
    for (let i = 0; i < BAR_XS.length; i++) {
      const seen = r.rolls ? r.counts[i] / r.rolls : 0
      const target = Math.min(seen * Y_SCALE, MAX_HEIGHT)
      heights.current[i] += (target - heights.current[i]) * ease
      const h = Math.max(heights.current[i], 0.001)
      const bar = bars.current[i]
      if (bar) {
        bar.scale.y = h
        bar.position.y = h / 2
      }
    }
    if (flash.current) {
      flash.current.visible = r.pulse > 0
      flash.current.position.y = heights.current[RARE] + 0.12
      flash.current.scale.y = Math.max(r.pulse, 0.001)
    }
    if (longest.current) {
      const w = Math.max(Math.min(r.longest, METER_ROLLS) * DROUGHT_U, 0.001)
      longest.current.scale.x = w
      longest.current.position.x = METER_X + w / 2
    }
    if (current.current) {
      const w = Math.max(Math.min(r.drought, METER_ROLLS) * DROUGHT_U, 0.001)
      current.current.scale.x = w
      current.current.position.x = METER_X + w / 2
    }
  })

  return (
    <>
      {BAR_XS.map((x, i) => (
        <group key={x}>
          <mesh
            ref={(m) => {
              bars.current[i] = m
            }}
            position={[x, 0, 0]}
          >
            <boxGeometry args={[BAR_W, 1, BAR_D]} />
            <meshStandardMaterial
              color={i === RARE ? palette.subject : palette.tertiary}
              roughness={0.7}
            />
          </mesh>
          {/* Target: the configured probability, wider than the bar. */}
          <mesh position={[x, (weights[i] / total) * Y_SCALE, 0]}>
            <boxGeometry args={[BAR_W + 0.5, 0.1, BAR_D + 0.1]} />
            <meshBasicMaterial color={palette.success} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* Yellow cap: pulses each time the rare item actually drops. */}
      <mesh ref={flash} position={[BAR_XS[RARE], 0, 0]}>
        <boxGeometry args={[BAR_W, 0.2, BAR_D]} />
        <meshBasicMaterial color={palette.moving} toneMapped={false} />
      </mesh>
      {/* Floor line under the histogram. */}
      <mesh position={[0, -0.04, 0]}>
        <boxGeometry args={[METER_W, 0.08, BAR_D]} />
        <meshBasicMaterial color={palette.tertiary} toneMapped={false} />
      </mesh>

      {/* Drought meter: track, then longest (thick) and current (thin). */}
      <mesh position={[0, METER_Y, 0]}>
        <boxGeometry args={[METER_W, LONGEST_H + 0.14, 0.2]} />
        <meshBasicMaterial color={palette.surface} toneMapped={false} />
      </mesh>
      <mesh ref={longest} position={[METER_X, METER_Y, 0.12]}>
        <boxGeometry args={[1, LONGEST_H, 0.04]} />
        <meshBasicMaterial color={palette.error} toneMapped={false} />
      </mesh>
      <mesh ref={current} position={[METER_X, METER_Y, 0.16]}>
        <boxGeometry args={[1, CURRENT_H, 0.04]} />
        <meshBasicMaterial color={palette.moving} toneMapped={false} />
      </mesh>
      {METER_TICKS.map((n) => (
        <mesh key={n} position={[METER_X + n * DROUGHT_U, METER_Y - 0.33, 0]}>
          <boxGeometry args={[0.05, 0.16, 0.05]} />
          <meshBasicMaterial color={palette.tertiary} toneMapped={false} />
        </mesh>
      ))}
      {/* A bag guarantees a ceiling; pure random has none to draw. */}
      {useBag && (
        <mesh position={[METER_X + ceiling * DROUGHT_U, METER_Y, 0.2]}>
          <boxGeometry args={[0.09, LONGEST_H + 0.42, 0.05]} />
          <meshBasicMaterial color={palette.success} toneMapped={false} />
        </mesh>
      )}
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 2.9, 15.6], target: [0, 2.2, 0], fov: 30 },
  grid: false,
  params: [
    {
      key: "rare",
      label: "Rare item weight",
      min: 5,
      max: 40,
      step: 5,
      value: 5,
    },
    {
      key: "rate",
      label: "Rolls per second",
      min: 10,
      max: 300,
      step: 10,
      value: 90,
    },
    {
      key: "mode",
      label: "Source",
      type: "select",
      value: "random",
      options: [
        { value: "random", label: "Pure random" },
        { value: "bag", label: "Shuffle bag" },
      ],
    },
  ],
  readout: (v) =>
    `Weights 60 / 25 / 10 / ${v.rare} · rare ${pct(v.rare / (95 + v.rare))} expected`,
  Scene,
})
