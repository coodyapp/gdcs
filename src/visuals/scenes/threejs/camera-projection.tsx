import { useMemo } from "react"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import {
  insideNdc,
  orthographic,
  perspective,
  projectToNdc,
} from "@/lib/projection"
import type { Vec3 } from "@/lib/transforms"

import {
  defineVisual,
  palette,
  rad,
  useAnimationTime,
  useLiveReadout,
} from "../../kit"

type V = { mode: string; fov: number; dist: number; auto: boolean }

const ASPECT = 16 / 10
const NEAR = 3
const FAR = 6.6
/** Places the game camera in the world, looking along +X (view -Z maps to +X). */
const EYE: Vec3 = [-3.6, 0, 0]
const TURN: Vec3 = [0, -Math.PI / 2, 0]

/** Boxes in view space; `dist` is the distance to the front face. */
const WHITE = { x: -0.86, y: 0.22, size: 0.9, dist: 5 }
const GREY = { x: -0.04, y: -0.5, size: 0.6, dist: 4.2 }
const MOVER = { x: 0.86, y: 0.12, size: 0.9 }

const faceCorners = (x: number, y: number, s: number, d: number): Vec3[] => [
  [x - s / 2, y - s / 2, -d],
  [x + s / 2, y - s / 2, -d],
  [x + s / 2, y + s / 2, -d],
  [x - s / 2, y + s / 2, -d],
]

const halfHeight = (fov: number) => NEAR * Math.tan(rad(fov / 2))

const matrixFor = (mode: string, fov: number) =>
  mode === "perspective"
    ? perspective(rad(fov), ASPECT, NEAR, FAR)
    : orthographic(halfHeight(fov) * ASPECT, halfHeight(fov), NEAR, FAR)

const moverCorners = (dist: number) =>
  faceCorners(MOVER.x, MOVER.y, MOVER.size, dist)

/** The tracked point: the mover's top-right front corner. */
const trackedPoint = (dist: number) => moverCorners(dist)[2]

function Frustum({ v }: { v: V }) {
  const persp = v.mode === "perspective"
  const { front, tail, screen } = useMemo(() => {
    const hh = halfHeight(v.fov)
    const rect = (d: number): Vec3[] => {
      const s = persp ? d / NEAR : 1
      const [w, h] = [hh * ASPECT * s, hh * s]
      return [
        [-w, -h, -d],
        [w, -h, -d],
        [w, h, -d],
        [-w, h, -d],
      ]
    }
    const [n, f] = [rect(NEAR), rect(FAR)]
    const front: Vec3[] = []
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4
      front.push(n[i], n[j], f[i], f[j], n[i], f[i])
    }
    // From the screen back to the eye (perspective) or camera plane (ortho).
    const back = rect(0)
    const tail: Vec3[] = []
    for (let i = 0; i < 4; i++) {
      tail.push(n[i], back[i])
      if (!persp) tail.push(back[i], back[(i + 1) % 4])
    }
    return { front, tail, screen: [...n, n[0]] }
  }, [v.fov, persp])
  return (
    <>
      <Line
        segments
        points={front}
        color={palette.subject}
        lineWidth={1.4}
        transparent
        opacity={0.9}
      />
      {/* The screen edge is drawn heavier than the rest of the frustum. */}
      <Line points={screen} color={palette.subject} lineWidth={2.6} />
      <Line
        segments
        points={tail}
        color={palette.tertiary}
        lineWidth={1}
        transparent
        opacity={0.8}
      />
    </>
  )
}

/** A box, its projection lines and the dots and outline it leaves on screen. */
function Projected({
  corners,
  size,
  color,
  solid,
  matrix,
  v,
  lineOpacity,
  lineWidth,
  dotRadius,
}: {
  corners: Vec3[]
  size: number
  color: string
  solid: boolean
  matrix: number[]
  v: V
  lineOpacity: number
  lineWidth: number
  dotRadius: number
}) {
  const persp = v.mode === "perspective"
  const hh = halfHeight(v.fov)
  const hw = hh * ASPECT
  const hits = useMemo(
    () =>
      corners.map((c) => {
        const ndc = projectToNdc(matrix, c)
        return {
          corner: c,
          dot: [ndc[0] * hw, ndc[1] * hh, -NEAR + 0.01] as Vec3,
          // Rays end at the eye, or stay parallel back to the camera plane.
          end: (persp ? [0, 0, 0] : [c[0], c[1], 0]) as Vec3,
          on: insideNdc(ndc),
        }
      }),
    [corners, matrix, hw, hh, persp]
  )
  const [cx, cy] = [
    (corners[0][0] + corners[2][0]) / 2,
    (corners[0][1] + corners[2][1]) / 2,
  ]
  const outline = useMemo(() => {
    const pts = hits.map((h) => h.dot)
    return [...pts, pts[0]]
  }, [hits])

  return (
    <>
      <mesh position={[cx, cy, corners[0][2] - size / 2]}>
        <boxGeometry args={[size, size, size]} />
        {solid ? (
          <meshStandardMaterial color={color} roughness={0.7} />
        ) : (
          <meshBasicMaterial color={color} wireframe />
        )}
      </mesh>
      <Line points={outline} color={color} lineWidth={2} />
      {hits.map((h, i) => (
        <group key={i}>
          <Line
            points={[h.corner, h.end]}
            color={palette.velocity}
            lineWidth={lineWidth}
            dashed
            dashSize={0.16}
            gapSize={0.1}
            transparent
            opacity={lineOpacity}
          />
          <mesh position={h.dot}>
            {h.on ? (
              <sphereGeometry args={[dotRadius, 14, 10]} />
            ) : (
              <octahedronGeometry args={[dotRadius * 1.4]} />
            )}
            <meshBasicMaterial color={h.on ? color : palette.error} />
          </mesh>
        </group>
      ))}
    </>
  )
}

