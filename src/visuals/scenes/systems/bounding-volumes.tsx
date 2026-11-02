import { useMemo, useRef } from "react"
import type { ComponentRef } from "react"
import { Line } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import {
  type Aabb,
  aabbOverlap,
  boundsOf,
  boxVolume,
  COMPOUND,
  emptyFraction,
  enclosingRadius,
  type M3,
  type Obb,
  obbOverlap,
  refitAabb,
  rotationAxisAngle,
  solidVolume,
  type Sphere,
  sphereOverlap,
  sphereVolume,
  transformPoint,
  type V3,
} from "@/lib/bounding-volumes"

import { defineVisual, palette, rad, useClock, useLiveReadout } from "../../kit"

type Kind = "aabb" | "obb" | "sphere"
type V = { volume: Kind; spin: boolean; angle: number }

const LOCAL = boundsOf(COMPOUND)
const SOLID = solidVolume(COMPOUND)
const RADIUS = enclosingRadius(COMPOUND, LOCAL.center)
const OBB_VOLUME = boxVolume(LOCAL.half)
const SPHERE_VOLUME = sphereVolume(RADIUS)

// Tilted off the view axis so all three AABB extents change, not just two.
const AXIS_RAW = new THREE.Vector3(0.12, 0.18, 1).normalize()
const AXIS: V3 = [AXIS_RAW.x, AXIS_RAW.y, AXIS_RAW.z]
const SPIN = 0.45
const START_ANGLE = 0.6
const ORIGIN: V3 = [0, 0, 0]

const PROBE_HALF = 0.38
const PROBE_LOCAL = {
  center: ORIGIN,
  half: [PROBE_HALF, PROBE_HALF, PROBE_HALF] as V3,
}
const PROBE_RADIUS = PROBE_HALF * Math.sqrt(3)
const PROBE_AXIS_RAW = new THREE.Vector3(1, 1, 0.3).normalize()
const PROBE_AXIS: V3 = [PROBE_AXIS_RAW.x, PROBE_AXIS_RAW.y, PROBE_AXIS_RAW.z]
const ORBIT_X = 3.4
const ORBIT_Y = 2
const ORBIT_SPEED = 0.3

const GAUGE_W = 5
const GAUGE_H = 0.2
const GAUGE_Y = -3

const THIN = 2
const THICK = 4

const BOX_POINTS: V3[] = (() => {
  const p: V3[] = []
  const s = [-1, 1]
  for (const a of s)
    for (const b of s) {
      p.push(
        [-1, a, b],
        [1, a, b],
        [a, -1, b],
        [a, 1, b],
        [a, b, -1],
        [a, b, 1]
      )
    }
  return p
})()

/** Three great circles, as line-segment pairs. */
const SPHERE_POINTS: V3[] = (() => {
  const p: V3[] = []
  const n = 48
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2
    const b = ((k + 1) / n) * Math.PI * 2
    const [ca, sa, cb, sb] = [
      Math.cos(a),
      Math.sin(a),
      Math.cos(b),
      Math.sin(b),
    ]
    p.push([ca, sa, 0], [cb, sb, 0])
    p.push([ca, 0, sa], [cb, 0, sb])
    p.push([0, ca, sa], [0, cb, sb])
  }
  return p
})()

const GAUGE_OUTLINE: V3[] = [
  [-GAUGE_W / 2, -GAUGE_H / 2, 0],
  [GAUGE_W / 2, -GAUGE_H / 2, 0],
  [GAUGE_W / 2, GAUGE_H / 2, 0],
  [-GAUGE_W / 2, GAUGE_H / 2, 0],
  [-GAUGE_W / 2, -GAUGE_H / 2, 0],
]

const SWEEP_STEPS = 360

