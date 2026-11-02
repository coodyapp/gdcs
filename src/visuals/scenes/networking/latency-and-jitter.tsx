import { useEffect, useMemo, useRef } from "react"
import { Line } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import {
  lastAtOrBefore,
  lossPercentAt,
  simulateLink,
} from "@/lib/network-stats"

import {
  defineVisual,
  palette,
  useClock,
  useLiveReadout,
  useVisual,
} from "../../kit"

type V = { base: number; jitter: number; loss: number }

/** Network time runs at a tenth of real time so the packets can be followed. */
const SLOW = 0.1
const RUN_MS = 60_000
const SEND_HZ = 20
const INTERVAL_MS = 1000 / SEND_HZ
const STRIP_MS = 3000
/** The loop starts this far in, so the strip is already full. */
const START_MS = STRIP_MS + 500
const CROSS_HOLD_MS = 150
const LANE_LOOKBACK_MS = 500

const LANE_LEFT = -4.7
const LANE_RIGHT = 4.7
/** Kept below the play/reset buttons, which cards do not have. */
const LANE_OUT_Y = 2.15
const LANE_BACK_Y = 1.35
const CARD_SHIFT_Y = 0.6
const STRIP_LEFT = -5.8
const STRIP_RIGHT = 5.8
const STRIP_BOTTOM = -3.55
const STRIP_TOP = 0.7
const GRID_MS = 50

const MAX_POINTS = 80
const MAX_DOTS = 24
const MAX_CROSS_BARS = 180

const laneX = (f: number) => LANE_LEFT + (LANE_RIGHT - LANE_LEFT) * f
const stripTopMs = (v: V) =>
  Math.max(200, Math.ceil(((v.base + v.jitter) * 2 * 1.15) / GRID_MS) * GRID_MS)

/** A strip of quads whose top and bottom edges are rewritten every frame. */
function makeRibbon() {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(MAX_POINTS * 6), 3)
  )
  const index: number[] = []
  for (let i = 0; i < MAX_POINTS - 1; i++) {
    const a = i * 2
    index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
  }
  geometry.setIndex(index)
  return geometry
}

function setRibbonPoint(
  ribbon: THREE.BufferGeometry,
  i: number,
  x: number,
  top: number,
  bottom: number,
  z: number
) {
  const position = ribbon.getAttribute("position") as THREE.BufferAttribute
  position.setXYZ(i * 2, x, top, z)
  position.setXYZ(i * 2 + 1, x, bottom, z)
}

function commitRibbon(ribbon: THREE.BufferGeometry, points: number) {
  ribbon.getAttribute("position").needsUpdate = true
  ribbon.setDrawRange(0, Math.max(points - 1, 0) * 6)
}

function Chevrons({ y, flip }: { y: number; flip: boolean }) {
  return [-3, -1, 1, 3].map((x) => (
    <mesh
      key={x}
      position={[x, y, -0.01]}
      rotation={[0, 0, flip ? Math.PI : 0]}
    >
      <circleGeometry args={[0.13, 3]} />
      <meshBasicMaterial color={palette.tertiary} toneMapped={false} />
    </mesh>
  ))
}

