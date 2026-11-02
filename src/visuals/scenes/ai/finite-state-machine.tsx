import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import { StateMachine, type TransitionTable } from "@/lib/fsm"

import { defineVisual, lerp, palette, useFixedStep, useVisual } from "../../kit"

type V = { see: number; lose: number; speed: number }

type S = "idle" | "patrol" | "chase" | "attack"
type E = "rested" | "spotted" | "inRange" | "done" | "lost"

const TABLE: TransitionTable<S, E> = {
  idle: { rested: "patrol", spotted: "chase" },
  patrol: { spotted: "chase" },
  chase: { inRange: "attack", lost: "idle" },
  attack: { done: "chase" },
}

const COLOR: Record<S, string> = {
  idle: palette.guide,
  patrol: palette.success,
  chase: palette.velocity,
  attack: palette.error,
}

// State diagram on the right; arena on the left.
const NODE: Record<S, [number, number]> = {
  idle: [2.3, -1.3],
  patrol: [4.6, -1.3],
  chase: [4.6, 1.3],
  attack: [2.3, 1.3],
}
const NODE_R = 0.42

// Each state also has its own silhouette, so it never relies on hue alone:
// idle = circle, patrol = square, chase = triangle, attack = star.
function starGeometry(r: number, depth: number) {
  const shape = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2
    const k = i % 2 === 0 ? r : r * 0.48
    if (i === 0) shape.moveTo(Math.cos(a) * k, Math.sin(a) * k)
    else shape.lineTo(Math.cos(a) * k, Math.sin(a) * k)
  }
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
  g.rotateX(-Math.PI / 2)
  g.translate(0, -depth / 2, 0)
  return g
}
const SHAPE: Record<S, THREE.BufferGeometry> = {
  idle: new THREE.CylinderGeometry(NODE_R, NODE_R, 0.1, 32),
  patrol: new THREE.CylinderGeometry(
    NODE_R * 1.2,
    NODE_R * 1.2,
    0.1,
    4,
    1,
    false,
    Math.PI / 4
  ),
  chase: new THREE.CylinderGeometry(NODE_R * 1.3, NODE_R * 1.3, 0.1, 3),
  attack: starGeometry(NODE_R * 1.3, 0.1),
}
const EDGES: { from: S; to: S; bend: number }[] = [
  { from: "idle", to: "patrol", bend: 0 },
  { from: "patrol", to: "chase", bend: 0 },
  { from: "idle", to: "chase", bend: 0.18 },
  { from: "chase", to: "idle", bend: 0.18 },
  { from: "chase", to: "attack", bend: 0.18 },
  { from: "attack", to: "chase", bend: 0.18 },
]

const WAYPOINTS: [number, number][] = [
  [-4.3, -1.3],
  [-1.0, -1.3],
]
// Scripted player: [time, x, z] keyframes, looped.
const SCRIPT: [number, number, number][] = [
  [0, 0.4, 2.2],
  [3.5, 0.4, 2.2],
  [5.5, -2.4, -0.4],
  [8.5, -2.4, -0.4],
  [9.3, 0.4, 2.2],
  [13, 0.4, 2.2],
]
const LOOP = SCRIPT[SCRIPT.length - 1][0]
const ATTACK_RANGE = 0.9
const ATTACK_TIME = 0.6
const IDLE_TIME = 1.5

function playerAt(t: number, out: THREE.Vector2) {
  const u = t % LOOP
  for (let i = 1; i < SCRIPT.length; i++) {
    const [t1, x1, z1] = SCRIPT[i]
    if (u <= t1) {
      const [t0, x0, z0] = SCRIPT[i - 1]
      const k = (u - t0) / (t1 - t0)
      return out.set(lerp(x0, x1, k), lerp(z0, z1, k))
    }
  }
  return out
}

