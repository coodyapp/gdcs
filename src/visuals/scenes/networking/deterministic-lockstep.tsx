import { useLayoutEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import {
  bandwidth,
  laggyPeerLatency,
  LockstepSim,
  squadOf,
  WORLD_W,
} from "@/lib/deterministic-lockstep"

import {
  clamp,
  defineVisual,
  palette,
  useFixedStep,
  useLiveReadout,
  useVisual,
} from "../../kit"

type V = {
  latency: number
  spike: boolean
  delay: number
  desync: boolean
}

const PEERS = 3
const UNITS = 300
const TURN_MS = 100
const FAST_LINK_MS = 20
const SPIKE = { extraMs: 300, everyMs: 2000, lastsMs: 600 }
const SEED = 7
const LAGGY_PEER = PEERS - 1
/** Slow motion: 4 simulated ms per 16 ms step, so 1/4 of real time. */
const MS_PER_STEP = 4
const STEPS_PER_SECOND = 62.5
/** A full strip on the first frame, with one spike already in it. */
const WARMUP_MS = 2500
const DESYNC_TURN = 30

const ROW_Y = [2.25, 0.5, -1.25]
const PANEL_X = -3.65
const PANEL_W = 2.4
const PANEL_H = 1.5
const WORLD_SCALE = (PANEL_W / 2 - 0.05) / WORLD_W
const UNIT_SIZE = 0.05
const CELL = 0.36
const CELL_W = 0.3
const CELL_H = 1
const STRIP_LEFT = -2.2
const STRIP_RIGHT = 4.6
const SLOTS = Math.ceil((STRIP_RIGHT - STRIP_LEFT) / CELL) + 2
const LANE_Y = -2.42

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

function createSim(v: V) {
  const sim = new LockstepSim({
    peers: PEERS,
    units: UNITS,
    seed: SEED,
    turnMs: TURN_MS,
    delayTurns: v.delay,
    latency: laggyPeerLatency(
      PEERS,
      FAST_LINK_MS,
      v.latency,
      v.spike ? SPIKE : undefined
    ),
    desync: v.desync ? { peer: LAGGY_PEER, turn: DESYNC_TURN } : null,
  })
  sim.advance(WARMUP_MS)
  return sim
}

const headOf = (sim: LockstepSim) =>
  Math.max(sim.turnOf(0), sim.turnOf(1), sim.turnOf(2))

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const simRef = useRef<LockstepSim | null>(null)
  const scroll = useRef(0)
  const differs = useMemo(() => new Uint8Array(UNITS), [])

  const units = useRef<THREE.InstancedMesh>(null)
  const executed = useRef<THREE.InstancedMesh>(null)
  const ready = useRef<THREE.InstancedMesh>(null)
  const waiting = useRef<THREE.InstancedMesh>(null)
  const stalled = useRef<THREE.InstancedMesh>(null)
  const nowBars = useRef<THREE.InstancedMesh>(null)
  const agreed = useRef<THREE.InstancedMesh>(null)
  const mismatch = useRef<THREE.Group>(null)

  const dashedCell = useMemo(
    () => outlineGeometry(CELL_W, CELL_H, 0.055, 0.13, 0.09),
    []
  )
  const solidCell = useMemo(
    () => outlineGeometry(CELL_W, CELL_H, 0.03, 1, 0),
    []
  )
  const panelFrame = useMemo(
    () => outlineGeometry(PANEL_W, PANEL_H, 0.03, 1, 0),
    []
  )
  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      squads: [
        new THREE.Color(palette.subject),
        new THREE.Color(palette.accel),
        new THREE.Color(palette.tertiary),
      ],
      error: new THREE.Color(palette.error),
    }),
    []
  )

  const colourUnit = (i: number, broken: boolean) => {
    const offset = LAGGY_PEER * UNITS + i
    units.current?.setColorAt(
      offset,
      broken ? scratch.error : scratch.squads[squadOf(i, PEERS)]
    )
  }

  useLayoutEffect(() => {
    const sim = createSim(v)
    simRef.current = sim
    scroll.current = headOf(sim)
    differs.fill(0)
    const m = units.current
    if (m) {
      for (let peer = 0; peer < PEERS; peer++) {
        for (let i = 0; i < UNITS; i++) {
          m.setColorAt(peer * UNITS + i, scratch.squads[squadOf(i, PEERS)])
        }
      }
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.latency, v.spike, v.delay, v.desync, resetKey])

  useFixedStep(() => {
    simRef.current?.advance(MS_PER_STEP)
  }, STEPS_PER_SECOND)

  /** Paint the units of one peer's world, between its last two turns. */
  const paintWorld = (sim: LockstepSim, peer: number) => {
    const mesh = units.current
    if (!mesh) return
    const { matrix } = scratch
    const w = sim.worldOf(peer)
    const t = sim.phaseOf(peer)
    const cy = ROW_Y[peer]
    for (let i = 0; i < UNITS; i++) {
      const x = w.prevX[i] + (w.x[i] - w.prevX[i]) * t
      const y = w.prevY[i] + (w.y[i] - w.prevY[i]) * t
      const size = differs[i] && peer === LAGGY_PEER ? UNIT_SIZE * 2 : UNIT_SIZE
      matrix
        .makeScale(size, size, 1)
        .setPosition(
          PANEL_X + x * WORLD_SCALE,
          cy + y * WORLD_SCALE,
          differs[i] ? 0.02 : 0.01
        )
      mesh.setMatrixAt(peer * UNITS + i, matrix)
    }
  }

  /** Mark units that differ from peer 1, whenever both have run the same turn. */
  const compareWorlds = (sim: LockstepSim) => {
    if (sim.turnOf(0) !== sim.turnOf(LAGGY_PEER)) return
    const a = sim.worldOf(0)
    const b = sim.worldOf(LAGGY_PEER)
    let changed = false
    for (let i = 0; i < UNITS; i++) {
      const broken = a.x[i] !== b.x[i] || a.y[i] !== b.y[i] ? 1 : 0
      if (broken !== differs[i]) {
        differs[i] = broken
        colourUnit(i, broken === 1)
        changed = true
      }
    }
    const colours = units.current?.instanceColor
    if (changed && colours) colours.needsUpdate = true
  }

  useFrame((_, delta) => {
    let sim = simRef.current
    if (!sim) return
    const mesh = units.current
    if (!mesh) return

    // A desync ends a real game. Here, the run starts over once the marker leaves.
    // The newest cell sits so that the scheduled turns just fit on its right.
    const nowX = STRIP_RIGHT - (v.delay + 0.5) * CELL
    const pastSlots = Math.ceil((nowX - STRIP_LEFT) / CELL)
    const found = sim.firstMismatch
    if (found && headOf(sim) >= found.turn + pastSlots) {
      sim = createSim(v)
      simRef.current = sim
      scroll.current = headOf(sim)
      for (let i = 0; i < UNITS; i++) {
        if (differs[i]) colourUnit(i, false)
        differs[i] = 0
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }

    if (v.desync) compareWorlds(sim)
    for (let peer = 0; peer < PEERS; peer++) paintWorld(sim, peer)
    mesh.instanceMatrix.needsUpdate = true

    const head = headOf(sim)
    scroll.current +=
      (head - scroll.current) * (1 - Math.exp(-Math.min(delta, 0.1) * 12))
    const xOf = (turn: number) => nowX + (turn - scroll.current) * CELL

    const { matrix } = scratch
    let nExecuted = 0
    let nReady = 0
    let nWaiting = 0
    let nStalled = 0
    let nAgreed = 0
    const firstTurn = head - pastSlots - 1
    const lastTurn = head + v.delay
    for (let peer = 0; peer < PEERS; peer++) {
      const y = ROW_Y[peer]
      for (let turn = firstTurn; turn <= lastTurn; turn++) {
        const x = xOf(turn)
        if (x < STRIP_LEFT) continue
        const state = sim.cellState(peer, turn)
        if (state === "executed") {
          matrix.makeScale(CELL_W, CELL_H, 1).setPosition(x, y, 0)
          executed.current?.setMatrixAt(nExecuted++, matrix)
        } else if (state === "stalled" || state === "stalling") {
          // A diamond that grows with the stall, capped at one whole turn.
          const k = clamp(sim.stallBefore(peer, turn) / TURN_MS)
          const h = CELL_H * (0.6 + 0.6 * k)
          matrix.makeScale(h * 0.46, h, 1).setPosition(x, y, 0.03)
          stalled.current?.setMatrixAt(nStalled++, matrix)
        } else if (state === "ready") {
          matrix.makeTranslation(x, y, 0)
          ready.current?.setMatrixAt(nReady++, matrix)
        } else if (state === "waiting") {
          matrix.makeTranslation(x, y, 0)
          waiting.current?.setMatrixAt(nWaiting++, matrix)
        }
      }
      // Each peer's own "now", right after its newest executed turn.
      matrix
        .makeScale(0.05, CELL_H * 1.3, 1)
        .setPosition(xOf(sim.turnOf(peer)) + CELL / 2, y, 0.02)
      nowBars.current?.setMatrixAt(peer, matrix)
    }
    for (let turn = firstTurn; turn <= head; turn++) {
      const x = xOf(turn)
      if (x < STRIP_LEFT || !sim.turnAgrees(turn)) continue
      matrix.makeScale(0.14, 0.14, 1).setPosition(x, LANE_Y, 0)
      agreed.current?.setMatrixAt(nAgreed++, matrix)
    }
    const counts: [THREE.InstancedMesh | null, number][] = [
      [executed.current, nExecuted],
      [ready.current, nReady],
      [waiting.current, nWaiting],
      [stalled.current, nStalled],
      [agreed.current, nAgreed],
    ]
    for (const [m, n] of counts) {
      if (!m) continue
      m.count = n
      m.instanceMatrix.needsUpdate = true
    }
    if (nowBars.current) nowBars.current.instanceMatrix.needsUpdate = true

    const marker = mismatch.current
    if (marker) {
      const turn = sim.firstMismatch?.turn ?? -1
      marker.visible = turn >= 0 && xOf(turn) >= STRIP_LEFT
      if (marker.visible) marker.position.x = xOf(turn)
    }
  })

  const rates = bandwidth({ units: UNITS, peers: PEERS, turnMs: TURN_MS })
  useLiveReadout(() => {
    const sim = simRef.current
    if (!sim) return null
    const stall = Math.max(
      sim.totalStallOf(0),
      sim.totalStallOf(1),
      sim.totalStallOf(2)
    )
    const share = Math.round((100 * stall) / Math.max(1, sim.now))
    const inputs = (rates.inputBytesPerSecond / 1000).toFixed(1)
    const state = (rates.stateBytesPerSecond / 1000).toFixed(1)
    const found = sim.firstMismatch
    const status = found ? ` · checksums differ at turn ${found.turn}` : ""
    return `Turn ${headOf(sim)} · stall ${(stall / 1000).toFixed(1)} s (${share}%) · input lag ${v.delay * TURN_MS} ms · inputs ${inputs} KB/s vs state ${state} KB/s for ${UNITS} units${status}`
  })

  return (
    <>
      {ROW_Y.map((y) => (
        <mesh key={y} position={[PANEL_X, y, 0]} geometry={panelFrame}>
          <meshBasicMaterial color={palette.object} toneMapped={false} />
        </mesh>
      ))}
      <instancedMesh
        ref={units}
        args={[undefined, undefined, UNITS * PEERS]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      <instancedMesh
        ref={executed}
        args={[undefined, undefined, SLOTS * PEERS]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.object} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={ready}
        args={[solidCell, undefined, SLOTS * PEERS]}
        frustumCulled={false}
      >
        <meshBasicMaterial color={palette.accel} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={waiting}
        args={[dashedCell, undefined, SLOTS * PEERS]}
        frustumCulled={false}
      >
        <meshBasicMaterial color={palette.velocity} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={stalled}
        args={[undefined, undefined, SLOTS * PEERS]}
        frustumCulled={false}
      >
        <circleGeometry args={[0.5, 4]} />
        <meshBasicMaterial color={palette.error} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={nowBars}
        args={[undefined, undefined, PEERS]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.subject} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={agreed}
        args={[undefined, undefined, SLOTS]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.success} toneMapped={false} />
      </instancedMesh>

      {/* Checksum mismatch: a cross in the lane and a line up through every row. */}
      <group ref={mismatch} position={[0, 0, 0.05]} visible={false}>
        <mesh position={[0, (LANE_Y + ROW_Y[0] + CELL_H * 0.7) / 2, 0]}>
          <planeGeometry args={[0.05, ROW_Y[0] + CELL_H * 0.7 - LANE_Y]} />
          <meshBasicMaterial color={palette.subject} toneMapped={false} />
        </mesh>
        <mesh position={[0, LANE_Y, 0.01]} rotation={[0, 0, Math.PI / 4]}>
          <planeGeometry args={[0.62, 0.15]} />
          <meshBasicMaterial color={palette.error} toneMapped={false} />
        </mesh>
        <mesh position={[0, LANE_Y, 0.01]} rotation={[0, 0, -Math.PI / 4]}>
          <planeGeometry args={[0.62, 0.15]} />
          <meshBasicMaterial color={palette.error} toneMapped={false} />
        </mesh>
      </group>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 0.22, 7.6], target: [0, 0.22, 0] },
  grid: false,
  orbit: false,
  params: [
    {
      key: "latency",
      label: "Bottom peer latency",
      min: 20,
      max: 500,
      step: 20,
      value: 100,
      unit: " ms",
    },
    { key: "spike", label: "Latency spike", type: "toggle", value: true },
    {
      key: "delay",
      label: "Scheduling delay",
      min: 1,
      max: 6,
      step: 1,
      value: 2,
      unit: " turns",
    },
    { key: "desync", label: "Inject desync", type: "toggle", value: false },
  ],
  readout: (v) =>
    `Stall-free up to ${v.delay * TURN_MS} ms one-way · input lag ${v.delay * TURN_MS} ms or more`,
  Scene,
})