/** Text for the line under the controls, for any box distance. */
function readoutText(v: V) {
  const m = matrixFor(v.mode, v.fov)
  const c = moverCorners(v.dist)
  const [x, y, z] = projectToNdc(m, c[2])
  const span = projectToNdc(m, c[2])[1] - projectToNdc(m, c[0])[1]
  const share = Math.round((span / 2) * 100)
  return `Ringed corner NDC x ${sign(x)} y ${sign(y)} z ${sign(z)} · box fills ${share}% of screen height`
}

const DIST_MIN = 3.4
const DIST_MAX = 5.6
const DIST_SWING = 1.1

/** Glides the yellow box around the slider's distance, so the slider works while it moves. */
function Scene({ v: params }: { v: V }) {
  const time = useAnimationTime()
  const v = params.auto
    ? {
        ...params,
        dist: Math.min(
          DIST_MAX,
          Math.max(DIST_MIN, params.dist + DIST_SWING * Math.sin(time * 0.7))
        ),
      }
    : params
  useLiveReadout(() => (params.auto ? readoutText(v) : null))
  const matrix = useMemo(() => matrixFor(v.mode, v.fov), [v.mode, v.fov])
  const hh = halfHeight(v.fov)
  const hw = hh * ASPECT
  const mover = useMemo(() => moverCorners(v.dist), [v.dist])
  const white = useMemo(
    () => faceCorners(WHITE.x, WHITE.y, WHITE.size, WHITE.dist),
    []
  )
  const grey = useMemo(
    () => faceCorners(GREY.x, GREY.y, GREY.size, GREY.dist),
    []
  )
  const tracked = useMemo(
    () => projectToNdc(matrix, trackedPoint(v.dist)),
    [matrix, v.dist]
  )

  return (
    <group position={EYE} rotation={TURN}>
      {/* The camera itself, sitting just behind the eye point. */}
      <mesh position={[0, 0, 0.26]}>
        <boxGeometry args={[0.42, 0.32, 0.5]} />
        <meshBasicMaterial color={palette.subject} />
      </mesh>
      <Frustum v={v} />

      {/* The screen: near plane, with NDC axes through its centre. */}
      <mesh position={[0, 0, -NEAR]}>
        <planeGeometry args={[hw * 2, hh * 2]} />
        <meshBasicMaterial
          color={palette.surface}
          side={THREE.DoubleSide}
          transparent
          opacity={0.75}
          depthWrite={false}
        />
      </mesh>
      <Line
        segments
        points={[
          [-hw, 0, -NEAR],
          [hw, 0, -NEAR],
          [0, -hh, -NEAR],
          [0, hh, -NEAR],
        ]}
        color={palette.guide}
        lineWidth={1}
      />

      <Projected
        corners={white}
        size={WHITE.size}
        color={palette.subject}
        solid
        matrix={matrix}
        v={v}
        lineOpacity={0.6}
        lineWidth={1.2}
        dotRadius={0.06}
      />
      <Projected
        corners={grey}
        size={GREY.size}
        color={palette.tertiary}
        solid={false}
        matrix={matrix}
        v={v}
        lineOpacity={0.6}
        lineWidth={1.2}
        dotRadius={0.06}
      />
      <Projected
        corners={mover}
        size={MOVER.size}
        color={palette.moving}
        solid
        matrix={matrix}
        v={v}
        lineOpacity={1}
        lineWidth={1.8}
        dotRadius={0.075}
      />

      {/* The point the readout tracks: ringed so it reads without hue. */}
      <mesh position={[tracked[0] * hw, tracked[1] * hh, -NEAR + 0.02]}>
        <ringGeometry args={[0.12, 0.16, 24]} />
        <meshBasicMaterial color={palette.foreground} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

const sign = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(2)}`

export default defineVisual<V>({
  camera: { position: [-6, 3.7, 6.7], target: [-0.05, 0, 0], fov: 40 },
  params: [
    {
      key: "mode",
      label: "Projection",
      type: "select",
      value: "perspective",
      options: [
        { value: "perspective", label: "Perspective" },
        { value: "orthographic", label: "Orthographic" },
      ],
    },
    {
      key: "fov",
      label: "Vertical FOV",
      min: 20,
      max: 60,
      step: 1,
      value: 36,
      unit: "°",
    },
    { key: "auto", label: "Move the box", type: "toggle", value: true },
    {
      key: "dist",
      label: "Yellow box distance",
      min: DIST_MIN,
      max: DIST_MAX,
      step: 0.1,
      value: 4.4,
      unit: "u",
    },
  ],
  readout: readoutText,
  Scene,
})
