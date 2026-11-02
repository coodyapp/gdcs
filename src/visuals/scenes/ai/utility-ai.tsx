import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import {
  ACTION_COUNT,
  ACTION_NAMES,
  COVER,
  EAT,
  FOOD,
  HISTORY,
  WANDER,
  responseCurve,
  runWorld,
  stepWorld,
  switchesPerMinute,
  type CurveKind,
  type WorldParams,
  type WorldSim,
} from "@/lib/utility-ai"

import {
  defineVisual,
  palette,
  useFixedStep,
  useLiveReadout,
  useVisual,
  type Vec3,
} from "../../kit"

type V = { danger: number; hungerRate: number; bonus: number; curve: string }

const SEED = 20261102
const WARM_UP_SECONDS = 40
const SIM_HZ = 30
const SWITCH_FLASH = 0.6

// The canvas is split into world (top left), score bars (top right), curve and
// inputs (middle right) and two decision timelines (bottom).
const WORLD_X = -3.05
const WORLD_Y = 1.15
const WORLD_W = 2.7
const WORLD_H = 2.3
const wx = (x: number) => WORLD_X + x * WORLD_W
const wy = (y: number) => WORLD_Y + y * WORLD_H

const BAR_X = 0.85
const BAR_UNIT = 3.1
const BAR_H = 0.44
const BAR_Y = [3.1, 2.42, 1.74]

const PLOT = { x: 0.3, y: -1.05, w: 3.0, h: 2.05 }
const GAUGE = { y: -1.05, h: 1.55, w: 0.42 }
const GAUGE_X = [4.2, 5.1]

const STRIP_LEFT = -5.75
const STRIP_W = 11.5
const SAMPLE_W = STRIP_W / HISTORY
const STRIP_Y = [-1.95, -3.05]
const LANE = 0.3

const rect = (w: number, h: number): Vec3[] => [
  [0, -h / 2, 0],
  [w, -h / 2, 0],
  [w, h / 2, 0],
  [0, h / 2, 0],
  [0, -h / 2, 0],
]

// Stroke letters, so bars read without loading a font.
const GLYPH: [number, number][][] = [
  [
    [1, 1],
    [0, 1],
    [0, 0.5],
    [0.8, 0.5],
    [0, 0.5],
    [0, 0],
    [1, 0],
  ],
  [
    [0, 1],
    [0, 0],
    [0, 0.5],
    [1, 0.5],
    [1, 1],
    [1, 0],
  ],
  [
    [0, 1],
    [0.25, 0],
    [0.5, 0.6],
    [0.75, 0],
    [1, 1],
  ],
]
const glyphPoints = (i: number, w = 0.26, h = 0.34): Vec3[] =>
  GLYPH[i].map(([x, y]) => [(x - 0.5) * w, (y - 0.5) * h, 0])

const circlePoints = (segments: number): Vec3[] =>
  Array.from({ length: segments + 1 }, (_, i) => {
    const a = (i / segments) * Math.PI * 2
    return [Math.cos(a), Math.sin(a), 0]
  })

function paramsFrom(v: V): WorldParams {
  return {
    danger: v.danger,
    hungerRate: v.hungerRate,
    bonus: v.bonus,
    curve: v.curve as CurveKind,
  }
}

const tmpMatrix = new THREE.Matrix4()