/** The AABB's size and volume at one rotation of the demo object. */
function aabbAt(angle: number) {
  const out: Aabb = { min: [0, 0, 0], max: [0, 0, 0] }
  refitAabb(LOCAL, rotationAxisAngle(AXIS, angle, []), ORIGIN, out)
  const size: V3 = [
    out.max[0] - out.min[0],
    out.max[1] - out.min[1],
    out.max[2] - out.min[2],
  ]
  return { size, volume: size[0] * size[1] * size[2] }
}

/** Range of the AABB's volume over a full turn, for the readout. */
const AABB_RANGE = (() => {
  let min = Infinity
  let max = 0
  for (let i = 0; i < SWEEP_STEPS; i++) {
    const { volume } = aabbAt((i / SWEEP_STEPS) * Math.PI * 2)
    min = Math.min(min, volume)
    max = Math.max(max, volume)
  }
  return { min, max }
})()

const pct = (fraction: number) => `${Math.round(fraction * 100)}%`
const sizeText = (s: V3) =>
  `${s[0].toFixed(1)} × ${s[1].toFixed(1)} × ${s[2].toFixed(1)} u`

type LineRef = ComponentRef<typeof Line>

function useWireRefs() {
  const group = useRef<THREE.Group>(null)
  const line = useRef<LineRef>(null)
  const fill = useRef<THREE.Mesh>(null)
  return useMemo(() => ({ group, line, fill }), [])
}
type WireRefs = ReturnType<typeof useWireRefs>

/** A hit changes hue, width and fill, so it reads without colour. */
function paint(
  refs: WireRefs,
  hit: boolean,
  clear: THREE.Color,
  red: THREE.Color
) {
  const material = refs.line.current?.material
  if (material) {
    material.color.copy(hit ? red : clear)
    material.linewidth = hit ? THICK : THIN
  }
  if (refs.fill.current) refs.fill.current.visible = hit
}

function Wire({
  kind,
  color,
  refs,
}: {
  kind: Kind
  color: string
  refs: WireRefs
}) {
  const isSphere = kind === "sphere"
  return (
    <group ref={refs.group}>
      <Line
        ref={refs.line}
        points={isSphere ? SPHERE_POINTS : BOX_POINTS}
        segments
        color={color}
        lineWidth={THIN}
        // Tight volumes hug the mesh, so draw the wire over it to keep it visible.
        depthTest={false}
        renderOrder={2}
      />
      <mesh ref={refs.fill} visible={false}>
        {isSphere ? (
          <sphereGeometry args={[1, 32, 20]} />
        ) : (
          <boxGeometry args={[2, 2, 2]} />
        )}
        <meshBasicMaterial
          color={palette.error}
          transparent
          opacity={0.25}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  )
}

