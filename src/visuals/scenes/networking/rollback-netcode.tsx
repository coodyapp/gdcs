import { useLayoutEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import {
  initialWorld,
  type InputSource,
  RollbackPeer,
  scriptedInput,
  stepWorld,
  TRACK_LIMIT,
  type WorldState,
} from "@/lib/rollback-netcode"

import {
  defineVisual,
  palette,
  useFixedStep,
  useLiveReadout,
  useVisual,
} from "../../kit"

type V = { latency: number; delay: number; rate: number }

/** The sim is a 60 Hz game shown in slow motion, so single frames can be read. */
const TICKS_SHOWN_PER_SECOND = 8
const SIM_HZ = 60
const WARMUP_TICKS = 64
const FLASH_TICKS = 5

const PAST_SLOTS = 18
const QUEUE_SLOTS = 6
const CELL = 0.4
const CELL_W = 0.33
const CELL_H = 1
const STRIP_Y = -1.35
const NOW_X = ((PAST_SLOTS - QUEUE_SLOTS) * CELL) / 2 - CELL / 2
const LOCAL_LANE_Y = 2.05
const REMOTE_LANE_Y = 0.85
const UNIT = 0.36
const RING = 128

const FILLS = PAST_SLOTS * 3 + QUEUE_SLOTS
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0)

