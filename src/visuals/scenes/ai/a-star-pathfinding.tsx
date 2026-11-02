import { useLayoutEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import { astar, parseGrid } from "@/lib/astar"

import { defineVisual, palette, useClock } from "../../kit"

type V = { heuristic: string; weight: number; speed: number }

const MAP = [
  "................",
  "..####......#...",
  ".....#......#...",
  ".S...#..###.#...",
  ".....#....#.#.G.",
  ".....####.#.#...",
  "..........#.....",
  "...####...#..##.",
  "......#.........",
  "......#.........",
]
const { grid, start, goal } = parseGrid(MAP)
const W = grid.width
const H = grid.height
const CELL = 0.62
const HOLD = 2.2 // seconds to show the finished path before looping

const cellPos = (c: number): [number, number, number] => [
  ((c % W) - (W - 1) / 2) * CELL,
  0,
  (((c / W) | 0) - (H - 1) / 2) * CELL,
]

function search(v: V) {
  return astar(grid, start, goal, {
    diagonal: v.heuristic === "octile",
    heuristic:
      v.heuristic === "dijkstra"
        ? "zero"
        : (v.heuristic as "manhattan" | "octile"),
    weight: v.weight,
  })
}

const WALLS = Array.from(grid.walls, (w, i) => (w ? i : -1)).filter(
  (i) => i >= 0
)

function Scene({ v }: { v: V }) {
  const time = useClock()
  const result = useMemo(() => search(v), [v])
  const closedAt = useMemo(() => {
    const a = new Int32Array(W * H).fill(-1)
    result.expanded.forEach((c, k) => (a[c] = k))
    return a
  }, [result])
  const onPath = useMemo(() => new Set(result.path ?? []), [result])
  const pathPoints = useMemo(
    () =>
      (result.path ?? [start]).map((c) => {
        const [x, , z] = cellPos(c)
        return [x, 0.32, z] as [number, number, number]
      }),
    [result]
  )

  const tiles = useRef<THREE.InstancedMesh>(null)
  const walls = useRef<THREE.InstancedMesh>(null)
  const pathLine = useRef<THREE.Group>(null)
  const lastStep = useRef(-1)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const colors = useMemo(
    () => ({
      floor: new THREE.Color(palette.surface),
      // Frontier = active work (orange, raised); closed = done (violet, flat).
      open: new THREE.Color(palette.moving),
      closed: new THREE.Color(palette.tertiary).multiplyScalar(0.6),
      path: new THREE.Color(palette.velocity),
      start: new THREE.Color(palette.subject).multiplyScalar(0.45),
      goal: new THREE.Color(palette.success).multiplyScalar(0.45),
    }),
    []
  )

  useLayoutEffect(() => {
    const t = tiles.current
    const w = walls.current
    if (!t || !w) return
    dummy.scale.set(1, 1, 1)
    for (let c = 0; c < W * H; c++) {
      const [x, , z] = cellPos(c)
      dummy.position.set(x, 0, z)
      dummy.updateMatrix()
      t.setMatrixAt(c, dummy.matrix)
      t.setColorAt(c, colors.floor)
    }
    WALLS.forEach((c, k) => {
      const [x, , z] = cellPos(c)
      dummy.position.set(x, 0.14, z)
      dummy.updateMatrix()
      w.setMatrixAt(k, dummy.matrix)
    })
    t.instanceMatrix.needsUpdate = true
    w.instanceMatrix.needsUpdate = true
    lastStep.current = -1
  }, [colors, dummy, result])

  useFrame(() => {
    const t = tiles.current
    if (!t) return
    const n = result.expanded.length
    const cycle = n / v.speed + HOLD
    const step = Math.min(n, Math.floor((time.current % cycle) * v.speed))
    const done = step >= n
    if (pathLine.current)
      pathLine.current.visible = done && result.path !== null
    if (step === lastStep.current) return
    lastStep.current = step
    for (let c = 0; c < W * H; c++) {
      let col = colors.floor
      // Shape cue: frontier tiles stand taller than closed/floor tiles.
      let lift = 1
      if (closedAt[c] >= 0 && closedAt[c] < step) col = colors.closed
      else if (result.openedAt[c] >= 0 && result.openedAt[c] <= step) {
        col = colors.open
        lift = 2
      }
      if (done && onPath.has(c)) col = colors.path
      if (c === start) col = colors.start
      if (c === goal) col = colors.goal
      t.setColorAt(c, col)
      const [x, , z] = cellPos(c)
      dummy.position.set(x, 0.04 * (lift - 1), z)
      dummy.scale.set(1, lift, 1)
      dummy.updateMatrix()
      t.setMatrixAt(c, dummy.matrix)
    }
    if (t.instanceColor) t.instanceColor.needsUpdate = true
    t.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={tiles} args={[undefined, undefined, W * H]}>
        <boxGeometry args={[CELL * 0.92, 0.08, CELL * 0.92]} />
        <meshStandardMaterial color="#ffffff" />
      </instancedMesh>
      <instancedMesh ref={walls} args={[undefined, undefined, WALLS.length]}>
        <boxGeometry args={[CELL, 0.28, CELL]} />
        <meshStandardMaterial color={palette.object} />
      </instancedMesh>
      <group ref={pathLine} visible={false}>
        <Line points={pathPoints} color={palette.velocity} lineWidth={4} />
      </group>
      {/* Start = cyan agent token (sphere); goal = green flag ring. */}
      <mesh position={[cellPos(start)[0], 0.3, cellPos(start)[2]]}>
        <sphereGeometry args={[CELL * 0.3, 20, 14]} />
        <meshStandardMaterial color={palette.subject} />
      </mesh>
      <mesh
        position={[cellPos(goal)[0], 0.2, cellPos(goal)[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[CELL * 0.32, CELL * 0.08, 10, 28]} />
        <meshBasicMaterial color={palette.success} />
      </mesh>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 9.5, 3.2], target: [0, 0, 0.15] },
  params: [
    {
      key: "heuristic",
      label: "Heuristic",
      type: "select",
      value: "manhattan",
      options: [
        { value: "manhattan", label: "Manhattan (4-way)" },
        { value: "octile", label: "Octile (8-way)" },
        { value: "dijkstra", label: "None: Dijkstra (4-way)" },
      ],
    },
    {
      key: "weight",
      label: "Heuristic weight",
      min: 1,
      max: 3,
      step: 0.1,
      value: 1,
      digits: 1,
    },
    {
      key: "speed",
      label: "Expansions per second",
      min: 5,
      max: 80,
      step: 1,
      value: 30,
    },
  ],
  readout: (v) => {
    const r = search(v)
    return r.path
      ? `Expanded ${r.expanded.length} tiles · path cost ${r.cost.toFixed(2)}`
      : "No path"
  },
  Scene,
})
