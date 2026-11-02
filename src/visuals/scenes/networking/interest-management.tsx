import { useEffect, useMemo, useRef } from "react"
import { Line } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import {
  baselineUpdates,
  InterestSim,
  LEAVE_RATIO,
  MAX_MARKS,
  TICK_HZ,
  VIEWER,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "@/lib/interest-management"

import { defineVisual, palette, useClock, useLiveReadout } from "../../kit"

type V = {
  count: number
  radius: number
  hysteresis: boolean
  interest: boolean
}

const MAX_ENTITIES = 300
const MARK_SECONDS = 1.2
const OX = -WORLD_WIDTH / 2
const OY = -WORLD_HEIGHT / 2

const circlePoints = (r: number): [number, number, number][] =>
  Array.from({ length: 97 }, (_, i) => {
    const a = (i / 96) * Math.PI * 2
    return [Math.cos(a) * r, Math.sin(a) * r, 0]
  })

function plusGeometry() {
  const a = 1
  const b = 0.3
  const shape = new THREE.Shape()
  const outline: [number, number][] = [
    [b, b],
    [b, a],
    [-b, a],
    [-b, b],
    [-a, b],
    [-a, -b],
    [-b, -b],
    [-b, -a],
    [b, -a],
    [b, -b],
    [a, -b],
    [a, b],
  ]
  shape.moveTo(...outline[0])
  outline.slice(1).forEach((p) => shape.lineTo(...p))
  return new THREE.ShapeGeometry(shape)
}

function gridGeometry(cell: number) {
  const points: number[] = []
  for (let x = cell; x < WORLD_WIDTH; x += cell)
    points.push(OX + x, OY, 0, OX + x, -OY, 0)
  for (let y = cell; y < WORLD_HEIGHT; y += cell)
    points.push(OX, OY + y, 0, -OX, OY + y, 0)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3))
  return geometry
}