function Scene({ v }: { v: V }) {
  const time = useClock()
  const { compact } = useVisual()
  const run = useMemo(
    () =>
      simulateLink({
        baseMs: v.base,
        jitterMs: v.jitter,
        loss: v.loss / 100,
        durationMs: RUN_MS,
        sendHz: SEND_HZ,
      }),
    [v.base, v.jitter, v.loss]
  )
  const runRef = useRef(run)
  runRef.current = run

  const topMs = stripTopMs(v)
  const toY = (ms: number) =>
    STRIP_BOTTOM + (ms / topMs) * (STRIP_TOP - STRIP_BOTTOM)
  const toYRef = useRef(toY)
  toYRef.current = toY

  const out = useRef<THREE.InstancedMesh>(null)
  const back = useRef<THREE.InstancedMesh>(null)
  const samples = useRef<THREE.InstancedMesh>(null)
  const bars = useRef<THREE.InstancedMesh>(null)
  const line = useMemo(makeRibbon, [])
  const band = useMemo(makeRibbon, [])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  useEffect(
    () => () => {
      line.dispose()
      band.dispose()
    },
    [line, band]
  )

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
  const commit = (mesh: THREE.InstancedMesh, count: number) => {
    mesh.count = count
    mesh.instanceMatrix.needsUpdate = true
  }

  useFrame(() => {
    if (!out.current || !back.current || !samples.current || !bars.current)
      return
    const now = networkNow()
    const yOf = toYRef.current
    const { pings, samples: list } = runRef.current
    const newestPing = Math.min(Math.floor(now / INTERVAL_MS), pings.length - 1)

    let outCount = 0
    let backCount = 0
    let barCount = 0
    const cross = (x: number, y: number, size: number) => {
      if (barCount + 2 > MAX_CROSS_BARS) return
      put(bars.current!, barCount++, x, y, 0.05, size, size * 0.26, Math.PI / 4)
      put(
        bars.current!,
        barCount++,
        x,
        y,
        0.05,
        size,
        size * 0.26,
        -Math.PI / 4
      )
    }

    // Packets on the lanes.
    for (let i = newestPing; i >= 0; i--) {
      const p = pings[i]
      const age = now - p.sentAt
      if (age > LANE_LOOKBACK_MS) break
      if (age < 0) continue
      const outF = age / p.outMs
      if (p.lost === "out" && outF >= p.dropPoint) {
        const since = age - p.outMs * p.dropPoint
        if (since < CROSS_HOLD_MS) cross(laneX(p.dropPoint), LANE_OUT_Y, 0.5)
        continue
      }
      if (outF < 1) {
        if (outCount < MAX_DOTS)
          put(out.current, outCount++, laneX(outF), LANE_OUT_Y, 0.03, 0.17)
        continue
      }
      const backF = (age - p.outMs) / p.backMs
      if (p.lost === "back" && backF >= p.dropPoint) {
        const since = age - p.outMs - p.backMs * p.dropPoint
        if (since < CROSS_HOLD_MS)
          cross(laneX(1 - p.dropPoint), LANE_BACK_Y, 0.5)
        continue
      }
      if (backF < 1 && backCount < MAX_DOTS)
        put(
          back.current,
          backCount++,
          laneX(1 - backF),
          LANE_BACK_Y,
          0.03,
          0.17
        )
    }
    commit(out.current, outCount)
    commit(back.current, backCount)

    // RTT samples, newest first, with the smoothed line and the jitter band.
    const pxPerMs = (STRIP_RIGHT - STRIP_LEFT) / STRIP_MS
    const stripX = (at: number) => STRIP_RIGHT - (now - at) * pxPerMs
    let points = 0
    let dots = 0
    const newest = lastAtOrBefore(list, now)
    if (newest >= 0) {
      const s = list[newest]
      const y = yOf(s.srtt)
      setRibbonPoint(line, points, STRIP_RIGHT, y + 0.035, y - 0.035, 0.02)
      setRibbonPoint(
        band,
        points,
        STRIP_RIGHT,
        Math.min(yOf(s.srtt + s.jitter), STRIP_TOP),
        Math.max(yOf(s.srtt - s.jitter), STRIP_BOTTOM),
        0.01
      )
      points++
    }
    for (let i = newest; i >= 0 && points < MAX_POINTS; i--) {
      const s = list[i]
      const x = Math.max(stripX(s.at), STRIP_LEFT)
      const y = yOf(s.srtt)
      setRibbonPoint(line, points, x, y + 0.035, y - 0.035, 0.02)
      setRibbonPoint(
        band,
        points,
        x,
        Math.min(yOf(s.srtt + s.jitter), STRIP_TOP),
        Math.max(yOf(s.srtt - s.jitter), STRIP_BOTTOM),
        0.01
      )
      points++
      // The first sample past the left edge only extends the ribbons to it.
      if (x === STRIP_LEFT) break
      put(
        samples.current,
        dots++,
        x,
        Math.min(yOf(s.rtt), STRIP_TOP),
        0.03,
        0.075
      )
    }
    commitRibbon(line, points)
    commitRibbon(band, points)
    commit(samples.current, dots)

    // Lost pings on the strip's bottom row, by the time they were dropped.
    for (let i = newestPing; i >= 0; i--) {
      const p = pings[i]
      if (p.sentAt < now - STRIP_MS - 200) break
      if (!p.lost) continue
      const dropAt =
        p.lost === "out"
          ? p.sentAt + p.outMs * p.dropPoint
          : p.sentAt + p.outMs + p.backMs * p.dropPoint
      const x = stripX(dropAt)
      if (dropAt <= now && x >= STRIP_LEFT) cross(x, STRIP_BOTTOM + 0.2, 0.3)
    }
    commit(bars.current, barCount)
  })

  useLiveReadout(() => {
    const r = runRef.current
    const now = networkNow()
    const i = lastAtOrBefore(r.samples, now)
    if (i < 0) return null
    const s = r.samples[i]
    return `RTT ${s.rtt.toFixed(0)} ms · smoothed ${s.srtt.toFixed(0)} ms · jitter ${s.jitter.toFixed(1)} ms · loss ${lossPercentAt(r, now).toFixed(1)}% · slowed 10×`
  })

  const gridLines: number[] = []
  for (let ms = GRID_MS; ms < topMs; ms += GRID_MS) gridLines.push(ms)
  const floorY = toY(v.base * 2)

  return (
    <group position={[0, compact ? CARD_SHIFT_Y : 0, 0]}>
      {/* Client (solid) and server (outline), joined by two one-way lanes. */}
      <mesh position={[-5.25, (LANE_OUT_Y + LANE_BACK_Y) / 2, 0]}>
        <planeGeometry args={[0.8, 1.5]} />
        <meshBasicMaterial color={palette.subject} toneMapped={false} />
      </mesh>
      <mesh position={[5.25, (LANE_OUT_Y + LANE_BACK_Y) / 2, 0]}>
        <planeGeometry args={[0.8, 1.5]} />
        <meshBasicMaterial color={palette.subject} toneMapped={false} />
      </mesh>
      <mesh position={[5.25, (LANE_OUT_Y + LANE_BACK_Y) / 2, 0.01]}>
        <planeGeometry args={[0.64, 1.34]} />
        <meshBasicMaterial color={palette.stage} toneMapped={false} />
      </mesh>
      {[LANE_OUT_Y, LANE_BACK_Y].map((y) => (
        <mesh key={y} position={[0, y, -0.02]}>
          <planeGeometry args={[LANE_RIGHT - LANE_LEFT, 0.025]} />
          <meshBasicMaterial color={palette.tertiary} toneMapped={false} />
        </mesh>
      ))}
      <Chevrons y={LANE_OUT_Y} flip={false} />
      <Chevrons y={LANE_BACK_Y} flip />

      <instancedMesh
        ref={out}
        args={[undefined, undefined, MAX_DOTS]}
        frustumCulled={false}
      >
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial color={palette.subject} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={back}
        args={[undefined, undefined, MAX_DOTS]}
        frustumCulled={false}
      >
        <ringGeometry args={[0.55, 1, 24]} />
        <meshBasicMaterial color={palette.subject} toneMapped={false} />
      </instancedMesh>

      {/* RTT strip: a line every 50 ms from zero at the bottom. */}
      <mesh position={[0, (STRIP_TOP + STRIP_BOTTOM) / 2, -0.03]}>
        <planeGeometry
          args={[STRIP_RIGHT - STRIP_LEFT, STRIP_TOP - STRIP_BOTTOM]}
        />
        <meshBasicMaterial color={palette.surface} toneMapped={false} />
      </mesh>
      {gridLines.map((ms) => (
        <mesh key={ms} position={[0, toY(ms), -0.02]}>
          <planeGeometry args={[STRIP_RIGHT - STRIP_LEFT, 0.015]} />
          <meshBasicMaterial
            color={palette.tertiary}
            transparent
            opacity={0.25}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
      <Line
        points={[
          [STRIP_LEFT, floorY, -0.01],
          [STRIP_RIGHT, floorY, -0.01],
        ]}
        color={palette.tertiary}
        lineWidth={1.5}
        dashed
        dashSize={0.16}
        gapSize={0.14}
      />
      <mesh geometry={band} frustumCulled={false}>
        <meshBasicMaterial
          color={palette.moving}
          transparent
          opacity={0.2}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <mesh geometry={line} frustumCulled={false}>
        <meshBasicMaterial
          color={palette.moving}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <instancedMesh
        ref={samples}
        args={[undefined, undefined, MAX_POINTS]}
        frustumCulled={false}
      >
        <circleGeometry args={[1, 12]} />
        <meshBasicMaterial color={palette.subject} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={bars}
        args={[undefined, undefined, MAX_CROSS_BARS]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.error} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 0, 9], target: [0, 0, 0] },
  orbit: false,
  params: [
    {
      key: "base",
      label: "Base latency (one way)",
      min: 10,
      max: 100,
      step: 5,
      value: 40,
      unit: "ms",
    },
    {
      key: "jitter",
      label: "Jitter (added per leg, up to)",
      min: 0,
      max: 60,
      step: 5,
      value: 40,
      unit: "ms",
    },
    {
      key: "loss",
      label: "Packet loss (per leg)",
      min: 0,
      max: 30,
      step: 1,
      value: 5,
      unit: "%",
    },
  ],
  readout: (v) => {
    const lost = (1 - (1 - v.loss / 100) ** 2) * 100
    return `RTT ${v.base * 2}–${(v.base + v.jitter) * 2} ms · ${lost.toFixed(1)}% of pings lost at ${v.loss}% per leg`
  },
  Scene,
})