/** Writes one timeline: a quad per decision, plus a tall red tick per switch. */
function writeStrip(
  sim: WorldSim,
  centerY: number,
  dashed: boolean,
  lanes: THREE.InstancedMesh,
  ticks: THREE.InstancedMesh
) {
  let laneCount = 0
  let tickCount = 0
  const samples = Math.min(sim.decisions, HISTORY)
  const newest = sim.decisions - 1
  for (let age = 0; age < samples; age++) {
    const action = sim.history[(newest - age) % HISTORY]
    const x = STRIP_LEFT + STRIP_W - (age + 0.5) * SAMPLE_W
    // Alternate samples missing = a dashed strip, readable without colour.
    if (!dashed || (newest - age) % 4 < 2) {
      tmpMatrix.makeScale(SAMPLE_W * 1.02, 0.1, 1)
      tmpMatrix.setPosition(x, centerY + (1 - action) * LANE, 0)
      lanes.setMatrixAt(laneCount++, tmpMatrix)
    }
    if (age + 1 < samples) {
      const previous = sim.history[(newest - age - 1) % HISTORY]
      if (previous !== action) {
        tmpMatrix.makeScale(0.045, LANE * 2 + 0.2, 1)
        tmpMatrix.setPosition(x - SAMPLE_W / 2, centerY, 0.01)
        ticks.setMatrixAt(tickCount++, tmpMatrix)
      }
    }
  }
  lanes.count = laneCount
  lanes.instanceMatrix.needsUpdate = true
  ticks.count = tickCount
  ticks.instanceMatrix.needsUpdate = true
}

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const params = paramsFrom(v)
  const noBonus = { ...params, bonus: 0 }

  // Same seed, same noise. Warmed up so the timelines and readout are already
  // full on the first frame, and so any param change shows its effect at once.
  const sims = useMemo(
    () => ({
      live: runWorld(SEED, params, WARM_UP_SECONDS, 1 / SIM_HZ),
      base: runWorld(SEED, noBonus, WARM_UP_SECONDS, 1 / SIM_HZ),
      lastDrawn: -1,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rerun on Reset too
    [v.danger, v.hungerRate, v.bonus, v.curve, resetKey]
  )

  useFixedStep((dt) => {
    stepWorld(sims.live, params, dt)
    stepWorld(sims.base, noBonus, dt)
  }, SIM_HZ)

  useLiveReadout(() => {
    const { live, base } = sims
    const scores = ACTION_NAMES.map(
      (name, i) => `${name} ${live.scores[i].toFixed(2)}`
    ).join(" · ")
    const rate = switchesPerMinute(live).toFixed(0)
    const rateBase = switchesPerMinute(base).toFixed(0)
    return `Chosen: ${ACTION_NAMES[live.action]} · ${scores} · ${rate} switches/min (${rateBase} with no bonus)`
  })

  const curvePoints = useMemo<Vec3[]>(
    () =>
      Array.from({ length: 49 }, (_, i) => {
        const x = i / 48
        return [
          PLOT.x + x * PLOT.w,
          PLOT.y + responseCurve(v.curve as CurveKind, x) * PLOT.h,
          0,
        ]
      }),
    [v.curve]
  )
  const circle = useMemo(() => circlePoints(48), [])

  const agent = useRef<THREE.Group>(null)
  const dots = useRef<(THREE.Mesh | null)[]>([])
  const burst = useRef<THREE.Mesh>(null)
  const burstMat = useRef<THREE.MeshBasicMaterial>(null)
  const dangerRing = useRef<THREE.Group>(null)
  const badges = useRef<(THREE.Group | null)[]>([])
  const fills = useRef<(THREE.Mesh | null)[]>([])
  const outlines = useRef<(THREE.Group | null)[]>([])
  const bonusBox = useRef<THREE.Group>(null)
  const switchMark = useRef<THREE.Mesh>(null)
  const hungerDot = useRef<THREE.Mesh>(null)
  const dangerDot = useRef<THREE.Group>(null)
  const hungerFill = useRef<THREE.Mesh>(null)
  const dangerFill = useRef<THREE.Mesh>(null)
  const liveLanes = useRef<THREE.InstancedMesh>(null)
  const baseLanes = useRef<THREE.InstancedMesh>(null)
  const liveTicks = useRef<THREE.InstancedMesh>(null)
  const baseTicks = useRef<THREE.InstancedMesh>(null)

  useFrame(() => {
    const { live, base } = sims
    const ax = wx(live.x)
    const ay = wy(live.y)
    agent.current?.position.set(ax, ay, 0.1)

    // Dotted path to where the chosen action is taking the agent.
    const goalX = live.action === EAT ? wx(FOOD.x) : wx(COVER.x)
    const goalY = wy(FOOD.y)
    dots.current.forEach((dot, i) => {
      if (!dot) return
      dot.visible = live.action !== WANDER
      const k = (i + 1) / (dots.current.length + 1)
      dot.position.set(ax + (goalX - ax) * k, ay + (goalY - ay) * k, 0.05)
    })

    const sinceSwitch = live.time - live.lastSwitch
    const flashing = sinceSwitch < SWITCH_FLASH
    if (burst.current && burstMat.current) {
      burst.current.visible = flashing
      burst.current.scale.setScalar(1 + sinceSwitch * 1.6)
      burstMat.current.opacity = 1 - sinceSwitch / SWITCH_FLASH
    }
    if (switchMark.current) {
      switchMark.current.visible = flashing
      switchMark.current.position.set(0.05, BAR_Y[live.action], 0.05)
    }
    dangerRing.current?.scale.setScalar(0.2 + live.danger * 1)

    for (let i = 0; i < ACTION_COUNT; i++) {
      const on = i === live.action
      const length = Math.max(0.001, live.scores[i] * BAR_UNIT)
      const fill = fills.current[i]
      if (fill) {
        fill.visible = on
        fill.scale.x = length
        fill.position.x = BAR_X + length / 2
      }
      const outline = outlines.current[i]
      if (outline) {
        outline.visible = !on
        outline.scale.x = length
      }
      const badge = badges.current[i]
      if (badge) badge.visible = on
    }
    if (bonusBox.current) {
      const length = live.scores[live.action] * BAR_UNIT
      bonusBox.current.visible = v.bonus > 0
      bonusBox.current.position.set(BAR_X + length, BAR_Y[live.action], 0.02)
      bonusBox.current.scale.x = Math.max(0.001, length * v.bonus)
    }

    const curve = v.curve as CurveKind
    hungerDot.current?.position.set(
      PLOT.x + live.hunger * PLOT.w,
      PLOT.y + responseCurve(curve, live.hunger) * PLOT.h,
      0.05
    )
    dangerDot.current?.position.set(
      PLOT.x + live.danger * PLOT.w,
      PLOT.y + responseCurve(curve, live.danger) * PLOT.h,
      0.05
    )
    if (hungerFill.current) {
      const h = Math.max(0.001, live.hunger * GAUGE.h)
      hungerFill.current.scale.y = h
      hungerFill.current.position.y = GAUGE.y + h / 2
    }
    if (dangerFill.current) {
      const h = Math.max(0.001, live.danger * GAUGE.h)
      dangerFill.current.scale.y = h
      dangerFill.current.position.y = GAUGE.y + h / 2
    }

    if (
      live.decisions !== sims.lastDrawn &&
      liveLanes.current &&
      liveTicks.current &&
      baseLanes.current &&
      baseTicks.current
    ) {
      sims.lastDrawn = live.decisions
      writeStrip(live, STRIP_Y[0], false, liveLanes.current, liveTicks.current)
      writeStrip(base, STRIP_Y[1], true, baseLanes.current, baseTicks.current)
    }
  })

  return (
    <>
      {/* World */}
      <Line
        points={[
          [wx(-1.03), wy(-1.03), 0],
          [wx(1.03), wy(-1.03), 0],
          [wx(1.03), wy(1.03), 0],
          [wx(-1.03), wy(1.03), 0],
          [wx(-1.03), wy(-1.03), 0],
        ]}
        color={palette.guide}
        lineWidth={1}
      />
      <mesh position={[wx(FOOD.x), wy(FOOD.y), 0]}>
        <circleGeometry args={[0.3, 32]} />
        <meshBasicMaterial color={palette.success} toneMapped={false} />
      </mesh>
      <group position={[wx(COVER.x) - 0.42, wy(COVER.y), 0]}>
        <Line points={rect(0.84, 0.72)} color={palette.accel} lineWidth={2.5} />
      </group>
      <group position={[0, wy(0.5), 0]}>
        <group position={[wx(0), 0, 0]}>
          <mesh position={[0, -0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
            <circleGeometry args={[0.13, 3]} />
            <meshBasicMaterial color={palette.error} toneMapped={false} />
          </mesh>
          <group ref={dangerRing}>
            <Line
              points={circle}
              color={palette.error}
              lineWidth={1.5}
              dashed
              dashSize={0.12}
              gapSize={0.09}
            />
          </group>
        </group>
      </group>
      {Array.from({ length: 5 }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            dots.current[i] = m
          }}
        >
          <circleGeometry args={[0.04, 10]} />
          <meshBasicMaterial color={palette.moving} toneMapped={false} />
        </mesh>
      ))}
      <group ref={agent}>
        <mesh>
          <circleGeometry args={[0.2, 28]} />
          <meshBasicMaterial color={palette.subject} toneMapped={false} />
        </mesh>
        {ACTION_NAMES.map((name, i) => (
          <group
            key={name}
            position={[0, 0.42, 0]}
            ref={(g) => {
              badges.current[i] = g
            }}
          >
            <Line
              points={glyphPoints(i)}
              color={palette.foreground}
              lineWidth={2}
            />
          </group>
        ))}
        <mesh ref={burst}>
          <ringGeometry args={[0.3, 0.37, 36]} />
          <meshBasicMaterial
            ref={burstMat}
            color={palette.error}
            toneMapped={false}
            transparent
          />
        </mesh>
      </group>

      {/* Score bars: yellow solid = winner, grey outline = the rest. */}
      {ACTION_NAMES.map((name, i) => (
        <group key={name}>
          <group position={[0.5, BAR_Y[i], 0]}>
            <Line
              points={glyphPoints(i)}
              color={palette.foreground}
              lineWidth={2}
            />
          </group>
          <mesh
            position={[BAR_X, BAR_Y[i], 0]}
            ref={(m) => {
              fills.current[i] = m
            }}
          >
            <planeGeometry args={[1, BAR_H]} />
            <meshBasicMaterial color={palette.moving} toneMapped={false} />
          </mesh>
          <group
            position={[BAR_X, BAR_Y[i], 0]}
            ref={(g) => {
              outlines.current[i] = g
            }}
          >
            <Line
              points={rect(1, BAR_H)}
              color={palette.tertiary}
              lineWidth={2}
            />
          </group>
        </group>
      ))}
      <group ref={bonusBox}>
        <Line points={rect(1, BAR_H)} color={palette.moving} lineWidth={1.5} />
      </group>
      <mesh ref={switchMark} rotation={[0, 0, 0]}>
        <circleGeometry args={[0.2, 3]} />
        <meshBasicMaterial color={palette.error} toneMapped={false} />
      </mesh>
      {/* Score = 1 */}
      <Line
        points={[
          [BAR_X + BAR_UNIT, BAR_Y[0] + 0.32, 0],
          [BAR_X + BAR_UNIT, BAR_Y[2] - 0.32, 0],
        ]}
        color={palette.guide}
        lineWidth={1}
        dashed
        dashSize={0.08}
        gapSize={0.08}
      />

      {/* Response curve */}
      <Line
        points={[
          [PLOT.x, PLOT.y + PLOT.h, 0],
          [PLOT.x, PLOT.y, 0],
          [PLOT.x + PLOT.w, PLOT.y, 0],
        ]}
        color={palette.guide}
        lineWidth={1}
      />
      <Line points={curvePoints} color={palette.subject} lineWidth={2.5} />
      <mesh ref={hungerDot}>
        <circleGeometry args={[0.12, 20]} />
        <meshBasicMaterial color={palette.subject} toneMapped={false} />
      </mesh>
      <group ref={dangerDot}>
        <mesh position={[0, -0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
          <circleGeometry args={[0.15, 3]} />
          <meshBasicMaterial color={palette.error} toneMapped={false} />
        </mesh>
      </group>

      {/* Inputs: circle = hunger, triangle = danger */}
      <mesh position={[GAUGE_X[0], GAUGE.y + GAUGE.h + 0.24, 0]}>
        <circleGeometry args={[0.12, 20]} />
        <meshBasicMaterial color={palette.subject} toneMapped={false} />
      </mesh>
      <group position={[GAUGE_X[1], GAUGE.y + GAUGE.h + 0.22, 0]}>
        <mesh position={[0, -0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
          <circleGeometry args={[0.15, 3]} />
          <meshBasicMaterial color={palette.error} toneMapped={false} />
        </mesh>
      </group>
      {GAUGE_X.map((x, i) => (
        <group key={x}>
          <group position={[x - GAUGE.w / 2, GAUGE.y + GAUGE.h / 2, 0.02]}>
            <Line
              points={rect(GAUGE.w, GAUGE.h)}
              color={palette.tertiary}
              lineWidth={1.5}
            />
          </group>
          <mesh
            position={[x, GAUGE.y, 0]}
            ref={i === 0 ? hungerFill : dangerFill}
          >
            <planeGeometry args={[GAUGE.w, 1]} />
            <meshBasicMaterial
              color={i === 0 ? palette.subject : palette.error}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {/* Timelines: top = this bonus (solid), bottom = no bonus (dashed). */}
      <instancedMesh
        ref={liveLanes}
        args={[undefined, undefined, HISTORY]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.subject} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={baseLanes}
        args={[undefined, undefined, HISTORY]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.tertiary} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={liveTicks}
        args={[undefined, undefined, HISTORY]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.error} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={baseTicks}
        args={[undefined, undefined, HISTORY]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.error} toneMapped={false} />
      </instancedMesh>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 0, 14.4], target: [0, 0, 0], fov: 30 },
  orbit: false,
  grid: false,
  params: [
    {
      key: "bonus",
      label: "Commitment bonus",
      min: 0,
      max: 0.5,
      step: 0.05,
      value: 0.2,
      digits: 2,
    },
    {
      key: "danger",
      label: "Danger",
      min: 0,
      max: 1,
      step: 0.05,
      value: 0.5,
      digits: 2,
    },
    {
      key: "hungerRate",
      label: "Hunger rate",
      min: 0.01,
      max: 0.12,
      step: 0.01,
      value: 0.04,
      unit: "/s",
      digits: 2,
    },
    {
      key: "curve",
      label: "Curve shape",
      type: "select",
      value: "linear",
      options: [
        { value: "linear", label: "Linear" },
        { value: "quadratic", label: "Quadratic" },
        { value: "logistic", label: "Logistic" },
      ],
    },
  ],
  readout: (v) =>
    v.bonus > 0
      ? `The running action scores +${(v.bonus * 100).toFixed(0)}% when it defends its place.`
      : "No commitment bonus: the top strip now matches the dashed one.",
  Scene,
})
