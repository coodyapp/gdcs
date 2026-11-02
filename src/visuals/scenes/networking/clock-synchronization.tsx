import { useMemo, useRef } from "react"
import { Line } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { simulateClockSync, TICK_MS, trueOffsetAt } from "@/lib/clock-sync"

import {
  clamp,
  defineVisual,
  palette,
  useClock,
  useLiveReadout,
  useVisual,
} from "../../kit"

type Method = "filter-slew" | "filter-step" | "raw-slew" | "raw-step"
type V = { jitter: number; asymmetry: number; drift: number; method: Method }

/** Network time runs at a fifth of real time so the pings can be followed. */
const SLOW = 0.2
const RUN_MS = 60_000
const PING_HZ = 5
const BASE_MS = 50
const HOLD_MS = 20
const INITIAL_OFFSET_MS = 250
const STRIP_MS = 12_000
/** The loop starts this far in, so the strip is already full. */
const START_MS = STRIP_MS + 500

const LEFT = -5.8
const RIGHT = 5.8
/** Lines stop here, so that their ends stay inside the tape and the strip. */
const LINE_LEFT = LEFT + 0.04
/** Where "now" sits on the tapes. To its right, the tapes show what is ahead. */
const NOW_X = 4.1
const TAPE_UNITS_PER_MS = 0.02
const TICK_EVERY_MS = 50
const MAJOR_EVERY = 5
const SERVER_Y = 2.4
const CLIENT_Y = 1.1
const TAPE_H = 0.32
/** Kept below the play/reset buttons, which cards do not have. */
const CARD_SHIFT_Y = 0.45

const STRIP_TOP = 0.45
const STRIP_BOTTOM = -3.55
const STRIP_MID = (STRIP_TOP + STRIP_BOTTOM) / 2
const STRIP_NOW_X = 5.2
const STRIP_UNITS_PER_MS = (STRIP_NOW_X - LEFT) / STRIP_MS

const LINE_STRIDE = 2
const MAX_SEGMENTS = Math.ceil(STRIP_MS / TICK_MS / LINE_STRIDE) + 2
const MAX_TICKS = 16
const MAX_LEGS = 16
const MAX_DOTS = Math.ceil((STRIP_MS / 1000) * PING_HZ) + 12
const MAX_CROSS_BARS = 240

/** Half the strip's height in ms, so the samples and the slope both fit. */
const stripRangeMs = (v: V) =>
  Math.max(
    30,
    Math.ceil(
      (1.5 * v.jitter +
        Math.abs(v.asymmetry) / 2 +
        (v.drift * 1e-6 * STRIP_MS) / 2 +
        6) /
        10
    ) * 10
  )