function Scene({ v }: { v: V }) {
  const time = useClock()
  const kind = v.volume
  const object = useRef<THREE.Group>(null)
  const probe = useRef<THREE.Mesh>(null)
  const gauge = useRef<THREE.Mesh>(null)
  const mainWire = useWireRefs()
  const probeWire = useWireRefs()

  const s = useMemo(
    () => ({
      rot: [1, 0, 0, 0, 1, 0, 0, 0, 1] as M3,
      probeRot: [1, 0, 0, 0, 1, 0, 0, 0, 1] as M3,
      probePos: [0, 0, 0] as V3,
      center: [0, 0, 0] as V3,
      aabbA: { min: [0, 0, 0], max: [0, 0, 0] } as Aabb,
      aabbB: { min: [0, 0, 0], max: [0, 0, 0] } as Aabb,
      axis: AXIS_RAW.clone(),
      probeAxis: PROBE_AXIS_RAW.clone(),
      quat: new THREE.Quaternion(),
      probeQuat: new THREE.Quaternion(),
      noRotation: new THREE.Quaternion(),
      red: new THREE.Color(palette.error),
      green: new THREE.Color(palette.success),
      yellow: new THREE.Color(palette.moving),
    }),
    []
  )
  const obbA = useMemo<Obb>(
    () => ({ center: s.center, half: LOCAL.half, rot: s.rot }),
    [s]
  )
  const obbB = useMemo<Obb>(
    () => ({ center: s.probePos, half: PROBE_LOCAL.half, rot: s.probeRot }),
    [s]
  )
  const sphereA = useMemo<Sphere>(
    () => ({ center: s.center, radius: RADIUS }),
    [s]
  )
  const sphereB = useMemo<Sphere>(
    () => ({ center: s.probePos, radius: PROBE_RADIUS }),
    [s]
  )

  const live = useRef(0)
  useLiveReadout(() =>
    v.volume === "aabb" && v.spin
      ? `AABB now ${pct(live.current)} empty · over a full turn ${AABB_RANGE.min.toFixed(1)}–${AABB_RANGE.max.toFixed(1)} u³ · test: up to 6 comparisons`
      : null
  )

  useFrame(() => {
    const t = time.current
    const angle = v.spin ? START_ANGLE + t * SPIN : rad(v.angle)
    rotationAxisAngle(AXIS, angle, s.rot)
    s.quat.setFromAxisAngle(s.axis, angle)
    object.current?.quaternion.copy(s.quat)
    transformPoint(s.rot, LOCAL.center, ORIGIN, s.center)

    const orbit = t * ORBIT_SPEED
    s.probePos[0] = ORBIT_X * Math.cos(orbit)
    s.probePos[1] = -ORBIT_Y * Math.sin(orbit)
    s.probePos[2] = 0
    rotationAxisAngle(PROBE_AXIS, t * 0.8, s.probeRot)
    s.probeQuat.setFromAxisAngle(s.probeAxis, t * 0.8)
    probe.current?.position.set(s.probePos[0], s.probePos[1], 0)
    probe.current?.quaternion.copy(s.probeQuat)

    // Same-type pair test, then pose both wires from the volume just tested.
    let hit: boolean
    let volume: number
    const a = mainWire.group.current
    const b = probeWire.group.current
    if (kind === "aabb") {
      refitAabb(LOCAL, s.rot, ORIGIN, s.aabbA)
      refitAabb(PROBE_LOCAL, s.probeRot, s.probePos, s.aabbB)
      hit = aabbOverlap(s.aabbA, s.aabbB)
      const { min: minA, max: maxA } = s.aabbA
      const hx = (maxA[0] - minA[0]) / 2
      const hy = (maxA[1] - minA[1]) / 2
      const hz = (maxA[2] - minA[2]) / 2
      volume = 8 * hx * hy * hz
      a?.position.set(minA[0] + hx, minA[1] + hy, minA[2] + hz)
      a?.scale.set(hx, hy, hz)
      a?.quaternion.copy(s.noRotation)
      const { min: minB, max: maxB } = s.aabbB
      const gx = (maxB[0] - minB[0]) / 2
      const gy = (maxB[1] - minB[1]) / 2
      const gz = (maxB[2] - minB[2]) / 2
      b?.position.set(minB[0] + gx, minB[1] + gy, minB[2] + gz)
      b?.scale.set(gx, gy, gz)
      b?.quaternion.copy(s.noRotation)
    } else if (kind === "obb") {
      hit = obbOverlap(obbA, obbB)
      volume = OBB_VOLUME
      a?.position.set(s.center[0], s.center[1], s.center[2])
      a?.scale.set(LOCAL.half[0], LOCAL.half[1], LOCAL.half[2])
      a?.quaternion.copy(s.quat)
      b?.position.set(s.probePos[0], s.probePos[1], 0)
      b?.scale.setScalar(PROBE_HALF)
      b?.quaternion.copy(s.probeQuat)
    } else {
      hit = sphereOverlap(sphereA, sphereB)
      volume = SPHERE_VOLUME
      a?.position.set(s.center[0], s.center[1], s.center[2])
      a?.scale.setScalar(RADIUS)
      b?.position.set(s.probePos[0], s.probePos[1], 0)
      b?.scale.setScalar(PROBE_RADIUS)
    }

    paint(mainWire, hit, s.green, s.red)
    paint(probeWire, hit, s.yellow, s.red)

    live.current = emptyFraction(SOLID, volume)
    if (gauge.current) {
      const share = 1 - emptyFraction(SOLID, volume)
      gauge.current.scale.x = Math.max(share * GAUGE_W, 0.001)
      gauge.current.position.x = -GAUGE_W / 2 + (share * GAUGE_W) / 2
    }
  })

  return (
    <>
      <group ref={object}>
        {COMPOUND.map((part, i) => (
          <mesh key={i} position={part.center}>
            <boxGeometry
              args={[part.half[0] * 2, part.half[1] * 2, part.half[2] * 2]}
            />
            <meshStandardMaterial color={palette.subject} roughness={0.7} />
          </mesh>
        ))}
      </group>
      <Wire
        key={`a-${kind}`}
        kind={kind}
        color={palette.success}
        refs={mainWire}
      />
      <mesh ref={probe}>
        <boxGeometry args={[PROBE_HALF * 2, PROBE_HALF * 2, PROBE_HALF * 2]} />
        <meshStandardMaterial color={palette.moving} roughness={0.7} />
      </mesh>
      <Wire
        key={`b-${kind}`}
        kind={kind}
        color={palette.moving}
        refs={probeWire}
      />
      {/* Live tightness: white share is the object, the rest is empty space. */}
      <group position={[0, GAUGE_Y, 0]}>
        <Line points={GAUGE_OUTLINE} color={palette.tertiary} lineWidth={1.5} />
        <mesh ref={gauge}>
          <boxGeometry args={[1, GAUGE_H, 0.01]} />
          <meshBasicMaterial color={palette.subject} />
        </mesh>
      </group>
    </>
  )
}

