import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import {
  runSim,
  SEND_EVERY,
  stepSim,
  TICK_HZ,
  TICK_MS,
  type SimConfig,
  type SimState,
} from "@/lib/client-side-prediction"

import {
  clamp,
  defineVisual,
  lerp,
  palette,
  useClock,
  useLiveReadout,
} from "../../kit"

type V = {
  latency: number
  push: boolean
  prediction: boolean
  smoothing: boolean
}

const LANE_PREDICTED = 2
const LANE_SERVER = 0
const LANE_NO_PREDICTION = -2
const RADIUS = 0.4
const TRACK = 4.6
const DASH_PITCH = 0.22
const MAX_DASHES = 40
const MAX_PIPS = 40
/** Starts past the first correction so the first frame already shows the lag. */
const WARM_UP_TICKS = 60
const CORRECTION_FADE_TICKS = 40
const DASHED_ARCS = Array.from({ length: 6 }, (_, i) => (i * Math.PI) / 3)

const matrix = new THREE.Matrix4()
const scale = new THREE.Vector3()
const quaternion = new THREE.Quaternion()
const position = new THREE.Vector3()

/** Lays evenly spaced dashes from the edge of the marker at `a` towards `b`. */
function layDashes(mesh: THREE.InstancedMesh, a: number, b: number, y: number) {
  const span = Math.abs(b - a) - RADIUS
  const count = clamp(Math.floor(span / DASH_PITCH), 0, MAX_DASHES)
  const dir = Math.sign(b - a)
  scale.set(1, 1, 1)
  for (let i = 0; i < count; i++) {
    position.set(a + dir * (RADIUS + (i + 0.5) * DASH_PITCH), y, 0)
    mesh.setMatrixAt(i, matrix.compose(position, quaternion, scale))
  }
  mesh.count = count
  mesh.instanceMatrix.needsUpdate = true
}