function Scene({ v }: { v: V }) {
  const time = useClock()
  const sim = useMemo(
    () =>
      new InterestSim({
        n: v.count,
        radius: v.radius,
        hysteresis: v.hysteresis,
        interest: v.interest,
        startTick: Math.floor(time.current * TICK_HZ),
      }),
    // Other settings are applied in place, so entities keep moving smoothly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [v.count]
  )
  const simRef = useRef(sim)
  simRef.current = sim
  const xs = useMemo(() => new Float64Array(v.count), [v.count])
  const ys = useMemo(() => new Float64Array(v.count), [v.count])

  const viewer = useRef<THREE.Group>(null)
  const block = useRef<THREE.Mesh>(null)
  const sent = useRef<THREE.InstancedMesh>(null)
  const others = useRef<THREE.InstancedMesh>(null)
  const pluses = useRef<THREE.InstancedMesh>(null)
  const minuses = useRef<THREE.InstancedMesh>(null)

  const plus = useMemo(plusGeometry, [])
  const grid = useMemo(() => gridGeometry(v.radius), [v.radius])
  const enterPoints = useMemo(() => circlePoints(v.radius), [v.radius])
  const leavePoints = useMemo(
    () => circlePoints(v.radius * LEAVE_RATIO),
    [v.radius]
  )
  const dummy = useMemo(() => new THREE.Object3D(), [])
  useEffect(() => () => plus.dispose(), [plus])
  useEffect(() => () => grid.dispose(), [grid])

  const put = (
    mesh: THREE.InstancedMesh,
    i: number,
    x: number,
    y: number,
    z: number,
    s: number
  ) => {
    dummy.position.set(x, y, z)
    dummy.scale.set(s, s, 1)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  }
  const commit = (mesh: THREE.InstancedMesh, count: number) => {
    mesh.count = count
    mesh.instanceMatrix.needsUpdate = true
  }

  useFrame(() => {
    if (
      !viewer.current ||
      !block.current ||
      !sent.current ||
      !others.current ||
      !pluses.current ||
      !minuses.current
    )
      return
    sim.configure(v.radius, v.hysteresis, v.interest)
    const now = time.current
    const target = Math.floor(now * TICK_HZ)
    if (target + 1 < sim.tick) sim.restart(target) // the clock was reset
    while (sim.tick <= target) sim.step()

    // Draw at the exact time; membership changes on server ticks.
    sim.wanderers.write(now, xs, ys)
    const vx = xs[VIEWER]
    const vy = ys[VIEWER]
    viewer.current.position.set(OX + vx, OY + vy, 0.03)

    let a = 0
    let b = 0
    for (let e = 0; e < v.count; e++) {
      if (e === VIEWER) continue
      if (sim.has(VIEWER, e))
        put(sent.current, a++, OX + xs[e], OY + ys[e], 0.02, 0.16)
      else put(others.current, b++, OX + xs[e], OY + ys[e], 0.01, 0.1)
    }
    commit(sent.current, a)
    commit(others.current, b)

    // The cells a viewer's query actually scans.
    const cell = v.radius
    const x0 = Math.max(0, Math.floor((vx - cell) / cell)) * cell
    const y0 = Math.max(0, Math.floor((vy - cell) / cell)) * cell
    const x1 = Math.min(
      WORLD_WIDTH,
      (Math.floor((vx + cell) / cell) + 1) * cell
    )
    const y1 = Math.min(
      WORLD_HEIGHT,
      (Math.floor((vy + cell) / cell) + 1) * cell
    )
    block.current.position.set(OX + (x0 + x1) / 2, OY + (y0 + y1) / 2, -0.02)
    block.current.scale.set(x1 - x0, y1 - y0, 1)

    let p = 0
    let m = 0
    for (let i = 0; i < MAX_MARKS; i++) {
      const age = now - sim.markTick[i] / TICK_HZ
      if (age < 0 || age > MARK_SECONDS) continue
      const size = 0.24 * (1 - (0.5 * age) / MARK_SECONDS)
      const x = OX + sim.markX[i]
      const y = OY + sim.markY[i]
      if (sim.markKind[i] > 0) put(pluses.current, p++, x, y, 0.04, size)
      else put(minuses.current, m++, x, y, 0.04, size)
    }
    commit(pluses.current, p)
    commit(minuses.current, m)
  })

  useLiveReadout(() => {
    const s = simRef.current
    const { messages, enters, leaves } = s.rates()
    const baseline = baselineUpdates(s.n) * TICK_HZ
    const share = (100 * messages) / baseline
    return `Viewer is sent ${s.size(VIEWER)} of ${s.n - 1} · ${Math.round(messages).toLocaleString("en-US")} vs ${baseline.toLocaleString("en-US")} msgs/s for everything (${share.toFixed(1)}%) · all clients: ${Math.round(enters)} enter + ${Math.round(leaves)} leave /s`
  })

  return (
    <>
      {/* World and grid. The shaded block is what the viewer's query scans. */}
      <mesh position={[0, 0, -0.04]}>
        <planeGeometry args={[WORLD_WIDTH, WORLD_HEIGHT]} />
        <meshBasicMaterial color={palette.stage} toneMapped={false} />
      </mesh>
      <mesh ref={block} visible={v.interest}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.surface} toneMapped={false} />
      </mesh>
      <lineSegments geometry={grid} position={[0, 0, -0.01]}>
        <lineBasicMaterial color={palette.grid} toneMapped={false} />
      </lineSegments>
      <Line
        points={[
          [OX, OY, 0],
          [-OX, OY, 0],
          [-OX, -OY, 0],
          [OX, -OY, 0],
          [OX, OY, 0],
        ]}
        color={palette.tertiary}
        lineWidth={1}
      />

      <instancedMesh
        ref={others}
        args={[undefined, undefined, MAX_ENTITIES]}
        frustumCulled={false}
      >
        <ringGeometry args={[0.62, 1, 16]} />
        <meshBasicMaterial color={palette.tertiary} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={sent}
        args={[undefined, undefined, MAX_ENTITIES]}
        frustumCulled={false}
      >
        <circleGeometry args={[1, 20]} />
        <meshBasicMaterial color={palette.moving} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={pluses}
        args={[plus, undefined, MAX_MARKS]}
        frustumCulled={false}
      >
        <meshBasicMaterial color={palette.success} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={minuses}
        args={[undefined, undefined, MAX_MARKS]}
        frustumCulled={false}
      >
        <planeGeometry args={[2, 0.6]} />
        <meshBasicMaterial color={palette.error} toneMapped={false} />
      </instancedMesh>

      <group ref={viewer}>
        <mesh>
          <circleGeometry args={[0.2, 32]} />
          <meshBasicMaterial color={palette.subject} toneMapped={false} />
        </mesh>
        {v.interest && (
          <Line points={enterPoints} color={palette.subject} lineWidth={2} />
        )}
        {v.interest && v.hysteresis && (
          <Line
            points={leavePoints}
            color={palette.subject}
            lineWidth={1.5}
            dashed
            dashSize={0.22}
            gapSize={0.18}
          />
        )}
      </group>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 0, 10], target: [0, 0, 0] },
  orbit: false,
  params: [
    {
      key: "count",
      label: "Entities",
      min: 20,
      max: MAX_ENTITIES,
      step: 10,
      value: 120,
    },
    {
      key: "radius",
      label: "Enter radius",
      min: 0.8,
      max: 3,
      step: 0.1,
      value: 1.6,
      unit: "u",
    },
    { key: "hysteresis", label: "Hysteresis", type: "toggle", value: true },
    {
      key: "interest",
      label: "Interest management",
      type: "toggle",
      value: true,
    },
  ],
  readout: (v) =>
    v.interest
      ? `Enter ${v.radius.toFixed(1)} u · leave ${(v.hysteresis ? v.radius * LEAVE_RATIO : v.radius).toFixed(2)} u · grid cell ${v.radius.toFixed(1)} u`
      : `Everything to everyone: ${baselineUpdates(v.count).toLocaleString("en-US")} updates per tick`,
  Scene,
})
