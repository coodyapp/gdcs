import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import {
  activeBranch,
  createGuardWorld,
  GUARD,
  guardTree,
  stepGuard,
  type GuardOptions,
  type Status,
  type TickResult,
} from "@/lib/behavior-tree"

import {
  defineVisual,
  palette,
  useFixedStep,
  useLiveReadout,
  useVisual,
} from "../../kit"

type V = {
  autoTarget: boolean
  targetDistance: number
  maxHealth: number
  reactive: boolean
}

type P3 = [number, number, number]
type Shape = "rect" | "pill"

interface NodeView {
  id: string
  label: string
  x: number
  z: number
  w: number
  shape: Shape
  /** Selector tries left to right, so children show their priority. */
  rank?: string
  parent?: string
}

const NODE_H = 0.74
const ROW = [-2.75, -0.35, 2.05]
const COL = [0, 1.38, 2.76, 4.14, 5.52]

const NODES: NodeView[] = [
  {
    id: "root",
    label: "? selector",
    x: COL[2],
    z: ROW[0],
    w: 2.5,
    shape: "rect",
  },
  {
    id: "fleeBranch",
    label: "→ sequence",
    x: (COL[0] + COL[1]) / 2,
    z: ROW[1],
    w: 2.1,
    shape: "rect",
    rank: "1st",
    parent: "root",
  },
  {
    id: "chaseBranch",
    label: "→ sequence",
    x: (COL[2] + COL[3]) / 2,
    z: ROW[1],
    w: 2.1,
    shape: "rect",
    rank: "2nd",
    parent: "root",
  },
  {
    id: "patrol",
    label: "patrol",
    x: COL[4],
    z: ROW[1],
    w: 1.26,
    shape: "rect",
    rank: "3rd",
    parent: "root",
  },
  {
    id: "hurt",
    label: "hurt?",
    x: COL[0],
    z: ROW[2],
    w: 1.26,
    shape: "pill",
    parent: "fleeBranch",
  },
  {
    id: "flee",
    label: "flee",
    x: COL[1],
    z: ROW[2],
    w: 1.26,
    shape: "rect",
    parent: "fleeBranch",
  },
  {
    id: "near",
    label: "near?",
    x: COL[2],
    z: ROW[2],
    w: 1.26,
    shape: "pill",
    parent: "chaseBranch",
  },
  {
    id: "chase",
    label: "chase",
    x: COL[3],
    z: ROW[2],
    w: 1.26,
    shape: "rect",
    parent: "chaseBranch",
  },
]
const BY_ID = new Map(NODES.map((n) => [n.id, n]))

const WORLD_BOX: P3[] = [
  [GUARD.minX - 0.3, 0.01, GUARD.minZ - 0.3],
  [GUARD.maxX + 0.3, 0.01, GUARD.minZ - 0.3],
  [GUARD.maxX + 0.3, 0.01, GUARD.maxZ + 0.3],
  [GUARD.minX - 0.3, 0.01, GUARD.maxZ + 0.3],
  [GUARD.minX - 0.3, 0.01, GUARD.minZ - 0.3],
]
const BAR_X = (GUARD.minX + GUARD.maxX) / 2
const BAR_Z = GUARD.maxZ + 0.85
const BAR_W = GUARD.maxX - GUARD.minX + 0.6

// Labels are small canvas textures: no font download and no per-frame work.
const labelCache = new Map<string, { texture: THREE.Texture; aspect: number }>()
function labelTexture(text: string) {
  const cached = labelCache.get(text)
  if (cached) return cached
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")!
  const font = "600 56px ui-sans-serif, system-ui, -apple-system, sans-serif"
  ctx.font = font
  canvas.width = Math.ceil(ctx.measureText(text).width) + 12
  canvas.height = 76
  ctx.font = font
  ctx.fillStyle = "#ffffff"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const entry = { texture, aspect: canvas.width / canvas.height }
  labelCache.set(text, entry)
  return entry
}