export default defineVisual<V>({
  gridY: -2.7,
  camera: { position: [0, 3.8, 11], target: [0, -0.25, 0], fov: 30 },
  params: [
    {
      key: "volume",
      label: "Bounding volume",
      type: "select",
      value: "aabb",
      options: [
        { value: "aabb", label: "AABB" },
        { value: "obb", label: "OBB" },
        { value: "sphere", label: "Sphere" },
      ],
    },
    { key: "spin", label: "Auto spin", type: "toggle", value: true },
    {
      key: "angle",
      label: "Angle (auto spin off)",
      min: 0,
      max: 360,
      step: 1,
      value: 40,
      unit: "°",
    },
  ],
  readout: (v) => {
    if (v.volume === "obb")
      return `OBB ${sizeText([LOCAL.half[0] * 2, LOCAL.half[1] * 2, LOCAL.half[2] * 2])} = ${OBB_VOLUME.toFixed(1)} u³ at any angle, ${pct(emptyFraction(SOLID, OBB_VOLUME))} empty · test: up to 15 axes`
    if (v.volume === "sphere")
      return `Sphere r ${RADIUS.toFixed(2)} u = ${SPHERE_VOLUME.toFixed(1)} u³ at any angle, ${pct(emptyFraction(SOLID, SPHERE_VOLUME))} empty · test: 1 squared distance`
    if (v.spin)
      return `AABB over a full turn: ${AABB_RANGE.min.toFixed(1)}–${AABB_RANGE.max.toFixed(1)} u³, ${pct(emptyFraction(SOLID, AABB_RANGE.min))}–${pct(emptyFraction(SOLID, AABB_RANGE.max))} empty · test: up to 6 comparisons`
    const { size, volume } = aabbAt(rad(v.angle))
    return `AABB at ${v.angle}°: ${sizeText(size)} = ${volume.toFixed(1)} u³, ${pct(emptyFraction(SOLID, volume))} empty · test: up to 6 comparisons`
  },
  Scene,
})