function Scene({ v }: { v: V }) {
  const time = useClock()
  const { compact } = useVisual()
  const config = useMemo(
    () => ({
      baseMs: BASE_MS,
      asymmetryMs: v.asymmetry,
      jitterMs: v.jitter,
      holdMs: HOLD_MS,
      initialOffsetMs: INITIAL_OFFSET_MS,
      driftPpm: v.drift,
      durationMs: RUN_MS,
      pingHz: PING_HZ,
      filter: v.method.startsWith("filter"),
      correction: v.method.endsWith("slew")
        ? ("slew" as const)
        : ("step" as const),
    }),
    [v.asymmetry, v.jitter, v.drift, v.method]
  )
  const run = useMemo(() => simulateClockSync(config), [config])
  const latest = useRef({ config, run, range: stripRangeMs(v) })
  latest.current = { config, run, range: stripRangeMs(v) }

  const serverTicks = useRef<THREE.InstancedMesh>(null)
  const clientTicks = useRef<THREE.InstancedMesh>(null)
  const outLegs = useRef<THREE.InstancedMesh>(null)
  const backLegs = useRef<THREE.InstancedMesh>(null)
  const outTips = useRef<THREE.InstancedMesh>(null)
  const backTips = useRef<THREE.InstancedMesh>(null)
  const line = useRef<THREE.InstancedMesh>(null)
  const dots = useRef<THREE.InstancedMesh>(null)
  const crosses = useRef<THREE.InstancedMesh>(null)
  const pickRing = useRef<THREE.Mesh>(null)
  const stripBar = useRef<THREE.Mesh>(null)
  const tapeBar = useRef<THREE.Mesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const networkNow = () =>
    START_MS + ((time.current * 1000 * SLOW) % (RUN_MS - START_MS))

  const put = (
    mesh: THREE.InstancedMesh,
    i: number,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy = sx,
    angle = 0
  ) => {
    dummy.position.set(x, y, z)
    dummy.scale.set(sx, sy, 1)
    dummy.rotation.set(0, 0, angle)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  }
  const segment = (
    mesh: THREE.InstancedMesh,
    i: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    z: number,
    width: number
  ) => {
    const dx = x2 - x1
    const dy = y2 - y1
    put(
      mesh,
      i,
      (x1 + x2) / 2,
      (y1 + y2) / 2,
      z,
      Math.hypot(dx, dy) + width,
      width,
      Math.atan2(dy, dx)
    )
  }
  const commit = (mesh: THREE.InstancedMesh, count: number) => {
    mesh.count = count
    mesh.instanceMatrix.needsUpdate = true
  }

  useFrame(() => {
    if (
      !serverTicks.current ||
      !clientTicks.current ||
      !outLegs.current ||
      !backLegs.current ||
      !outTips.current ||
      !backTips.current ||
      !line.current ||
      !dots.current ||
      !crosses.current ||
      !pickRing.current ||
      !stripBar.current ||
      !tapeBar.current
    )
      return
    const { config: c, run: r, range } = latest.current
    const now = networkNow()
    const k = Math.min(Math.floor(now / TICK_MS), r.error.length - 1)
    const error = r.error[k]

    // Tapes. Server marks sit at their true times; client marks are where the
    // client's estimate puts the same readings, so they slide by the error.
    const tapeX = (ms: number) => NOW_X - (now - ms) * TAPE_UNITS_PER_MS
    const ticks = (mesh: THREE.InstancedMesh, shift: number, y: number) => {
      const first = Math.ceil(
        (now + shift + (LEFT - NOW_X) / TAPE_UNITS_PER_MS) / TICK_EVERY_MS
      )
      let count = 0
      for (let n = first; count < MAX_TICKS; n++) {
        const x = tapeX(n * TICK_EVERY_MS - shift)
        if (x > RIGHT) break
        const major = n % MAJOR_EVERY === 0
        put(mesh, count++, x, y, 0.02, major ? 0.07 : 0.03, major ? 1 : 0.55)
      }
      commit(mesh, count)
    }
    ticks(serverTicks.current, 0, SERVER_Y)
    ticks(clientTicks.current, error, CLIENT_Y)

    // Pings: a line up from the client's tape, a line back down.
    const bottom = CLIENT_Y + TAPE_H / 2
    const top = SERVER_Y - TAPE_H / 2
    let outCount = 0
    let backCount = 0
    let outTipCount = 0
    let backTipCount = 0
    const newest = Math.min(
      Math.floor((now / 1000) * PING_HZ),
      r.exchanges.length - 1
    )
    const earliest = now - (NOW_X - LEFT) / TAPE_UNITS_PER_MS
    for (let i = newest; i >= 0; i--) {
      const p = r.exchanges[i]
      if (p.arrivedAt < earliest && p.sentAt < earliest - 1000) break
      const reached = p.sentAt + p.outMs
      const left = reached + p.holdMs
      if (p.sentAt <= now && reached >= earliest && outCount < MAX_LEGS) {
        const f = Math.min((now - p.sentAt) / p.outMs, 1)
        const x = tapeX(p.sentAt + p.outMs * f)
        const y = bottom + (top - bottom) * f
        const start = Math.max(tapeX(p.sentAt), LINE_LEFT)
        const s = (start - tapeX(p.sentAt)) / (tapeX(reached) - tapeX(p.sentAt))
        segment(
          outLegs.current,
          outCount++,
          start,
          bottom + (top - bottom) * s,
          x,
          y,
          0.03,
          0.035
        )
        if (f < 1) put(outTips.current, outTipCount++, x, y, 0.04, 0.09)
      }
      if (left <= now && p.arrivedAt >= earliest && backCount < MAX_LEGS) {
        const f = Math.min((now - left) / p.backMs, 1)
        const x = tapeX(left + p.backMs * f)
        const y = top + (bottom - top) * f
        const start = Math.max(tapeX(left), LINE_LEFT)
        const s = (start - tapeX(left)) / (tapeX(p.arrivedAt) - tapeX(left))
        segment(
          backLegs.current,
          backCount++,
          start,
          top + (bottom - top) * s,
          x,
          y,
          0.03,
          0.035
        )
        if (f < 1) put(backTips.current, backTipCount++, x, y, 0.04, 0.09)
      }
    }
    commit(outLegs.current, outCount)
    commit(backLegs.current, backCount)
    commit(outTips.current, outTipCount)
    commit(backTips.current, backTipCount)

    // The strip keeps the true offset's midpoint centred, so drift shows as a
    // slope instead of carrying everything off the top.
    const centre = trueOffsetAt(c, now - STRIP_MS / 2)
    const toY = (ms: number) =>
      clamp(
        STRIP_MID + ((ms - centre) / range) * ((STRIP_TOP - STRIP_BOTTOM) / 2),
        STRIP_BOTTOM,
        STRIP_TOP
      )
    const stripX = (at: number) => STRIP_NOW_X - (now - at) * STRIP_UNITS_PER_MS

    // Estimate line and red crosses where game time jumped backwards.
    let segments = 0
    let bars = 0
    let px = STRIP_NOW_X
    let py = toY(r.offset[k])
    const lastTick = Math.floor(k / LINE_STRIDE) * LINE_STRIDE
    for (
      let i = lastTick;
      i >= 0 && segments < MAX_SEGMENTS;
      i -= LINE_STRIDE
    ) {
      const x = Math.max(stripX(i * TICK_MS), LINE_LEFT)
      const y = toY(r.offset[i])
      segment(line.current, segments++, px, py, x, y, 0.02, 0.05)
      px = x
      py = y
      if (x === LINE_LEFT) break
    }
    for (let i = k; i >= 1; i--) {
      const x = stripX(i * TICK_MS)
      if (x < LEFT) break
      if (r.jump[i] < -0.5 && bars + 2 <= MAX_CROSS_BARS) {
        const y = STRIP_BOTTOM + 0.18
        put(crosses.current, bars++, x, y, 0.05, 0.26, 0.06, Math.PI / 4)
        put(crosses.current, bars++, x, y, 0.05, 0.26, 0.06, -Math.PI / 4)
      }
    }
    commit(line.current, segments)
    commit(crosses.current, bars)

    // Raw samples, in the moment each one arrived.
    let dotCount = 0
    for (let i = newest; i >= 0; i--) {
      const p = r.exchanges[i]
      const x = stripX(p.arrivedAt)
      if (x < LEFT - 1) break
      if (p.arrivedAt > now || x < LEFT || dotCount >= MAX_DOTS) continue
      put(dots.current, dotCount++, x, toY(p.offset), 0.03, 0.07)
    }
    commit(dots.current, dotCount)

    // The sample the filter is using now.
    const picked = c.filter ? r.picked[k] : -1
    pickRing.current.visible = picked >= 0
    if (picked >= 0) {
      const p = r.exchanges[picked]
      pickRing.current.position.set(stripX(p.arrivedAt), toY(p.offset), 0.04)
    }

    // Red bars: the error, along the tape and up the strip's edge.
    const truthY = toY(trueOffsetAt(c, now))
    const estimateY = toY(r.offset[k])
    stripBar.current.position.y = (truthY + estimateY) / 2
    stripBar.current.scale.y = Math.max(Math.abs(estimateY - truthY), 0.001)
    const tapeEnd = clamp(NOW_X - error * TAPE_UNITS_PER_MS, LEFT, RIGHT)
    tapeBar.current.position.x = (NOW_X + tapeEnd) / 2
    tapeBar.current.scale.x = Math.max(Math.abs(tapeEnd - NOW_X), 0.001)
  })

  useLiveReadout(() => {
    const { config: c, run: r } = latest.current
    const k = Math.min(Math.floor(networkNow() / TICK_MS), r.error.length - 1)
    const slew =
      c.correction === "slew"
        ? `slew ${r.rate[k] >= 0 ? "+" : "−"}${Math.abs(r.rate[k] * 100).toFixed(2)}%`
        : "stepping, no slew"
    const e = r.error[k]
    return `estimated offset ${r.offset[k].toFixed(1)} ms · true error ${e >= 0 ? "+" : "−"}${Math.abs(e).toFixed(1)} ms · ${slew} · slowed 5×`
  })

  const range = stripRangeMs(v)
  const toYStatic = (ms: number) =>
    STRIP_MID + (ms / range) * ((STRIP_TOP - STRIP_BOTTOM) / 2)
  const slopeMs = (v.drift * 1e-6 * STRIP_MS) / 2

  return (
    <group position={[0, compact ? CARD_SHIFT_Y : 0, 0]}>
      {/* Server tape: outlined, grey marks. */}
      <mesh position={[0, SERVER_Y, -0.03]}>
        <planeGeometry args={[RIGHT - LEFT, TAPE_H]} />
        <meshBasicMaterial color={palette.tertiary} toneMapped={false} />
      </mesh>
      <mesh position={[0, SERVER_Y, -0.02]}>
        <planeGeometry args={[RIGHT - LEFT - 0.05, TAPE_H - 0.05]} />
        <meshBasicMaterial color={palette.stage} toneMapped={false} />
      </mesh>
      <instancedMesh
        ref={serverTicks}
        args={[undefined, undefined, MAX_TICKS]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, TAPE_H - 0.05]} />
        <meshBasicMaterial color={palette.tertiary} toneMapped={false} />
      </instancedMesh>

      {/* Client's estimate: solid yellow, marks cut out of it. */}
      <mesh position={[0, CLIENT_Y, -0.03]}>
        <planeGeometry args={[RIGHT - LEFT, TAPE_H]} />
        <meshBasicMaterial color={palette.moving} toneMapped={false} />
      </mesh>
      <instancedMesh
        ref={clientTicks}
        args={[undefined, undefined, MAX_TICKS]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, TAPE_H]} />
        <meshBasicMaterial color={palette.stage} toneMapped={false} />
      </instancedMesh>

      {/* Now, and how far the client's tape is from reading it. */}
      <mesh position={[NOW_X, (SERVER_Y + CLIENT_Y) / 2, 0.01]}>
        <planeGeometry args={[0.03, SERVER_Y - CLIENT_Y + TAPE_H + 0.1]} />
        <meshBasicMaterial color={palette.subject} toneMapped={false} />
      </mesh>
      <mesh ref={tapeBar} position={[NOW_X, CLIENT_Y, 0.05]}>
        <planeGeometry args={[1, TAPE_H]} />
        <meshBasicMaterial color={palette.error} toneMapped={false} />
      </mesh>

      {/* Exchanges: solid white going out, light grey coming back. */}
      <instancedMesh
        ref={outLegs}
        args={[undefined, undefined, MAX_LEGS]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.subject} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={backLegs}
        args={[undefined, undefined, MAX_LEGS]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.tertiary} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={outTips}
        args={[undefined, undefined, MAX_LEGS]}
        frustumCulled={false}
      >
        <circleGeometry args={[1, 16]} />
        <meshBasicMaterial color={palette.subject} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={backTips}
        args={[undefined, undefined, MAX_LEGS]}
        frustumCulled={false}
      >
        <ringGeometry args={[0.55, 1, 16]} />
        <meshBasicMaterial color={palette.accel} toneMapped={false} />
      </instancedMesh>

      {/* Offset strip. */}
      <mesh position={[0, STRIP_MID, -0.04]}>
        <planeGeometry args={[RIGHT - LEFT, STRIP_TOP - STRIP_BOTTOM]} />
        <meshBasicMaterial color={palette.surface} toneMapped={false} />
      </mesh>
      <Line
        points={[
          [LEFT, toYStatic(-slopeMs), 0],
          [STRIP_NOW_X, toYStatic(slopeMs), 0],
        ]}
        color={palette.tertiary}
        lineWidth={2}
        dashed
        dashSize={0.2}
        gapSize={0.14}
      />
      <instancedMesh
        ref={line}
        args={[undefined, undefined, MAX_SEGMENTS]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.moving} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={dots}
        args={[undefined, undefined, MAX_DOTS]}
        frustumCulled={false}
      >
        <circleGeometry args={[1, 12]} />
        <meshBasicMaterial color={palette.subject} toneMapped={false} />
      </instancedMesh>
      <mesh ref={pickRing} visible={false}>
        <ringGeometry args={[0.13, 0.19, 24]} />
        <meshBasicMaterial color={palette.moving} toneMapped={false} />
      </mesh>
      <instancedMesh
        ref={crosses}
        args={[undefined, undefined, MAX_CROSS_BARS]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.error} toneMapped={false} />
      </instancedMesh>
      <mesh
        ref={stripBar}
        position={[(STRIP_NOW_X + RIGHT) / 2, STRIP_MID, 0.05]}
      >
        <planeGeometry args={[(RIGHT - STRIP_NOW_X) * 0.7, 1]} />
        <meshBasicMaterial color={palette.error} toneMapped={false} />
      </mesh>
    </group>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 0, 9], target: [0, 0, 0] },
  orbit: false,
  params: [
    {
      key: "jitter",
      label: "Jitter (average queue per leg)",
      min: 0,
      max: 60,
      step: 5,
      value: 20,
      unit: "ms",
    },
    {
      key: "asymmetry",
      label: "Path asymmetry (out minus back)",
      min: -60,
      max: 60,
      step: 10,
      value: 30,
      unit: "ms",
    },
    {
      key: "drift",
      label: "Clock drift (exaggerated)",
      min: 0,
      max: 2000,
      step: 100,
      value: 1000,
      unit: "ppm",
    },
    {
      key: "method",
      label: "Filter and correction",
      type: "select",
      value: "filter-slew",
      options: [
        { value: "filter-slew", label: "Lowest RTT, slew" },
        { value: "filter-step", label: "Lowest RTT, step" },
        { value: "raw-slew", label: "No filter, slew" },
        { value: "raw-step", label: "No filter, step" },
      ],
    },
  ],
  readout: (v) =>
    `asymmetry ${v.asymmetry} ms leaves ${Math.abs(v.asymmetry / 2)} ms of error · drift ${(v.drift / 1000).toFixed(1)} ms/s`,
  Scene,
})