function Label({
  text,
  position,
  size = 0.42,
  color = palette.foreground,
}: {
  text: string
  position: P3
  size?: number
  color?: string
}) {
  const { texture, aspect } = useMemo(() => labelTexture(text), [text])
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size * aspect, size]} />
      <meshBasicMaterial
        map={texture}
        color={color}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

function outlinePoints(w: number, shape: Shape): P3[] {
  const hw = w / 2
  const hh = NODE_H / 2
  const r = shape === "pill" ? hh : 0.07
  const pts: P3[] = []
  const corners: [number, number, number][] = [
    [hw - r, -hh + r, -Math.PI / 2],
    [hw - r, hh - r, 0],
    [-hw + r, hh - r, Math.PI / 2],
    [-hw + r, -hh + r, Math.PI],
  ]
  for (const [cx, cz, start] of corners) {
    for (let i = 0; i <= 8; i++) {
      const a = start + (i / 8) * (Math.PI / 2)
      pts.push([cx + Math.cos(a) * r, 0.03, cz + Math.sin(a) * r])
    }
  }
  pts.push(pts[0])
  return pts
}

function fillShape(w: number, shape: Shape) {
  const s = new THREE.Shape()
  outlinePoints(w, shape).forEach(([x, , z], i) => {
    if (i === 0) s.moveTo(x, z)
    else s.lineTo(x, z)
  })
  return s
}

const STATUS_COLOR: Record<Status, string> = {
  running: palette.velocity,
  success: palette.success,
  failure: palette.error,
}

/**
 * Status is redundant with shape: running = dashed yellow outline, success =
 * solid green fill, failure = red outline plus an X badge, untouched = thin
 * grey outline.
 */
function TreeNode({ node, status }: { node: NodeView; status?: Status }) {
  const points = useMemo(() => outlinePoints(node.w, node.shape), [node])
  const shape = useMemo(() => fillShape(node.w, node.shape), [node])
  const stroke = status ? STATUS_COLOR[status] : palette.tertiary
  const badgeX = node.w / 2 - 0.02
  const badgeZ = -NODE_H / 2 + 0.02
  const X = 0.09
  const text =
    status === "success"
      ? palette.stage
      : status
        ? palette.foreground
        : palette.guide
  return (
    <group position={[node.x, 0, node.z]}>
      {/* Masks the edges and the grid behind the node. */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial
          color={status === "success" ? palette.success : palette.stage}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {/* Keyed: a Line's dash setting is fixed when its material is built. */}
      <Line
        key={status ?? "idle"}
        points={points}
        color={stroke}
        lineWidth={status ? 2.5 : 1}
        dashed={status === "running"}
        dashSize={0.2}
        gapSize={0.13}
        toneMapped={false}
      />
      <Label text={node.label} position={[0, 0.05, 0]} color={text} />
      {node.rank && (
        <Label
          text={node.rank}
          position={[-node.w / 2 + 0.2, 0.05, -NODE_H / 2 - 0.2]}
          size={0.3}
          color={palette.accel}
        />
      )}
      {status === "failure" && (
        <group position={[badgeX, 0.06, badgeZ]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.2, 20]} />
            <meshBasicMaterial color={palette.error} toneMapped={false} />
          </mesh>
          <Line
            points={[
              [-X, 0.01, -X],
              [X, 0.01, X],
            ]}
            color={palette.stage}
            lineWidth={2}
            toneMapped={false}
          />
          <Line
            points={[
              [X, 0.01, -X],
              [-X, 0.01, X],
            ]}
            color={palette.stage}
            lineWidth={2}
            toneMapped={false}
          />
        </group>
      )}
    </group>
  )
}

