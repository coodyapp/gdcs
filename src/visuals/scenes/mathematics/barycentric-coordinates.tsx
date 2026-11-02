import { useMemo, useRef, type Ref } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import {
  barycentric,
  insideWeights,
  interpolate,
  type Weights,
} from "@/lib/barycentric"

import {
  clamp,
  defineVisual,
  palette,
  useClock,
  useLiveReadout,
} from "../../kit"

type V = { auto: boolean; u: number; v: number }

const A = [-3.4, -2.6]
const B = [3.4, -2.6]
const C = [0, 3.2]
const CORNERS = [A, B, C]
const CENTROID = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3]
/** Manual w never goes below this, so the point stays in frame. */
const MIN_W = -0.2

const LINE = 0.05
const Z = { fill: 0, shade: 0.01, line: 0.02, corner: 0.03, marker: 0.05 }

// Shape per corner, so identity does not rest on hue: circle, square, triangle.
const SHAPES = [
  { segments: 32, turn: 0, color: palette.success },
  { segments: 4, turn: Math.PI / 4, color: palette.moving },
  { segments: 3, turn: Math.PI / 2, color: palette.error },
]

// Weight bars, top right: one row per corner.
const BAR_ZERO = 4
const BAR_SCALE = 2.4
const BAR_ROWS = [2.9, 2.15, 1.4]

const toLinear = (hex: string) => {
  const c = new THREE.Color(hex)
  return [c.r, c.g, c.b]
}
const COLORS = SHAPES.map((s) => toLinear(s.color))
const SHADE_LOW = toLinear(palette.stage)
const SHADE_HIGH = toLinear(palette.foreground)

const manualWeights = (v: V, out: Weights): Weights => {
  let { u, v: vv } = v
  const excess = MIN_W - (1 - u - vv)
  if (excess > 0) {
    u -= excess / 2
    vv -= excess / 2
  }
  out[0] = u
  out[1] = vv
  out[2] = 1 - u - vv
  return out
}

function placeBar(m: THREE.Mesh, a: number[], b: number[]) {
  m.position.x = (a[0] + b[0]) / 2
  m.position.y = (a[1] + b[1]) / 2
  m.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0])
  m.scale.x = Math.hypot(b[0] - a[0], b[1] - a[1])
}