function edgeGeometry(from: S, to: S, bend: number) {
  const a = new THREE.Vector2(...NODE[from])
  const b = new THREE.Vector2(...NODE[to])
  const d = b.clone().sub(a).normalize()
  const n = new THREE.Vector2(-d.y, d.x).multiplyScalar(bend)
  const p0 = a
    .clone()
    .addScaledVector(d, NODE_R + 0.05)
    .add(n)
  const p1 = b
    .clone()
    .addScaledVector(d, -(NODE_R + 0.12))
    .add(n)
  return {
    points: [
      [p0.x, 0.05, p0.y],
      [p1.x, 0.05, p1.y],
    ] as [number, number, number][],
    tip: [p1.x, 0.05, p1.y] as [number, number, number],
    // Cone points +Y; lay it flat and aim it along d.
    rot: [Math.PI / 2, 0, Math.atan2(-d.x, d.y)] as [number, number, number],
  }
}

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const [state, setState] = useState<S>("idle")
  const [lastEdge, setLastEdge] = useState("")
  const sim = useMemo(
    () => ({
      t: 0,
      guard: new THREE.Vector2(...WAYPOINTS[0]),
      heading: 0,
      wp: 1,
      player: new THREE.Vector2(),
      fsm: new StateMachine(TABLE, "idle"),
    }),
    []
  )
  const hooks = useRef({ setState, setLastEdge })
  hooks.current = { setState, setLastEdge }
  useEffect(() => {
    sim.t = 0
    sim.guard.set(...WAYPOINTS[0])
    sim.wp = 1
    sim.fsm = new StateMachine(TABLE, "idle", {
      transition: (from, to) => {
        hooks.current.setState(to)
        hooks.current.setLastEdge(`${from}>${to}`)
      },
    })
    setState("idle")
    setLastEdge("")
  }, [sim, resetKey])

  const tmp = useMemo(() => new THREE.Vector2(), [])
  useFixedStep((dt) => {
    sim.t += dt
    const { fsm, guard, player } = sim
    fsm.update(dt)
    playerAt(sim.t, player)
    const d = guard.distanceTo(player)

    // Sensors → events. Illegal events for the current state are ignored.
    if (fsm.state === "idle" && fsm.time > IDLE_TIME) fsm.send("rested")
    if (d < v.see) fsm.send("spotted")
    if (d < ATTACK_RANGE) fsm.send("inRange")
    if (d > v.lose) fsm.send("lost")
    if (fsm.state === "attack" && fsm.time > ATTACK_TIME) fsm.send("done")

    // Per-state behaviour.
    let goal: THREE.Vector2 | null = null
    let speed = 0
    let stopAt = 0.05
    if (fsm.state === "patrol") {
      goal = tmp.set(...WAYPOINTS[sim.wp])
      speed = 1.1
      if (guard.distanceTo(goal) < 0.1) sim.wp = 1 - sim.wp
    } else if (fsm.state === "chase") {
      goal = player
      speed = v.speed
      stopAt = ATTACK_RANGE * 0.8
    }
    if (goal) {
      const dist = guard.distanceTo(goal)
      if (dist > stopAt) {
        const s = Math.min(speed * dt, dist - stopAt)
        const dx = (goal.x - guard.x) / dist
        const dz = (goal.y - guard.y) / dist
        guard.x += dx * s
        guard.y += dz * s
        sim.heading = Math.atan2(dx, dz)
      }
    }
  }, 60)

  const guardRef = useRef<THREE.Group>(null)
  const playerRef = useRef<THREE.Mesh>(null)
  const sightRef = useRef<THREE.Group>(null)
  const slash = useRef<THREE.Mesh>(null)
  const sight = useMemo(
    () =>
      Array.from({ length: 65 }, (_, i) => {
        const a = (i / 64) * Math.PI * 2
        return [Math.cos(a), 0.02, Math.sin(a)] as [number, number, number]
      }),
    []
  )

  useFrame(() => {
    guardRef.current?.position.set(sim.guard.x, 0, sim.guard.y)
    if (guardRef.current) guardRef.current.rotation.y = sim.heading
    playerRef.current?.position.set(sim.player.x, 0.3, sim.player.y)
    sightRef.current?.position.set(sim.guard.x, 0, sim.guard.y)
    if (slash.current) {
      const on = sim.fsm.state === "attack"
      slash.current.visible = on
      slash.current.scale.setScalar(
        0.6 + 0.6 * Math.min(1, sim.fsm.time / ATTACK_TIME)
      )
    }
  })

  const edges = useMemo(
    () => EDGES.map((e) => ({ ...e, ...edgeGeometry(e.from, e.to, e.bend) })),
    []
  )

  return (
    <>
      {/* Arena */}
      <Line
        points={WAYPOINTS.map(
          ([x, z]) => [x, 0.02, z] as [number, number, number]
        )}
        color={palette.guide}
        lineWidth={1}
        dashed
        dashSize={0.15}
        gapSize={0.1}
      />
      {WAYPOINTS.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.12, 20]} />
          <meshBasicMaterial color={palette.guide} />
        </mesh>
      ))}
      <group ref={sightRef}>
        <group scale={[v.see, 1, v.see]}>
          <Line
            points={sight}
            color={COLOR[state]}
            lineWidth={1}
            transparent
            opacity={0.6}
          />
        </group>
      </group>
      <group ref={guardRef}>
        <mesh position={[0, 0.55, 0]}>
          <capsuleGeometry args={[0.28, 0.5, 6, 16]} />
          <meshStandardMaterial
            color={palette.subject}
            emissive={palette.subject}
            emissiveIntensity={0.25}
          />
        </mesh>
        {/* State badge: same colour + silhouette as the diagram node. */}
        <mesh position={[0, 1.35, 0]} scale={0.55} geometry={SHAPE[state]}>
          <meshBasicMaterial color={COLOR[state]} />
        </mesh>
        <mesh position={[0, 0.75, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.1, 0.22, 10]} />
          <meshStandardMaterial color={palette.foreground} />
        </mesh>
        <mesh ref={slash} position={[0, 0.5, 0.55]} visible={false}>
          <torusGeometry args={[0.35, 0.04, 6, 20, Math.PI]} />
          <meshBasicMaterial color={palette.negative} />
        </mesh>
      </group>
      <mesh ref={playerRef}>
        <sphereGeometry args={[0.24, 20, 14]} />
        <meshStandardMaterial
          color={palette.secondary}
          emissive={palette.secondary}
          emissiveIntensity={0.35}
        />
      </mesh>

      {/* State diagram */}
      <mesh position={[3.45, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.6, 3.7]} />
        <meshBasicMaterial color={palette.stage} />
      </mesh>
      {edges.map((e) => {
        const lit = lastEdge === `${e.from}>${e.to}`
        const c = lit ? palette.foreground : palette.object
        return (
          <group key={`${e.from}>${e.to}`}>
            <Line points={e.points} color={c} lineWidth={lit ? 3 : 1.5} />
            <mesh position={e.tip} rotation={e.rot}>
              <coneGeometry args={[0.08, 0.2, 10]} />
              <meshBasicMaterial color={c} />
            </mesh>
          </group>
        )
      })}
      {(Object.keys(NODE) as S[]).map((s) => {
        const [x, z] = NODE[s]
        const on = s === state
        return (
          <group key={s} position={[x, 0, z]}>
            <mesh
              position={[0, 0.06, 0]}
              scale={on ? 1.15 : 1}
              geometry={SHAPE[s]}
            >
              <meshStandardMaterial
                color={COLOR[s]}
                emissive={COLOR[s]}
                emissiveIntensity={on ? 0.6 : 0}
                transparent
                opacity={on ? 1 : 0.35}
              />
            </mesh>
            {on && (
              <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[NODE_R * 1.3, NODE_R * 1.42, 40]} />
                <meshBasicMaterial color={palette.foreground} />
              </mesh>
            )}
          </group>
        )
      })}
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 9, 5.2], target: [0, 0, 0.5] },
  params: [
    {
      key: "see",
      label: "Spot radius",
      min: 1,
      max: 4,
      step: 0.1,
      value: 2.5,
      unit: "u",
      digits: 1,
    },
    {
      key: "lose",
      label: "Lose radius",
      min: 2,
      max: 6,
      step: 0.1,
      value: 3.2,
      unit: "u",
      digits: 1,
    },
    {
      key: "speed",
      label: "Chase speed",
      min: 0.5,
      max: 3,
      step: 0.1,
      value: 1.2,
      unit: "u/s",
      digits: 1,
    },
  ],
  readout: (v) =>
    `Hysteresis ${(v.lose - v.see).toFixed(1)} u · attack range ${ATTACK_RANGE} u · attack lasts ${ATTACK_TIME} s`,
  Scene,
})