function TreeEdge({ node, status }: { node: NodeView; status?: Status }) {
  const parent = BY_ID.get(node.parent!)!
  const points = useMemo<P3[]>(
    () => [
      [parent.x, 0.01, parent.z + NODE_H / 2],
      [parent.x, 0.01, (parent.z + node.z) / 2],
      [node.x, 0.01, (parent.z + node.z) / 2],
      [node.x, 0.01, node.z - NODE_H / 2],
    ],
    [node, parent]
  )
  return (
    <Line
      key={status ?? "idle"}
      points={points}
      color={status ? STATUS_COLOR[status] : palette.grid}
      lineWidth={status ? 2 : 1}
      dashed={status === "running"}
      dashSize={0.18}
      gapSize={0.12}
      toneMapped={false}
    />
  )
}

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const options: GuardOptions = {
    reactive: v.reactive,
    autoTarget: v.autoTarget,
    targetDistance: v.targetDistance,
    maxHealth: v.maxHealth,
  }
  const world = useRef(createGuardWorld(options))
  const [last, setLast] = useState<TickResult>(world.current.last)
  const [leaf, setLeaf] = useState("patrol")

  useEffect(() => {
    world.current = createGuardWorld(options)
    setLast(world.current.last)
    setLeaf("patrol")
    // Only Reset restarts the run; params apply live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  useFixedStep((dt) => {
    const previous = world.current.last
    world.current = stepGuard(world.current, dt, options)
    const next = world.current.last
    // Ticks run at 10 Hz; re-render only when a status actually changed.
    if (
      next !== previous &&
      JSON.stringify(previous.trace) !== JSON.stringify(next.trace)
    ) {
      setLast(next)
      setLeaf(activeBranch(guardTree, next).at(-1) ?? "")
    }
  }, 60)

  useLiveReadout(() => {
    const w = world.current
    const branch = activeBranch(guardTree, w.last)
      .map((id) => id.replace("Branch", " branch"))
      .join(" › ")
    const cut = w.lastInterrupted ? ` · last cut off: ${w.lastInterrupted}` : ""
    return `Root ${w.last.status} · ${branch || "not ticked"} · health ${w.health.toFixed(0)}/${v.maxHealth}${cut}`
  })

  const agent = useRef<THREE.Group>(null)
  const target = useRef<THREE.Group>(null)
  const sensor = useRef<THREE.Group>(null)
  const bar = useRef<THREE.Mesh>(null)
  const barMat = useRef<THREE.MeshBasicMaterial>(null)
  const tether = useRef<THREE.Group>(null)

  useFrame(() => {
    const w = world.current
    agent.current?.position.set(w.x, 0, w.z)
    if (agent.current) agent.current.rotation.y = w.heading
    sensor.current?.position.set(w.x, 0, w.z)
    target.current?.position.set(w.targetX, 0, w.targetZ)
    if (bar.current) {
      const k = Math.max(w.health / 100, 0.001)
      bar.current.scale.x = k
      bar.current.position.x = BAR_X - BAR_W / 2 + (BAR_W * k) / 2
    }
    barMat.current?.color.set(
      w.health < GUARD.lowHealth
        ? palette.error
        : w.hurt
          ? palette.velocity
          : palette.success
    )
    if (tether.current) {
      // A unit line along +Z, stretched from the guard to the target.
      const dx = w.targetX - w.x
      const dz = w.targetZ - w.z
      tether.current.position.set(w.x, 0, w.z)
      tether.current.rotation.y = Math.atan2(dx, dz)
      tether.current.scale.z = Math.hypot(dx, dz)
    }
  })

  const ring = useMemo<P3[]>(
    () =>
      Array.from({ length: 65 }, (_, i) => {
        const a = (i / 64) * Math.PI * 2
        return [
          Math.cos(a) * GUARD.nearRadius,
          0.02,
          Math.sin(a) * GUARD.nearRadius,
        ]
      }),
    []
  )
  const patrolLine = useMemo<P3[]>(
    () => GUARD.waypoints.map(([x, z]) => [x, 0.015, z]),
    []
  )
  const diamond = useMemo(() => new THREE.CircleGeometry(0.26, 4), [])
  useEffect(() => () => diamond.dispose(), [diamond])

  const chasing = last.trace.chase === "running"
  const mode = v.reactive ? "reactive" : "memory"

  return (
    <>
      {/* World */}
      <Line
        points={WORLD_BOX}
        color={palette.tertiary}
        lineWidth={1}
        toneMapped={false}
      />
      <Label
        text={mode}
        position={[GUARD.minX + 0.45, 0.05, GUARD.maxZ - 0.02]}
        size={0.36}
        color={palette.accel}
      />
      <Line
        points={patrolLine}
        color={palette.tertiary}
        lineWidth={1}
        dashed
        dashSize={0.14}
        gapSize={0.12}
        toneMapped={false}
      />
      {GUARD.waypoints.map(([x, z]) => (
        <mesh key={x} position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.1, 16]} />
          <meshBasicMaterial color={palette.tertiary} toneMapped={false} />
        </mesh>
      ))}
      {/* Near radius: dashed while nothing is inside it. */}
      <group ref={sensor}>
        <Line
          key={last.trace.near === "success" ? "in" : "out"}
          points={ring}
          color={
            last.trace.near === "success" ? palette.accel : palette.tertiary
          }
          lineWidth={1}
          dashed={last.trace.near !== "success"}
          dashSize={0.16}
          gapSize={0.14}
          toneMapped={false}
        />
        <Label
          text={leaf}
          position={[0, 0.06, -0.6]}
          size={0.38}
          color={palette.foreground}
        />
      </group>
      {chasing && (
        <group ref={tether}>
          <Line
            points={[
              [0, 0.025, 0],
              [0, 0.025, 1],
            ]}
            color={palette.velocity}
            lineWidth={1.5}
            dashed
            dashSize={0.1}
            gapSize={0.08}
            toneMapped={false}
          />
        </group>
      )}
      <group ref={target}>
        <mesh
          geometry={diamond}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.03, 0]}
        >
          <meshBasicMaterial color={palette.accel} toneMapped={false} />
        </mesh>
      </group>
      <group ref={agent}>
        {/* Flat discs: a sphere this far off-axis would render as an oval. */}
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.28, 24]} />
          <meshBasicMaterial color={palette.subject} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.05, 0.14]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.07, 12]} />
          <meshBasicMaterial color={palette.stage} toneMapped={false} />
        </mesh>
      </group>

      {/* Health bar with a tick at the flee threshold. */}
      <mesh position={[BAR_X, 0.01, BAR_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[BAR_W, 0.3]} />
        <meshBasicMaterial color={palette.surface} toneMapped={false} />
      </mesh>
      <mesh
        ref={bar}
        position={[BAR_X, 0.02, BAR_Z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[BAR_W, 0.3]} />
        <meshBasicMaterial ref={barMat} toneMapped={false} />
      </mesh>
      <mesh
        position={[
          BAR_X - BAR_W / 2 + (BAR_W * GUARD.lowHealth) / 100,
          0.03,
          BAR_Z,
        ]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[0.05, 0.44]} />
        <meshBasicMaterial color={palette.foreground} toneMapped={false} />
      </mesh>

      {/* Tree */}
      {NODES.filter((n) => n.parent).map((n) => (
        <TreeEdge key={n.id} node={n} status={last.trace[n.id]} />
      ))}
      {NODES.map((n) => (
        <TreeNode key={n.id} node={n} status={last.trace[n.id]} />
      ))}
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 9.8, -0.09], target: [0, 0, -0.1], fov: 45 },
  orbit: false,
  params: [
    { key: "reactive", label: "Reactive", type: "toggle", value: true },
    { key: "autoTarget", label: "Moving target", type: "toggle", value: true },
    {
      key: "targetDistance",
      label: "Parked target distance",
      min: 0.5,
      max: 4,
      step: 0.1,
      value: 1.2,
      unit: "u",
      digits: 1,
    },
    {
      key: "maxHealth",
      label: "Agent health",
      min: 10,
      max: 100,
      step: 5,
      value: 100,
    },
  ],
  readout: (v) =>
    `${v.reactive ? "Reactive: restarts at the first child every tick" : "Memory: resumes the running child"} · ${GUARD.tickHz} Hz ticks`,
  Scene,
})
