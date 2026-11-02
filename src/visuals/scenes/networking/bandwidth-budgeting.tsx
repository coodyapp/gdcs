import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import {
  BudgetSim,
  GAME_HEADER,
  kbitToBytes,
  packetCapacity,
  SAFE_PAYLOAD,
  STALE_LIMIT_MS,
  tickAllowance,
} from "@/lib/bandwidth-budget"

import { defineVisual, palette, useLiveReadout, useVisual } from "../../kit"

type V = { budget: number; sendHz: number; count: number; accumulator: boolean }

/** Quarter speed, so one tick's yellow can be seen. */
const SPEED = 0.25
const WARM_SECONDS = 2
const MAX_ENTITIES = 64

const LEFT = -6
const WIDTH = 12
const BAR_BASE = 0.55
const BAR_HEIGHT = 3
const OUTLINE = 0.035
/** Age columns hang from here, and reach the limit line at the staleness limit. */
const AGE_TOP = 0.4
const AGE_AT_LIMIT = 1.2
const AGE_MAX = 1.5
const TRIANGLE_Y = AGE_TOP - AGE_MAX - 0.2
const PACKET_Y = -2.75
const PACKET_HEIGHT = 0.62

function Scene({ v }: { v: V }) {
  const { playing, resetKey } = useVisual()
  const sim = useMemo(() => {
    const s = new BudgetSim({
      budget: kbitToBytes(v.budget),
      sendHz: v.sendHz,
      count: v.count,
      accumulator: v.accumulator,
    })
    // Start from a running system, so the first frame already shows the idea.
    for (let t = 0; t < WARM_SECONDS * v.sendHz; t++) s.step()
    return s
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.budget, v.sendHz, v.count, v.accumulator, resetKey])

  // Tall enough for the priority entities are usually sent at.
  const barScale = useMemo(() => {
    if (!v.accumulator) return 1
    const { priority, size } = sim.entities
    const room = sim.capacity - GAME_HEADER
    if (room <= 0) return 2
    let sum = 0
    for (let i = 0; i < sim.count; i++) sum += priority[i] * size[i]
    return Math.max(1, (1.25 * sum) / room)
  }, [sim, v.accumulator])

  const acc = useRef(0)
  const bars = useRef<THREE.InstancedMesh>(null)
  const hollows = useRef<THREE.InstancedMesh>(null)
  const ages = useRef<THREE.InstancedMesh>(null)
  const triangles = useRef<THREE.InstancedMesh>(null)
  const chips = useRef<THREE.InstancedMesh>(null)
  const headerBlock = useRef<THREE.Mesh>(null)
  const frame = useRef<THREE.Mesh>(null)
  const marker = useRef<THREE.Mesh>(null)

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const colors = useMemo(
    () => ({
      grey: new THREE.Color(palette.tertiary),
      light: new THREE.Color(palette.accel),
      yellow: new THREE.Color(palette.moving),
      red: new THREE.Color(palette.error),
    }),
    []
  )

  const put = (
    mesh: THREE.InstancedMesh,
    i: number,
    x: number,
    y: number,
    sx: number,
    sy: number,
    angle = 0
  ) => {
    dummy.position.set(x, y, 0)
    dummy.scale.set(sx, sy, 1)
    dummy.rotation.set(0, 0, angle)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  }
  const commit = (mesh: THREE.InstancedMesh, count: number) => {
    mesh.count = count
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }

  useFrame((_, delta) => {
    if (
      !bars.current ||
      !hollows.current ||
      !ages.current ||
      !triangles.current ||
      !chips.current ||
      !headerBlock.current ||
      !frame.current ||
      !marker.current
    )
      return
    if (playing) {
      acc.current += Math.min(delta, 0.1) * SPEED * sim.sendHz
      while (acc.current >= 1) {
        sim.step()
        acc.current -= 1
      }
    }

    const pitch = WIDTH / sim.count
    const barWidth = pitch * 0.72
    const limitTicks = (STALE_LIMIT_MS / 1000) * sim.sendHz
    let hollow = 0
    let stale = 0
    for (let i = 0; i < sim.count; i++) {
      const x = LEFT + pitch * (i + 0.5)
      const isSent = sim.sent[i] === 1
      const value = isSent ? sim.sentAt[i] : sim.accumulated[i]
      const h = Math.min(
        Math.max((value / barScale) * BAR_HEIGHT, 0.08),
        BAR_HEIGHT
      )
      // Solid yellow when sent; a grey outline while waiting.
      put(bars.current, i, x, BAR_BASE + h / 2, barWidth, h)
      bars.current.setColorAt(i, isSent ? colors.yellow : colors.grey)
      if (!isSent) {
        put(
          hollows.current,
          hollow++,
          x,
          BAR_BASE + h / 2,
          Math.max(barWidth - OUTLINE * 2, 0.001),
          Math.max(h - OUTLINE * 2, 0.001)
        )
      }

      // Age hangs below the bar and turns red past the limit line.
      const over = sim.age[i] > limitTicks
      const ageHeight = Math.min(
        (sim.age[i] / limitTicks) * AGE_AT_LIMIT,
        AGE_MAX
      )
      put(ages.current, i, x, AGE_TOP - ageHeight / 2, barWidth, ageHeight)
      ages.current.setColorAt(i, over ? colors.red : colors.light)
      if (over) {
        const size = Math.min(pitch * 0.5, 0.17)
        put(triangles.current, stale++, x, TRIANGLE_Y, size, size, -Math.PI / 2)
      }
    }
    commit(bars.current, sim.count)
    commit(hollows.current, hollow)
    commit(ages.current, sim.count)
    commit(triangles.current, stale)

    // This tick's packet against what the budget allows per tick.
    const perByte = WIDTH / sim.allowance
    const headerBytes = sim.header + GAME_HEADER
    headerBlock.current.visible = sim.packetCount > 0
    headerBlock.current.position.x = LEFT + (headerBytes * perByte) / 2
    headerBlock.current.scale.x = headerBytes * perByte
    let bytes = headerBytes
    const gap = Math.min(0.025, perByte * 4)
    for (let k = 0; k < sim.packetCount; k++) {
      const size = sim.entities.size[sim.packet[k]]
      const x = LEFT + (bytes + size / 2) * perByte
      put(chips.current, k, x, PACKET_Y, size * perByte - gap, PACKET_HEIGHT)
      bytes += size
    }
    commit(chips.current, sim.packetCount)

    const late = stale > 0
    marker.current.visible = late
    const frameMaterial = frame.current.material as THREE.MeshBasicMaterial
    frameMaterial.color.copy(late ? colors.red : colors.grey)
  })

  useLiveReadout(() => {
    const room = sim.capacity - GAME_HEADER
    const worst = Math.round(sim.ticksToMs(sim.peakAge))
    const prefix =
      sim.packetsSent === 0 && room < 16
        ? `Headers use the budget: ${sim.allowance} B a tick holds no entity · `
        : ""
    return `${prefix}${sim.bytesPerSecond.toLocaleString("en-US")} B/s · headers ${(sim.headerFraction * 100).toFixed(1)}% · ${sim.entitiesPerPacket.toFixed(1)} entities/packet · worst staleness ${worst.toLocaleString("en-US")} ms`
  })

  const wireLimit = SAFE_PAYLOAD + sim.header
  const mtuX =
    sim.allowance > wireLimit
      ? LEFT + (wireLimit / sim.allowance) * WIDTH
      : null
  const limitY = AGE_TOP - AGE_AT_LIMIT

  return (
    <>
      {/* Priority bars: each hollow is a stage-coloured inset over a grey bar. */}
      <instancedMesh
        ref={bars}
        args={[undefined, undefined, MAX_ENTITIES]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={hollows}
        args={[undefined, undefined, MAX_ENTITIES]}
        position={[0, 0, 0.01]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.stage} toneMapped={false} />
      </instancedMesh>
      <mesh position={[0, BAR_BASE - 0.075, 0]}>
        <planeGeometry args={[WIDTH, 0.03]} />
        <meshBasicMaterial color={palette.tertiary} toneMapped={false} />
      </mesh>

      {/* Age columns, the staleness limit line and the marks past it. */}
      <instancedMesh
        ref={ages}
        args={[undefined, undefined, MAX_ENTITIES]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <mesh position={[0, limitY, 0.02]}>
        <planeGeometry args={[WIDTH, 0.03]} />
        <meshBasicMaterial color={palette.subject} toneMapped={false} />
      </mesh>
      <instancedMesh
        ref={triangles}
        args={[undefined, undefined, MAX_ENTITIES]}
        frustumCulled={false}
      >
        <circleGeometry args={[1, 3]} />
        <meshBasicMaterial color={palette.error} toneMapped={false} />
      </instancedMesh>

      {/* This tick's packet inside the bytes the budget allows per tick. */}
      <mesh ref={frame} position={[0, PACKET_Y, -0.02]}>
        <planeGeometry
          args={[WIDTH + OUTLINE * 2, PACKET_HEIGHT + OUTLINE * 2 + 0.1]}
        />
        <meshBasicMaterial toneMapped={false} />
      </mesh>
      <mesh position={[0, PACKET_Y, -0.01]}>
        <planeGeometry args={[WIDTH, PACKET_HEIGHT + 0.1]} />
        <meshBasicMaterial color={palette.stage} toneMapped={false} />
      </mesh>
      <mesh ref={headerBlock} position={[0, PACKET_Y, 0.01]}>
        <planeGeometry args={[1, PACKET_HEIGHT]} />
        <meshBasicMaterial color={palette.accel} toneMapped={false} />
      </mesh>
      <instancedMesh
        ref={chips}
        args={[undefined, undefined, MAX_ENTITIES]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.moving} toneMapped={false} />
      </instancedMesh>
      {mtuX !== null && (
        <mesh position={[mtuX, PACKET_Y, 0.02]}>
          <planeGeometry args={[0.05, PACKET_HEIGHT + 0.34]} />
          <meshBasicMaterial color={palette.subject} toneMapped={false} />
        </mesh>
      )}
      <mesh
        ref={marker}
        position={[
          LEFT + WIDTH - 0.08,
          PACKET_Y + PACKET_HEIGHT / 2 + 0.3,
          0.03,
        ]}
        rotation={[0, 0, Math.PI / 4]}
        visible={false}
      >
        <planeGeometry args={[0.26, 0.26]} />
        <meshBasicMaterial color={palette.error} toneMapped={false} />
      </mesh>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 0, 10], target: [0, 0, 0] },
  orbit: false,
  params: [
    {
      key: "budget",
      label: "Budget",
      min: 16,
      max: 128,
      step: 4,
      value: 32,
      unit: "kbit/s",
    },
    {
      key: "sendHz",
      label: "Send rate",
      min: 5,
      max: 60,
      step: 5,
      value: 20,
      unit: "Hz",
    },
    {
      key: "count",
      label: "Entities",
      min: 8,
      max: MAX_ENTITIES,
      step: 4,
      value: 28,
    },
    {
      key: "accumulator",
      label: "Priority accumulator",
      type: "toggle",
      value: true,
    },
  ],
  readout: (v) => {
    const budget = kbitToBytes(v.budget)
    return `${budget.toLocaleString("en-US")} B/s budget = ${tickAllowance(budget, v.sendHz)} B per tick, ${packetCapacity(budget, v.sendHz)} B of payload`
  },
  Scene,
})