/** Rectangle outline built from thick quads. gap = 0 gives a solid outline. */
function outlineGeometry(
  w: number,
  h: number,
  thickness: number,
  dash: number,
  gap: number
) {
  const pos: number[] = []
  const quad = (x0: number, y0: number, x1: number, y1: number) =>
    pos.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y0, 0, x1, y1, 0, x0, y1, 0)
  const t = thickness / 2
  const run = (length: number, emit: (a: number, b: number) => void) => {
    if (gap <= 0) return emit(-length / 2, length / 2)
    const n = Math.max(1, Math.round((length + gap) / (dash + gap)))
    const d = (length - gap * (n - 1)) / n
    for (let i = 0; i < n; i++) {
      const a = -length / 2 + i * (d + gap)
      emit(a, a + d)
    }
  }
  run(w, (a, b) => {
    quad(a, h / 2 - t, b, h / 2 + t)
    quad(a, -h / 2 - t, b, -h / 2 + t)
  })
  run(h, (a, b) => {
    quad(w / 2 - t, a, w / 2 + t, b)
    quad(-w / 2 - t, a, -w / 2 + t, b)
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  return g
}

interface Sim {
  peer: RollbackPeer
  local: InputSource
  remote: InputSource
  truth: WorldState
  tick: number
  confirmed: number
  /** Tick on which each frame was last re-simulated, -1 if never. */
  flashAt: Int32Array
  /** Frame stored in each ring slot of flashAt, to reject stale entries. */
  flashFrame: Int32Array
  /** Re-simulated frames per tick over the last simulated second. */
  window: Uint16Array
  windowSum: number
  depth: number
  barFrom: number
  barTo: number
  barAt: number
}

function advance(sim: Sim) {
  const frame = sim.tick
  const r = sim.peer.tick()
  sim.truth = stepWorld(sim.truth, sim.local(frame), sim.remote(frame))
  sim.confirmed = r.confirmedFrame
  const slot = frame % SIM_HZ
  sim.windowSum += r.rollbackDepth - sim.window[slot]
  sim.window[slot] = r.rollbackDepth
  if (r.mispredictedFrame >= 0 && r.beforeRollback) {
    sim.depth = r.rollbackDepth
    for (let f = r.mispredictedFrame; f < frame; f++) {
      sim.flashAt[f % RING] = frame
      sim.flashFrame[f % RING] = f
    }
    sim.barFrom = r.beforeRollback.positions[1]
    sim.barTo = sim.peer.state.positions[1]
    sim.barAt = frame
  }
  sim.tick = frame + 1
}

function createSim(v: V): Sim {
  const local = scriptedInput(23, 1.5)
  const remote = scriptedInput(8, v.rate)
  const sim: Sim = {
    peer: new RollbackPeer({
      latency: v.latency,
      inputDelay: v.delay,
      inputs: [local, remote],
    }),
    local,
    remote,
    truth: initialWorld(),
    tick: 0,
    confirmed: -1,
    flashAt: new Int32Array(RING).fill(-1),
    flashFrame: new Int32Array(RING).fill(-1),
    window: new Uint16Array(SIM_HZ),
    windowSum: 0,
    depth: 0,
    barFrom: 0,
    barTo: 0,
    barAt: -100,
  }
  // Start with a full strip so a card reads correctly from its first frame.
  for (let i = 0; i < WARMUP_TICKS; i++) advance(sim)
  sim.peer.mispredictions = 0
  sim.peer.resimulated = 0
  return sim
}

function Scene({ v }: { v: V }) {
  const { playing, resetKey } = useVisual()
  const simRef = useRef<Sim | null>(null)
  const fills = useRef<THREE.InstancedMesh>(null)
  const dashes = useRef<THREE.InstancedMesh>(null)
  const localBox = useRef<THREE.Mesh>(null)
  const truthBox = useRef<THREE.Mesh>(null)
  const predictedBox = useRef<THREE.Mesh>(null)
  const bar = useRef<THREE.Mesh>(null)

  const cellDashes = useMemo(
    () => outlineGeometry(CELL_W, CELL_H, 0.06, 0.13, 0.09),
    []
  )
  const predictedOutline = useMemo(
    () => outlineGeometry(0.98, 0.98, 0.08, 0.17, 0.13),
    []
  )
  const localOutline = useMemo(
    () => outlineGeometry(0.56, 0.56, 0.08, 1, 0),
    []
  )
  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      color: new THREE.Color(),
      subject: new THREE.Color(palette.subject),
      accel: new THREE.Color(palette.accel),
      object: new THREE.Color(palette.object),
      error: new THREE.Color(palette.error),
    }),
    []
  )

  const paint = (sim: Sim) => {
    const f = fills.current
    const d = dashes.current
    if (!f || !d) return
    const { matrix, subject, accel, object, error } = scratch
    const current = sim.tick - 1
    const place = (
      i: number,
      x: number,
      y: number,
      w: number,
      h: number,
      color: THREE.Color
    ) => {
      matrix.makeScale(w, h, 1).setPosition(x, y, 0)
      f.setMatrixAt(i, matrix)
      f.setColorAt(i, color)
    }
    for (let s = 0; s < PAST_SLOTS; s++) {
      const frame = current - s
      const x = NOW_X - s * CELL
      const cell = s * 3
      const stored = sim.flashFrame[frame % RING] === frame
      const age = stored ? current - sim.flashAt[frame % RING] : Infinity
      const predicted = frame > sim.confirmed
      if (age < FLASH_TICKS) {
        // Re-simulated just now: taller and solid, whatever its status.
        place(cell, x, STRIP_Y, CELL_W, CELL_H * 1.3, error)
      } else if (!predicted) {
        place(cell, x, STRIP_Y, CELL_W, CELL_H, accel)
      } else {
        f.setMatrixAt(cell, HIDDEN)
      }
      if (predicted && age >= FLASH_TICKS) {
        matrix.makeTranslation(x, STRIP_Y, 0)
        d.setMatrixAt(s, matrix)
      } else {
        d.setMatrixAt(s, HIDDEN)
      }
      // Bar under every frame that has been re-simulated at least once.
      if (stored) place(cell + 1, x, STRIP_Y - 0.92, CELL_W, 0.12, error)
      else f.setMatrixAt(cell + 1, HIDDEN)
      // Tick above the frame where the remote player truly changed input.
      if (frame > 0 && sim.remote(frame) !== sim.remote(frame - 1))
        place(cell + 2, x, STRIP_Y + 0.9, 0.09, 0.32, subject)
      else f.setMatrixAt(cell + 2, HIDDEN)
    }
    // Short stubs ahead of "now": local inputs waiting out their input delay.
    for (let q = 0; q < QUEUE_SLOTS; q++) {
      const i = PAST_SLOTS * 3 + q
      if (q < v.delay)
        place(i, NOW_X + (q + 1) * CELL, STRIP_Y, CELL_W, CELL_H * 0.4, object)
      else f.setMatrixAt(i, HIDDEN)
    }
    f.instanceMatrix.needsUpdate = true
    if (f.instanceColor) f.instanceColor.needsUpdate = true
    d.instanceMatrix.needsUpdate = true
    if (bar.current) {
      const age = current - sim.barAt
      const on = age < FLASH_TICKS && sim.barFrom !== sim.barTo
      bar.current.visible = on
      if (on) {
        const a = sim.barFrom * UNIT
        const b = sim.barTo * UNIT
        bar.current.position.set((a + b) / 2, REMOTE_LANE_Y, 0)
        bar.current.scale.set(Math.abs(a - b), 0.2, 1)
      }
    }
  }

  useLayoutEffect(() => {
    const sim = createSim(v)
    simRef.current = sim
    if (fills.current) {
      for (let i = 0; i < FILLS; i++) {
        fills.current.setMatrixAt(i, HIDDEN)
        fills.current.setColorAt(i, scratch.accel)
      }
    }
    paint(sim)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.latency, v.delay, v.rate, resetKey])

  useFixedStep(() => {
    const sim = simRef.current
    if (!sim) return
    advance(sim)
    paint(sim)
  }, TICKS_SHOWN_PER_SECOND)

  useFrame((_, delta) => {
    const sim = simRef.current
    if (!sim) return
    // Glide between 8 Hz ticks. Still fast enough for a correction to read as a snap.
    const k = playing ? 1 - Math.exp(-Math.min(delta, 0.1) * 22) : 1
    const glide = (mesh: THREE.Mesh | null, target: number) => {
      if (mesh) mesh.position.x += (target * UNIT - mesh.position.x) * k
    }
    glide(localBox.current, sim.peer.state.positions[0])
    glide(predictedBox.current, sim.peer.state.positions[1])
    glide(truthBox.current, sim.truth.positions[1])
  })

  useLiveReadout(() => {
    const sim = simRef.current
    if (!sim) return null
    const lag = Math.round((v.delay * 1000) / SIM_HZ)
    // Latest depth, or 0 once a full simulated second has passed with no rollback.
    const depth = sim.windowSum > 0 ? sim.depth : 0
    return `Rollback depth ${depth} f · re-sim ${sim.windowSum} f/s · mispredictions ${sim.peer.mispredictions} · input lag ${v.delay} f (${lag} ms)`
  })

  const trackWidth = (TRACK_LIMIT * 2 + 1) * UNIT
  return (
    <>
      {[LOCAL_LANE_Y, REMOTE_LANE_Y].map((y) => (
        <mesh key={y} position={[0, y, -0.02]}>
          <planeGeometry args={[trackWidth, 0.04]} />
          <meshBasicMaterial color={palette.object} toneMapped={false} />
        </mesh>
      ))}
      <mesh
        ref={localBox}
        position={[0, LOCAL_LANE_Y, 0]}
        geometry={localOutline}
      >
        <meshBasicMaterial color={palette.tertiary} toneMapped={false} />
      </mesh>
      <mesh ref={bar} position={[0, REMOTE_LANE_Y, -0.01]} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.error} toneMapped={false} />
      </mesh>
      <mesh ref={truthBox} position={[0, REMOTE_LANE_Y, 0]}>
        <planeGeometry args={[0.56, 0.56]} />
        <meshBasicMaterial color={palette.subject} toneMapped={false} />
      </mesh>
      <mesh
        ref={predictedBox}
        position={[0, REMOTE_LANE_Y, 0.01]}
        geometry={predictedOutline}
      >
        <meshBasicMaterial color={palette.velocity} toneMapped={false} />
      </mesh>

      <instancedMesh
        ref={fills}
        args={[undefined, undefined, FILLS]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={dashes}
        args={[cellDashes, undefined, PAST_SLOTS]}
        frustumCulled={false}
      >
        <meshBasicMaterial color={palette.velocity} toneMapped={false} />
      </instancedMesh>
      {/* "Now": the frame being simulated, with queued local input to its right. */}
      <mesh position={[NOW_X + CELL / 2, STRIP_Y, 0.01]}>
        <planeGeometry args={[0.05, 2.2]} />
        <meshBasicMaterial color={palette.subject} toneMapped={false} />
      </mesh>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 0, 7.6], target: [0, 0, 0] },
  grid: false,
  orbit: false,
  params: [
    {
      key: "latency",
      label: "One-way latency",
      min: 0,
      max: 8,
      step: 1,
      value: 6,
      unit: " f",
    },
    {
      key: "delay",
      label: "Input delay",
      min: 0,
      max: 6,
      step: 1,
      value: 1,
      unit: " f",
    },
    {
      key: "rate",
      label: "Remote input changes",
      min: 0,
      max: 10,
      step: 1,
      value: 4,
      unit: "/s",
    },
  ],
  readout: (v) =>
    `Rollback depth ${Math.max(0, v.latency - v.delay)} f · input lag ${v.delay} f`,
  Scene,
})