function Scene({ v }: { v: V }) {
  const clock = useClock()
  const config = useMemo<SimConfig>(
    () => ({
      latencyTicks: Math.round(v.latency / TICK_MS),
      sendEvery: SEND_EVERY,
      push: v.push,
    }),
    [v.latency, v.push]
  )
  const sim = useRef<{ config: SimConfig; now: SimState; before: SimState }>(
    null
  )

  const predicted = useRef<THREE.Mesh>(null)
  const intended = useRef<THREE.Mesh>(null)
  const server = useRef<THREE.Group>(null)
  const shown = useRef<THREE.Group>(null)
  const shownFill = useRef<THREE.Mesh>(null)
  const guide = useRef<THREE.Mesh>(null)
  const correction = useRef<THREE.Mesh>(null)
  const serverDashes = useRef<THREE.InstancedMesh>(null)
  const shownDashes = useRef<THREE.InstancedMesh>(null)
  const pips = useRef<THREE.InstancedMesh>(null)

  useLiveReadout(() => {
    const now = sim.current?.now
    if (!now) return null
    const rtt = `RTT ${v.latency * 2} ms`
    if (!v.prediction)
      return `${rtt} · prediction off: you see the server's past, nothing to replay`
    const last = now.lastCorrection
    const size = last ? `${Math.abs(last.from - last.to).toFixed(2)} u` : "none"
    return `${rtt} · pending inputs ${now.pending.length} · last correction ${size}`
  })

  useFrame(() => {
    let s = sim.current
    if (s && s.config !== config) clock.current = 0
    const elapsed = clock.current * TICK_HZ
    const target = WARM_UP_TICKS + Math.floor(elapsed)
    if (!s || s.config !== config || target < s.now.tick) {
      const state = runSim(config, WARM_UP_TICKS)
      s = sim.current = { config, now: state, before: state }
    }
    while (s.now.tick < target) {
      s.before = s.now
      s.now = stepSim(s.now, config)
    }
    const { now, before } = s
    const t = elapsed - Math.floor(elapsed)

    // Yellow and grey are blended between ticks. The received state stays
    // stepped on purpose: it only changes when a packet lands.
    const raw = lerp(before.predicted, now.predicted, t)
    const error = v.smoothing ? lerp(before.visualError, now.visualError, t) : 0
    const yellowX = raw + error
    const serverX = lerp(before.server.position, now.server.position, t)
    const shownX = now.received.position

    predicted.current!.position.x = yellowX
    predicted.current!.visible = v.prediction
    intended.current!.position.x = yellowX
    intended.current!.visible = !v.prediction
    server.current!.position.x = serverX
    shown.current!.position.x = shownX
    shownFill.current!.visible = !v.prediction
    guide.current!.position.x = yellowX

    layDashes(serverDashes.current!, serverX, yellowX, LANE_SERVER)
    layDashes(shownDashes.current!, shownX, yellowX, LANE_NO_PREDICTION)

    const pipMesh = pips.current!
    let pipX = now.received.position
    let pipCount = 0
    if (v.prediction) {
      scale.set(1, 1, 1)
      for (const input of now.pending) {
        if (pipCount === MAX_PIPS) break
        pipX += input.move
        position.set(pipX, LANE_PREDICTED, 0)
        pipMesh.setMatrixAt(
          pipCount++,
          matrix.compose(position, quaternion, scale)
        )
      }
    }
    pipMesh.count = pipCount
    pipMesh.instanceMatrix.needsUpdate = true

    const bar = correction.current!
    const last = now.lastCorrection
    const age = last ? now.tick - last.tick : Infinity
    bar.visible = v.prediction && last !== null && age < CORRECTION_FADE_TICKS
    if (last && bar.visible) {
      bar.position.x = (last.from + last.to) / 2
      bar.scale.x = Math.abs(last.from - last.to)
      const material = bar.material as THREE.MeshBasicMaterial
      material.opacity = clamp(1 - age / CORRECTION_FADE_TICKS)
    }
  })

  return (
    <>
      {[LANE_PREDICTED, LANE_SERVER, LANE_NO_PREDICTION].map((y) => (
        <mesh key={y} position={[0, y, -0.02]}>
          <planeGeometry args={[TRACK * 2, 0.03]} />
          <meshBasicMaterial color={palette.grid} />
        </mesh>
      ))}

      {/* Where the input has taken you: every lag is measured against this. */}
      <mesh ref={guide} position={[0, 0, -0.01]}>
        <planeGeometry args={[0.03, LANE_PREDICTED - LANE_NO_PREDICTION]} />
        <meshBasicMaterial color={palette.moving} transparent opacity={0.45} />
      </mesh>

      {/* Predicted client: solid yellow disc, or a thin ring when switched off. */}
      <mesh ref={predicted} position={[0, LANE_PREDICTED, 0.02]}>
        <circleGeometry args={[RADIUS, 40]} />
        <meshBasicMaterial color={palette.moving} />
      </mesh>
      <mesh ref={intended} position={[0, LANE_PREDICTED, 0.02]}>
        <ringGeometry args={[RADIUS - 0.04, RADIUS, 40]} />
        <meshBasicMaterial color={palette.moving} />
      </mesh>
      <instancedMesh
        ref={pips}
        args={[undefined, undefined, MAX_PIPS]}
        frustumCulled={false}
        position={[0, 0, 0.03]}
      >
        <circleGeometry args={[0.055, 12]} />
        <meshBasicMaterial color={palette.foreground} />
      </instancedMesh>

      {/* Authoritative server: solid grey outline. */}
      <group ref={server} position={[0, LANE_SERVER, 0.02]}>
        <mesh>
          <ringGeometry args={[RADIUS - 0.07, RADIUS, 40]} />
          <meshBasicMaterial color={palette.tertiary} />
        </mesh>
      </group>
      <instancedMesh
        ref={serverDashes}
        args={[undefined, undefined, MAX_DASHES]}
        frustumCulled={false}
      >
        <planeGeometry args={[DASH_PITCH * 0.55, 0.08]} />
        <meshBasicMaterial color={palette.tertiary} />
      </instancedMesh>

      {/* Latest received state: dashed red outline, filled when it is all you get. */}
      <group ref={shown} position={[0, LANE_NO_PREDICTION, 0.02]}>
        <mesh ref={shownFill}>
          <circleGeometry args={[RADIUS, 40]} />
          <meshBasicMaterial color={palette.error} />
        </mesh>
        {DASHED_ARCS.map((start) => (
          <mesh key={start}>
            <ringGeometry
              args={[RADIUS - 0.07, RADIUS, 12, 1, start, Math.PI / 5]}
            />
            <meshBasicMaterial color={palette.error} />
          </mesh>
        ))}
      </group>
      <instancedMesh
        ref={shownDashes}
        args={[undefined, undefined, MAX_DASHES]}
        frustumCulled={false}
      >
        <planeGeometry args={[DASH_PITCH * 0.55, 0.08]} />
        <meshBasicMaterial color={palette.error} />
      </instancedMesh>

      {/* The correction just applied, from old to new prediction. */}
      <mesh ref={correction} position={[0, LANE_PREDICTED + 0.72, 0]}>
        <planeGeometry args={[1, 0.14]} />
        <meshBasicMaterial color={palette.error} transparent />
      </mesh>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 0, 7.6], target: [0, 0, 0] },
  orbit: false,
  params: [
    {
      key: "latency",
      label: "One-way latency",
      min: 0,
      max: 250,
      step: 25,
      value: 150,
      unit: "ms",
    },
    {
      key: "push",
      label: "Server disagrees (push)",
      type: "toggle",
      value: true,
    },
    { key: "prediction", label: "Prediction", type: "toggle", value: true },
    {
      key: "smoothing",
      label: "Smooth corrections",
      type: "toggle",
      value: true,
    },
  ],
  readout: (v) => `RTT ${v.latency * 2} ms`,
  Scene,
})