function Bar({
  ref,
  from,
  to,
  color,
  z,
  thickness = LINE,
}: {
  ref?: Ref<THREE.Mesh>
  from?: number[]
  to?: number[]
  color: string
  z: number
  thickness?: number
}) {
  const place =
    from && to
      ? {
          position: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, z] as const,
          rotation: [
            0,
            0,
            Math.atan2(to[1] - from[1], to[0] - from[0]),
          ] as const,
          scale: [Math.hypot(to[0] - from[0], to[1] - from[1]), 1, 1] as const,
        }
      : { position: [0, 0, z] as const }
  return (
    <mesh ref={ref} {...place}>
      <planeGeometry args={[1, thickness]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}

/** Outlined corner shape on a stage-coloured plate, filled by its weight. */
function CornerMark({
  ref,
  shape,
  x,
  y,
  r,
}: {
  ref: Ref<THREE.Mesh>
  shape: (typeof SHAPES)[number]
  x: number
  y: number
  r: number
}) {
  return (
    <group position={[x, y, Z.corner]} rotation={[0, 0, shape.turn]}>
      <mesh>
        <circleGeometry args={[r, shape.segments]} />
        <meshBasicMaterial color={palette.stage} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.001]}>
        <ringGeometry args={[r * 0.82, r, shape.segments, 1]} />
        <meshBasicMaterial color={shape.color} toneMapped={false} />
      </mesh>
      <mesh ref={ref} position={[0, 0, 0.002]}>
        <circleGeometry args={[r * 0.82, shape.segments]} />
        <meshBasicMaterial color={shape.color} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Scene({ v }: { v: V }) {
  const time = useClock()
  const state = useMemo(
    () => ({
      p: [0, 0],
      weights: [0, 0, 0] as Weights,
      rgb: [0, 0, 0],
    }),
    []
  )

  const fill = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        CORNERS.flatMap(([x, y]) => [x, y, Z.fill]),
        3
      )
    )
    g.setAttribute("color", new THREE.Float32BufferAttribute(COLORS.flat(), 3))
    return g
  }, [])

  // Three flat triangles (P,B,C), (P,C,A), (P,A,B), one per weight, each with
  // its own RGBA vertex colour.
  const shade = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(9 * 3), 3)
    )
    g.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(9 * 4), 4)
    )
    return g
  }, [])

  const spokes = useRef<(THREE.Mesh | null)[]>([])
  const cornerFills = useRef<(THREE.Mesh | null)[]>([])
  const barFills = useRef<(THREE.Mesh | null)[]>([])
  const barNegs = useRef<(THREE.Mesh | null)[]>([])
  const markerIn = useRef<THREE.Group>(null)
  const markerOut = useRef<THREE.Mesh>(null)
  const sampled = useRef<THREE.MeshBasicMaterial>(null)

  useLiveReadout(() => {
    if (!v.auto) return null
    const [a, b, c] = state.weights
    return `u = ${a.toFixed(2)} · v = ${b.toFixed(2)} · w = ${c.toFixed(2)} · sum = ${(a + b + c).toFixed(2)} · ${insideWeights(state.weights) ? "inside" : "outside"}`
  })

  useFrame(() => {
    const { p, weights, rgb } = state
    if (v.auto) {
      // A wandering orbit around the centroid that crosses the edges at times.
      const t = time.current
      const r = 1.9 + 0.9 * Math.sin(1.37 * t)
      const angle = 1.2 + 0.55 * t
      p[0] = CENTROID[0] + r * Math.cos(angle)
      p[1] = CENTROID[1] + r * Math.sin(angle)
      barycentric(p, A, B, C, weights)
    } else {
      manualWeights(v, weights)
      interpolate(weights, A, B, C, p)
    }
    const inside = insideWeights(weights)

    const pos = shade.attributes.position as THREE.BufferAttribute
    const col = shade.attributes.color as THREE.BufferAttribute
    for (let i = 0; i < 3; i++) {
      const q = CORNERS[(i + 1) % 3]
      const s = CORNERS[(i + 2) % 3]
      const n = i * 3
      pos.setXYZ(n, p[0], p[1], Z.shade)
      pos.setXYZ(n + 1, q[0], q[1], Z.shade)
      pos.setXYZ(n + 2, s[0], s[1], Z.shade)
      // Four grey steps from dark to white, by the size of this weight.
      const level = clamp(Math.ceil(Math.abs(weights[i]) * 4) / 4)
      const r = SHADE_LOW[0] + (SHADE_HIGH[0] - SHADE_LOW[0]) * level
      const g = SHADE_LOW[1] + (SHADE_HIGH[1] - SHADE_LOW[1]) * level
      const b = SHADE_LOW[2] + (SHADE_HIGH[2] - SHADE_LOW[2]) * level
      for (let k = 0; k < 3; k++) col.setXYZW(n + k, r, g, b, 0.3)

      const spoke = spokes.current[i]
      if (spoke) placeBar(spoke, p, CORNERS[i])

      const corner = cornerFills.current[i]
      const area = Math.sqrt(clamp(weights[i]))
      if (corner) {
        corner.visible = area > 0.02
        corner.scale.setScalar(Math.max(area, 0.001))
      }

      const bar = barFills.current[i]
      if (bar) {
        const len = Math.max(weights[i], 0) * BAR_SCALE
        bar.visible = len > 0.001
        bar.scale.x = Math.max(len, 0.001)
        bar.position.x = BAR_ZERO + len / 2
      }
      const neg = barNegs.current[i]
      if (neg) {
        const len = Math.max(-weights[i], 0) * BAR_SCALE
        neg.visible = len > 0.001
        neg.scale.x = Math.max(len, 0.001)
        neg.position.x = BAR_ZERO - len / 2
      }
    }
    pos.needsUpdate = true
    col.needsUpdate = true

    interpolate(weights, COLORS[0], COLORS[1], COLORS[2], rgb)
    sampled.current?.color.setRGB(rgb[0], rgb[1], rgb[2])
    if (markerIn.current) {
      markerIn.current.visible = inside
      markerIn.current.position.set(p[0], p[1], Z.marker)
    }
    if (markerOut.current) {
      markerOut.current.visible = !inside
      markerOut.current.position.set(p[0], p[1], Z.marker)
    }
  })

  return (
    <>
      <mesh geometry={fill} frustumCulled={false}>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </mesh>
      <mesh geometry={shade} frustumCulled={false}>
        <meshBasicMaterial
          vertexColors
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {CORNERS.map((from, i) => (
        <Bar
          key={`edge${i}`}
          from={from}
          to={CORNERS[(i + 1) % 3]}
          color={palette.foreground}
          z={Z.line}
          thickness={LINE * 1.4}
        />
      ))}
      {SHAPES.map((_, i) => (
        <Bar
          key={`spoke${i}`}
          ref={(m) => {
            spokes.current[i] = m
          }}
          color={palette.foreground}
          z={Z.line}
        />
      ))}

      {SHAPES.map((shape, i) => (
        <CornerMark
          key={`corner${i}`}
          ref={(m) => {
            cornerFills.current[i] = m
          }}
          shape={shape}
          x={CORNERS[i][0]}
          y={CORNERS[i][1]}
          r={0.5}
        />
      ))}

      {/* Live weights: bars grow right of the zero tick, negatives go left. */}
      {SHAPES.map((shape, i) => (
        <group key={`row${i}`} position={[0, BAR_ROWS[i], Z.line]}>
          <group position={[3.1, 0, 0]} rotation={[0, 0, shape.turn]}>
            <mesh>
              <circleGeometry args={[0.2, shape.segments]} />
              <meshBasicMaterial color={shape.color} toneMapped={false} />
            </mesh>
          </group>
          <Bar
            from={[BAR_ZERO, 0]}
            to={[BAR_ZERO + BAR_SCALE, 0]}
            color={palette.surface}
            z={0}
            thickness={0.34}
          />
          <Bar
            ref={(m) => {
              barFills.current[i] = m
            }}
            color={palette.foreground}
            z={0.001}
            thickness={0.34}
          />
          <Bar
            ref={(m) => {
              barNegs.current[i] = m
            }}
            color={palette.error}
            z={0.001}
            thickness={0.34}
          />
          <Bar
            from={[BAR_ZERO, -0.25]}
            to={[BAR_ZERO, 0.25]}
            color={palette.guide}
            z={0.002}
          />
        </group>
      ))}

      <group ref={markerIn}>
        <mesh>
          <circleGeometry args={[0.32, 32]} />
          <meshBasicMaterial color={palette.foreground} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.001]}>
          <circleGeometry args={[0.24, 32]} />
          <meshBasicMaterial ref={sampled} toneMapped={false} />
        </mesh>
      </group>
      <mesh ref={markerOut}>
        <ringGeometry args={[0.28, 0.42, 32]} />
        <meshBasicMaterial color={palette.error} toneMapped={false} />
      </mesh>
    </>
  )
}

const readoutWeights: Weights = [0, 0, 0]

export default defineVisual<V>({
  camera: { position: [0.6, -0.25, 10.2], target: [0.6, -0.25, 0] },
  orbit: false,
  params: [
    { key: "auto", label: "Auto path", type: "toggle", value: true },
    {
      key: "u",
      label: "u (green)",
      min: -0.25,
      max: 1,
      step: 0.01,
      value: 0.5,
      digits: 2,
    },
    {
      key: "v",
      label: "v (yellow)",
      min: -0.25,
      max: 1,
      step: 0.01,
      value: 0.3,
      digits: 2,
    },
  ],
  readout: (v) => {
    if (v.auto)
      return "The bars show u, v, w live. The point wanders, and crossing an edge drives one weight negative. Turn the auto path off for exact values."
    const [u, vv, w] = manualWeights(v, readoutWeights)
    const clamped = w !== 1 - v.u - v.v
    return `u = ${u.toFixed(2)} · v = ${vv.toFixed(2)} · w = ${w.toFixed(2)} · sum = ${(u + vv + w).toFixed(2)} · ${insideWeights(readoutWeights) ? "inside" : "outside"}${clamped ? " · held in frame" : ""}`
  },
  Scene,
})
