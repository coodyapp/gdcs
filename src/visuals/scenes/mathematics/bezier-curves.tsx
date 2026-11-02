import { useMemo, useRef, type ComponentRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import {
  arcLengthTable,
  cubicPoint,
  cubicTangent,
  tAtDistance,
  type XYZ,
} from "@/lib/bezier"

import { defineVisual, palette, useClock } from "../../kit"

type V = { animate: boolean; t: number; ticks: string; construction: boolean }
type LineRef = ComponentRef<typeof Line>

const Y = 0.05
const BASE: [number, number][] = [
  [-4, 2],
  [-3.8, 0.9],
  [0.5, -3.8],
  [4.2, 1.2],
]
const SEGMENTS = 96
const TABLE_N = 128
const TICKS = 14

function setLine(line: LineRef | null, pts: XYZ[], dashed = false) {
  if (!line) return
  const flat: number[] = []
  for (const p of pts) flat.push(p.x, p.y, p.z)
  line.geometry.setPositions(flat)
  if (dashed) line.computeLineDistances()
}

function Dot({
  refFn,
  color,
  r,
}: {
  refFn: (m: THREE.Mesh | null) => void
  color: string
  r: number
}) {
  return (
    <mesh ref={refFn}>
      <sphereGeometry args={[r, 14, 14]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

function Scene({ v }: { v: V }) {
  const time = useClock()
  const s = useMemo(() => {
    const v3 = () => new THREE.Vector3()
    return {
      ctrl: BASE.map(() => v3()),
      curve: Array.from({ length: SEGMENTS + 1 }, v3),
      l1: [v3(), v3(), v3()],
      l2: [v3(), v3()],
      at: v3(),
      tan: v3(),
      tanEnd: v3(),
      even: v3(),
      table: new Float64Array(TABLE_N + 1),
    }
  }, [])
  const ctrlDots = useRef<(THREE.Mesh | null)[]>([])
  const conDots = useRef<(THREE.Mesh | null)[]>([])
  const tickDots = useRef<(THREE.Mesh | null)[]>([])
  const ring = useRef<THREE.Mesh>(null)
  const ball = useRef<THREE.Mesh>(null)
  const curveLine = useRef<LineRef>(null)
  const polyLine = useRef<LineRef>(null)
  const l1Line = useRef<LineRef>(null)
  const l2Line = useRef<LineRef>(null)
  const tanLine = useRef<LineRef>(null)
  const construction = useRef<THREE.Group>(null)

  useFrame(() => {
    const time_ = time.current
    const [p0, p1, p2, p3] = s.ctrl
    // Control points drift on small circles, as if someone were dragging them.
    s.ctrl.forEach((p, i) => {
      const a = time_ * (0.5 + i * 0.13) + i * 1.9
      p.set(BASE[i][0] + 0.45 * Math.cos(a), Y, BASE[i][1] + 0.45 * Math.sin(a))
      ctrlDots.current[i]?.position.copy(p)
    })
    const sample = (t: number, out: XYZ) => cubicPoint(p0, p1, p2, p3, t, out)
    s.curve.forEach((q, i) => sample(i / SEGMENTS, q))
    setLine(curveLine.current, s.curve)
    setLine(polyLine.current, s.ctrl, true)

    // Same phase drives both markers: naive t vs fraction of length.
    const phase = (time_ * 0.18) % 1
    const t = v.animate ? phase : v.t
    arcLengthTable(sample, TABLE_N, s.table)
    const total = s.table[TABLE_N]
    sample(tAtDistance(s.table, t * total), s.even)
    ball.current?.position.copy(s.even)

    // de Casteljau construction at the naive t.
    for (let i = 0; i < 3; i++) s.l1[i].lerpVectors(s.ctrl[i], s.ctrl[i + 1], t)
    for (let i = 0; i < 2; i++) s.l2[i].lerpVectors(s.l1[i], s.l1[i + 1], t)
    s.at.lerpVectors(s.l2[0], s.l2[1], t)
    ring.current?.position.copy(s.at)
    ;[...s.l1, ...s.l2].forEach((p, i) => conDots.current[i]?.position.copy(p))
    if (construction.current) construction.current.visible = v.construction
    if (v.construction) {
      setLine(l1Line.current, s.l1)
      setLine(l2Line.current, s.l2)
    }
    cubicTangent(p0, p1, p2, p3, t, s.tan).normalize()
    s.tanEnd.copy(s.at).addScaledVector(s.tan, 2.2)
    setLine(tanLine.current, [s.at, s.tanEnd], true)

    tickDots.current.forEach((m, i) => {
      if (!m) return
      m.visible = v.ticks !== "off"
      const u = i / (TICKS - 1)
      sample(
        v.ticks === "distance" ? tAtDistance(s.table, u * total) : u,
        m.position
      )
      ;(m.material as THREE.MeshBasicMaterial).color.set(
        v.ticks === "distance" ? palette.moving : palette.tertiary
      )
    })
  })

  const zero: [number, number, number][] = [
    [0, 0, 0],
    [1, 0, 0],
  ]
  return (
    <>
      <Line
        ref={polyLine}
        points={zero}
        color={palette.guide}
        lineWidth={1.2}
        dashed
        dashSize={0.18}
        gapSize={0.12}
      />
      <Line
        ref={curveLine}
        points={zero}
        color={palette.subject}
        lineWidth={3.5}
      />
      {BASE.map((_, i) => (
        <Dot
          key={i}
          refFn={(m) => void (ctrlDots.current[i] = m)}
          color={palette.foreground}
          r={0.13}
        />
      ))}
      {Array.from({ length: TICKS }, (_, i) => (
        <Dot
          key={i}
          refFn={(m) => void (tickDots.current[i] = m)}
          color={palette.tertiary}
          r={0.06}
        />
      ))}
      <group ref={construction}>
        <Line
          ref={l1Line}
          points={zero}
          color={palette.tertiary}
          lineWidth={1.5}
        />
        <Line
          ref={l2Line}
          points={zero}
          color={palette.tertiary}
          lineWidth={2}
        />
        {Array.from({ length: 5 }, (_, i) => (
          <Dot
            key={i}
            refFn={(m) => void (conDots.current[i] = m)}
            color={palette.tertiary}
            r={0.07}
          />
        ))}
      </group>
      <Line
        ref={tanLine}
        points={zero}
        color={palette.velocity}
        lineWidth={2.5}
        dashed
        dashSize={0.14}
        gapSize={0.1}
        depthTest={false}
        renderOrder={2}
      />
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.05, 10, 32]} />
        <meshBasicMaterial color={palette.tertiary} />
      </mesh>
      <mesh ref={ball}>
        <sphereGeometry args={[0.2, 20, 20]} />
        <meshStandardMaterial color={palette.moving} />
      </mesh>
    </>
  )
}

/** Speed variation of naive t on the resting curve (fastest ÷ slowest). */
function speedRatio() {
  const [p0, p1, p2, p3] = BASE.map(([x, z]) => ({ x, y: 0, z }))
  const d = { x: 0, y: 0, z: 0 }
  let lo = Infinity
  let hi = 0
  for (let i = 0; i <= 100; i++) {
    cubicTangent(p0, p1, p2, p3, i / 100, d)
    const m = Math.hypot(d.x, d.z)
    lo = Math.min(lo, m)
    hi = Math.max(hi, m)
  }
  return hi / lo
}
const RATIO = speedRatio()

export default defineVisual<V>({
  camera: { position: [0, 8.4, 5.2], target: [0, 0, -0.2] },
  params: [
    { key: "animate", label: "Animate", type: "toggle", value: true },
    {
      key: "t",
      label: "t (animate off)",
      min: 0,
      max: 1,
      step: 0.01,
      value: 0.35,
      digits: 2,
    },
    {
      key: "ticks",
      label: "Tick spacing",
      type: "select",
      value: "t",
      options: [
        { value: "t", label: "Equal t (grey)" },
        { value: "distance", label: "Equal distance (yellow)" },
        { value: "off", label: "Off" },
      ],
    },
    {
      key: "construction",
      label: "de Casteljau lines",
      type: "toggle",
      value: true,
    },
  ],
  readout: () =>
    `Naive t: speed varies ${RATIO.toFixed(1)}× along this curve · arc-length marker: constant speed`,
  Scene,
})
