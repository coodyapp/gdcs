import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import { type Agent, arrive, integrate, seek, separation } from "@/lib/steering"

import { defineVisual, palette, useFixedStep, useVisual } from "../../kit"

type V = { mode: string; count: number; sep: number; slow: number }

const MAX = 24
const MAX_SPEED = 3.2
const MAX_FORCE = 14
const SEP_RADIUS = 0.9
const SEP_GAIN = 4
const SPOTS: [number, number][] = [
  [2.6, -1.2],
  [-2.4, -1.4],
  [-1.6, 1.6],
  [2.2, 1.5],
]
const MOVE = 1.1
const HOLD = 2.8

const ringPoints = (r: number) =>
  Array.from({ length: 65 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2
    return [Math.cos(a) * r, 0.02, Math.sin(a) * r] as [number, number, number]
  })

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const agents = useMemo<Agent[]>(
    () =>
      Array.from({ length: v.count }, () => ({
        pos: { x: 0, y: 0 },
        vel: { x: 0, y: 0 },
      })),
    [v.count]
  )
  const sim = useRef({ t: 0 })
  useEffect(() => {
    // Start on an ellipse around the arena.
    agents.forEach((a, i) => {
      const ang = (i / agents.length) * Math.PI * 2
      a.pos.x = Math.cos(ang) * 3.5
      a.pos.y = Math.sin(ang) * 2.2
      a.vel.x = a.vel.y = 0
    })
    sim.current.t = 0
  }, [agents, resetKey])
  const target = useMemo(() => ({ x: SPOTS[0][0], y: SPOTS[0][1] }), [])
  const f = useMemo(() => ({ x: 0, y: 0 }), [])
  const s = useMemo(() => ({ x: 0, y: 0 }), [])

  useFixedStep((dt) => {
    const st = sim.current
    st.t += dt
    // Target glides between spots, then holds still so "arrive" can settle.
    const leg = MOVE + HOLD
    const k = Math.floor(st.t / leg)
    const u = Math.min(1, (st.t - k * leg) / MOVE)
    const e = u * u * (3 - 2 * u)
    const [ax, ay] = SPOTS[k % SPOTS.length]
    const [bx, by] = SPOTS[(k + 1) % SPOTS.length]
    target.x = ax + (bx - ax) * e
    target.y = ay + (by - ay) * e

    for (let i = 0; i < agents.length; i++) {
      const a = agents[i]
      if (v.mode === "seek") seek(a, target, MAX_SPEED, f)
      else arrive(a, target, MAX_SPEED, v.slow, f)
      separation(i, agents, SEP_RADIUS, s)
      f.x += s.x * v.sep * SEP_GAIN
      f.y += s.y * v.sep * SEP_GAIN
      integrate(a, f, MAX_FORCE, MAX_SPEED, dt)
    }
  }, 60)

  const cones = useRef<THREE.InstancedMesh>(null)
  const goal = useRef<THREE.Group>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const dir = useMemo(() => new THREE.Vector3(), [])
  const velGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(MAX * 6), 3)
    )
    return g
  }, [])
  const ring = useMemo(() => ringPoints(v.slow), [v.slow])

  useFrame(() => {
    goal.current?.position.set(target.x, 0, target.y)
    const m = cones.current
    if (!m) return
    const pos = velGeo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i]
      const sp = Math.hypot(a.vel.x, a.vel.y)
      dummy.position.set(a.pos.x, 0.25, a.pos.y)
      if (sp > 1e-3) {
        dir.set(a.vel.x / sp, 0, a.vel.y / sp)
        dummy.quaternion.setFromUnitVectors(up, dir)
      }
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      pos.setXYZ(i * 2, a.pos.x, 0.25, a.pos.y)
      pos.setXYZ(
        i * 2 + 1,
        a.pos.x + a.vel.x * 0.35,
        0.25,
        a.pos.y + a.vel.y * 0.35
      )
    }
    m.count = agents.length
    m.instanceMatrix.needsUpdate = true
    velGeo.setDrawRange(0, agents.length * 2)
    pos.needsUpdate = true
  })

  return (
    <>
      <group ref={goal}>
        <mesh position={[0, 0.25, 0]}>
          <sphereGeometry args={[0.2, 20, 14]} />
          <meshStandardMaterial
            color={palette.secondary}
            emissive={palette.secondary}
            emissiveIntensity={0.4}
          />
        </mesh>
        {v.mode === "arrive" && (
          <Line points={ring} color={palette.guide} lineWidth={1.5} />
        )}
      </group>
      <instancedMesh
        ref={cones}
        args={[undefined, undefined, MAX]}
        frustumCulled={false}
      >
        <coneGeometry args={[0.14, 0.42, 12]} />
        <meshStandardMaterial color={palette.primary} />
      </instancedMesh>
      <lineSegments geometry={velGeo} frustumCulled={false}>
        <lineBasicMaterial color={palette.warning} />
      </lineSegments>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 7, 4.6], target: [0, 0, 0] },
  params: [
    {
      key: "mode",
      label: "Behaviour",
      type: "select",
      value: "arrive",
      options: [
        { value: "arrive", label: "Arrive" },
        { value: "seek", label: "Seek" },
      ],
    },
    { key: "count", label: "Agents", min: 1, max: MAX, step: 1, value: 10 },
    {
      key: "sep",
      label: "Separation weight",
      min: 0,
      max: 3,
      step: 0.1,
      value: 1.2,
      digits: 1,
    },
    {
      key: "slow",
      label: "Slowing radius",
      min: 0.5,
      max: 4,
      step: 0.1,
      value: 2,
      unit: "u",
      digits: 1,
    },
  ],
  readout: () =>
    `max speed ${MAX_SPEED} u/s · max force ${MAX_FORCE} · separation radius ${SEP_RADIUS} u`,
  Scene,
})
