import { useLayoutEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import {
  ARENA_X,
  ARENA_Y,
  BALL_RADIUS,
  PEG_HIT_RADIUS,
  PEGS,
  TwinRun,
} from "@/lib/fixed-point"

import {
  defineVisual,
  palette,
  useFixedStep,
  useLiveReadout,
  useVisual,
} from "../../kit"

type V = {
  ulps: number
  fixed: boolean
  rate: number
}

const SEED = 86
const COLUMNS = 160
const STEPS_PER_COLUMN = 5
const WINDOW_STEPS = COLUMNS * STEPS_PER_COLUMN
/** A full-looking strip on the first frame, with the climb under way. */
const WARMUP_STEPS = 300
const TRAIL = 120

const SCALE = 0.04
const ARENA_CY = 0.98
const STRIP_LEFT = -4
const STRIP_WIDTH = 8
const STRIP_BOTTOM = -2.66
const STRIP_TOP = -1.22
const LANE_H = 0.15
const BAR_BOTTOM = STRIP_BOTTOM + LANE_H + 0.06
const BAR_TOP = STRIP_TOP - 0.04
const COLUMN_W = STRIP_WIDTH / COLUMNS

const LOG_MIN = -16
const LOG_MAX = Math.log10(240)
const yOfDistance = (d: number) =>
  BAR_BOTTOM +
  ((Math.log10(d) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * (BAR_TOP - BAR_BOTTOM)
const THRESHOLD_Y = yOfDistance(BALL_RADIUS)
const xOfStep = (step: number) =>
  STRIP_LEFT + (step / WINDOW_STEPS) * STRIP_WIDTH
const TICKS = [-16, -12, -8, -4, 0]
const worldX = (x: number) => x * SCALE
const worldY = (y: number) => ARENA_CY + y * SCALE

function createRun(v: V, peak: Float64Array, state: Uint8Array) {
  peak.fill(0)
  state.fill(0)
  return new TwinRun({ seed: SEED, ulps: v.ulps, fixed: v.fixed })
}

/** Four thin quads around a rectangle. */
function Frame({
  cx,
  cy,
  w,
  h,
}: {
  cx: number
  cy: number
  w: number
  h: number
}) {
  const t = 0.025
  const bars: [number, number, number, number][] = [
    [cx, cy + h / 2, w + t, t],
    [cx, cy - h / 2, w + t, t],
    [cx - w / 2, cy, t, h + t],
    [cx + w / 2, cy, t, h + t],
  ]
  return (
    <>
      {bars.map(([x, y, bw, bh]) => (
        <mesh key={`${x},${y}`} position={[x, y, 0]}>
          <planeGeometry args={[bw, bh]} />
          <meshBasicMaterial color={palette.object} toneMapped={false} />
        </mesh>
      ))}
    </>
  )
}

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const peak = useMemo(() => new Float64Array(COLUMNS), [])
  const state = useMemo(() => new Uint8Array(COLUMNS), [])
  const trail = useMemo(
    () => ({
      ax: new Float32Array(TRAIL),
      ay: new Float32Array(TRAIL),
      bx: new Float32Array(TRAIL),
      by: new Float32Array(TRAIL),
    }),
    []
  )
  const runRef = useRef<TwinRun | null>(null)
  const matrix = useMemo(() => new THREE.Matrix4(), [])

  const ballA = useRef<THREE.Mesh>(null)
  const ballB = useRef<THREE.Mesh>(null)
  const trailA = useRef<THREE.InstancedMesh>(null)
  const trailB = useRef<THREE.InstancedMesh>(null)
  const bars = useRef<THREE.InstancedMesh>(null)
  const laneOk = useRef<THREE.InstancedMesh>(null)
  const laneBad = useRef<THREE.InstancedMesh>(null)
  const cursor = useRef<THREE.Mesh>(null)
  const stripMark = useRef<THREE.Group>(null)
  const arenaMark = useRef<THREE.Mesh>(null)

  /** Advances the sim by one step and records it for the strip and the trails. */
  const advance = (run: TwinRun) => {
    run.advance()
    const col = Math.floor(run.step / STEPS_PER_COLUMN)
    if (col < COLUMNS) {
      peak[col] = Math.max(peak[col], run.distance)
      if (!run.matching) state[col] = 2
      else if (state[col] === 0) state[col] = 1
    }
    const slot = run.step % TRAIL
    trail.ax[slot] = run.xOf(0)
    trail.ay[slot] = run.yOf(0)
    trail.bx[slot] = run.xOf(1)
    trail.by[slot] = run.yOf(1)
  }

  const start = () => {
    const run = createRun(v, peak, state)
    trail.ax.fill(run.xOf(0))
    trail.ay.fill(run.yOf(0))
    trail.bx.fill(run.xOf(1))
    trail.by.fill(run.yOf(1))
    for (let i = 0; i < WARMUP_STEPS; i++) advance(run)
    runRef.current = run
  }

  useLayoutEffect(() => {
    start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.ulps, v.fixed, resetKey])

  useFixedStep(() => {
    const run = runRef.current
    if (!run) return
    if (run.step >= WINDOW_STEPS - 1) start()
    else advance(run)
  }, v.rate)

  useFrame(() => {
    const run = runRef.current
    if (!run) return

    ballA.current?.position.set(worldX(run.xOf(0)), worldY(run.yOf(0)), 0.05)
    ballB.current?.position.set(worldX(run.xOf(1)), worldY(run.yOf(1)), 0.06)

    // Trails, newest last. Copy B's is dashed by absolute step, so dashes stay put.
    let nB = 0
    for (let age = 0; age < TRAIL; age++) {
      const absolute = run.step - age
      const slot = ((absolute % TRAIL) + TRAIL) % TRAIL
      const a = 0.026
      matrix
        .makeScale(a, a, 1)
        .setPosition(worldX(trail.ax[slot]), worldY(trail.ay[slot]), 0.01)
      trailA.current?.setMatrixAt(age, matrix)
      if (((absolute % 8) + 8) % 8 < 4) {
        matrix
          .makeScale(0.04, 0.04, 1)
          .setPosition(worldX(trail.bx[slot]), worldY(trail.by[slot]), 0.02)
        trailB.current?.setMatrixAt(nB++, matrix)
      }
    }
    if (trailB.current) {
      trailB.current.count = nB
      trailB.current.instanceMatrix.needsUpdate = true
    }
    if (trailA.current) trailA.current.instanceMatrix.needsUpdate = true

    let nBars = 0
    let nOk = 0
    let nBad = 0
    const laneY = STRIP_BOTTOM + LANE_H / 2 + 0.03
    for (let col = 0; col < COLUMNS; col++) {
      if (state[col] === 0) continue
      const x = STRIP_LEFT + (col + 0.5) * COLUMN_W
      if (peak[col] > 0) {
        const top = Math.max(yOfDistance(peak[col]), BAR_BOTTOM + 0.02)
        matrix
          .makeScale(COLUMN_W * 0.8, top - BAR_BOTTOM, 1)
          .setPosition(x, (top + BAR_BOTTOM) / 2, 0.01)
        bars.current?.setMatrixAt(nBars++, matrix)
      }
      // Agreeing checksums make a thin solid line, differing ones tall ticks.
      if (state[col] === 1) {
        matrix.makeScale(COLUMN_W, LANE_H * 0.4, 1).setPosition(x, laneY, 0.01)
        laneOk.current?.setMatrixAt(nOk++, matrix)
      } else if (col % 2 === 0) {
        matrix.makeScale(COLUMN_W * 0.9, LANE_H, 1).setPosition(x, laneY, 0.01)
        laneBad.current?.setMatrixAt(nBad++, matrix)
      }
    }
    const counts: [THREE.InstancedMesh | null, number][] = [
      [bars.current, nBars],
      [laneOk.current, nOk],
      [laneBad.current, nBad],
    ]
    for (const [m, n] of counts) {
      if (!m) continue
      m.count = n
      m.instanceMatrix.needsUpdate = true
    }

    if (cursor.current) cursor.current.position.x = xOfStep(run.step)

    const split = run.splitStep
    if (stripMark.current) {
      stripMark.current.visible = split !== null
      if (split !== null) stripMark.current.position.x = xOfStep(split)
    }
    if (arenaMark.current) {
      arenaMark.current.visible = split !== null
      if (split !== null) {
        arenaMark.current.position.set(
          worldX(run.splitX),
          worldY(run.splitY),
          0.04
        )
      }
    }
  })

  useLiveReadout(() => {
    const run = runRef.current
    if (!run) return null
    const distance =
      run.distance === 0
        ? "0"
        : run.distance.toExponential(1).replace("e+", "e")
    let sums = "checksums match"
    if (!run.matching) sums = `checksums differ since step ${run.firstMismatch}`
    else if (run.firstMismatch !== null) {
      sums = `checksums match again (first differed at step ${run.firstMismatch})`
    }
    const split =
      run.splitStep === null ? "no split" : `split at step ${run.splitStep}`
    return `Step ${run.step} · distance ${distance} units · ${sums} · ${split}`
  })

  const pegRadius = (PEG_HIT_RADIUS - BALL_RADIUS) * SCALE
  const ballRadius = BALL_RADIUS * SCALE
  const thresholdDashes = useMemo(() => {
    const out: number[] = []
    for (let x = STRIP_LEFT + 0.08; x < STRIP_LEFT + STRIP_WIDTH; x += 0.26) {
      out.push(x)
    }
    return out
  }, [])

  return (
    <>
      <Frame
        cx={0}
        cy={ARENA_CY}
        w={(2 * ARENA_X + 2 * BALL_RADIUS) * SCALE}
        h={(2 * ARENA_Y + 2 * BALL_RADIUS) * SCALE}
      />
      {PEGS.map(([x, y]) => (
        <mesh key={`${x},${y}`} position={[worldX(x), worldY(y), 0]}>
          <circleGeometry args={[pegRadius, 32]} />
          <meshBasicMaterial color={palette.object} toneMapped={false} />
        </mesh>
      ))}

      <instancedMesh
        ref={trailA}
        args={[undefined, undefined, TRAIL]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.subject} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={trailB}
        args={[undefined, undefined, TRAIL]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.moving} toneMapped={false} />
      </instancedMesh>

      <mesh ref={arenaMark} scale={0.3} visible={false}>
        <circleGeometry args={[0.5, 4]} />
        <meshBasicMaterial color={palette.error} toneMapped={false} />
      </mesh>
      <mesh ref={ballA}>
        <circleGeometry args={[ballRadius, 24]} />
        <meshBasicMaterial color={palette.subject} toneMapped={false} />
      </mesh>
      <mesh ref={ballB}>
        <ringGeometry args={[ballRadius * 1.25, ballRadius * 1.7, 28]} />
        <meshBasicMaterial color={palette.moving} toneMapped={false} />
      </mesh>

      <Frame
        cx={0}
        cy={(STRIP_BOTTOM + STRIP_TOP) / 2}
        w={STRIP_WIDTH}
        h={STRIP_TOP - STRIP_BOTTOM}
      />
      {TICKS.map((power) => {
        const y = yOfDistance(10 ** power)
        return (
          <mesh key={power} position={[STRIP_LEFT + 0.05, y, 0.02]}>
            <planeGeometry args={[0.1, 0.02]} />
            <meshBasicMaterial color={palette.accel} toneMapped={false} />
          </mesh>
        )
      })}
      {thresholdDashes.map((x) => (
        <mesh key={x} position={[x, THRESHOLD_Y, 0.02]}>
          <planeGeometry args={[0.14, 0.022]} />
          <meshBasicMaterial color={palette.accel} toneMapped={false} />
        </mesh>
      ))}

      <instancedMesh
        ref={bars}
        args={[undefined, undefined, COLUMNS]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.tertiary} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={laneOk}
        args={[undefined, undefined, COLUMNS]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.success} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={laneBad}
        args={[undefined, undefined, COLUMNS]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.error} toneMapped={false} />
      </instancedMesh>

      <mesh
        ref={cursor}
        position={[STRIP_LEFT, (STRIP_BOTTOM + STRIP_TOP) / 2, 0.03]}
      >
        <planeGeometry args={[0.035, STRIP_TOP - STRIP_BOTTOM]} />
        <meshBasicMaterial color={palette.subject} toneMapped={false} />
      </mesh>
      <group ref={stripMark} visible={false}>
        <mesh position={[0, (BAR_BOTTOM + BAR_TOP) / 2, 0.04]}>
          <planeGeometry args={[0.05, BAR_TOP - BAR_BOTTOM]} />
          <meshBasicMaterial color={palette.error} toneMapped={false} />
        </mesh>
        <mesh position={[0, THRESHOLD_Y, 0.05]} scale={0.34}>
          <circleGeometry args={[0.5, 4]} />
          <meshBasicMaterial color={palette.error} toneMapped={false} />
        </mesh>
      </group>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 0.2, 7.6], target: [0, 0.2, 0] },
  orbit: false,
  params: [
    {
      key: "ulps",
      label: "Starting difference",
      min: 0,
      max: 16,
      step: 1,
      value: 1,
      unit: " ulp",
    },
    {
      key: "fixed",
      label: "Fixed-point (Q16.16)",
      type: "toggle",
      value: false,
    },
    {
      key: "rate",
      label: "Step rate",
      min: 30,
      max: 480,
      step: 30,
      value: 120,
      unit: " /s",
    },
  ],
  readout: (v) =>
    v.fixed
      ? "Both starts round to the same Q16.16 integer, so the copies never differ"
      : `Copy B's velocity starts ${v.ulps} representable steps from copy A's`,
  Scene,
})
