import { useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import {
  buildFanIndices,
  type Cast,
  castFan,
  castRay,
  fanCapacity,
  fanIndexCount,
  type FanResult,
  type Obstacle,
  writeFanPositions,
} from "@/lib/fov"

import { defineVisual, palette, rad, useClock } from "../../kit"

type V = { rays: number; iterations: number; showRays: boolean }

const EYE = { x: -2.8, y: 0 }
const VIEW_ANGLE = rad(120)
const RADIUS = 4.8
const THRESHOLD = 0.5
const MAX_RAYS = 120
const CAP = fanCapacity(MAX_RAYS)
const H = 0.03
const WALLS: Obstacle[] = [
  { kind: "box", x: -0.4, y: -1.4, hx: 0.35, hy: 0.45 },
  { kind: "circle", x: -0.2, y: 1.1, r: 0.5 },
  { kind: "box", x: 1.6, y: 0.1, hx: 0.3, hy: 0.8 },
  { kind: "circle", x: 1.4, y: -2.4, r: 0.4 },
  { kind: "box", x: 2.0, y: 2.3, hx: 0.6, hy: 0.3 },
]
const cast: Cast = (angle, out) => castRay(WALLS, EYE, angle, RADIUS, out)
const headingAt = (t: number) => Math.sin(t * 0.3) * 0.45

// Readout runs the same cast at the start pose (t = 0), off the render loop.
const readoutPoints = new Float32Array(CAP * 2)
const readoutResult: FanResult = { count: 0, rays: 0, refineCasts: 0 }

function Scene({ v }: { v: V }) {
  const time = useClock()
  const s = useMemo(() => {
    const points = new Float32Array(CAP * 2)
    const refined = new Uint8Array(CAP)
    const result: FanResult = { count: 0, rays: 0, refineCasts: 0 }

    const fanGeo = new THREE.BufferGeometry()
    fanGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array((CAP + 1) * 3), 3)
    )
    fanGeo.setIndex(new THREE.BufferAttribute(buildFanIndices(CAP), 1))
    const fan = new THREE.Mesh(
      fanGeo,
      new THREE.MeshBasicMaterial({
        color: palette.subject,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    )
    fan.frustumCulled = false

    const rimGeo = new THREE.BufferGeometry()
    rimGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(CAP * 3), 3)
    )
    const rim = new THREE.Line(
      rimGeo,
      new THREE.LineBasicMaterial({ color: palette.subject })
    )
    rim.frustumCulled = false

    const segs = (color: string, opacity: number) => {
      const g = new THREE.BufferGeometry()
      g.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(CAP * 6), 3)
      )
      const l = new THREE.LineSegments(
        g,
        new THREE.LineBasicMaterial({ color, transparent: true, opacity })
      )
      l.frustumCulled = false
      return l
    }
    const rays = segs(palette.tertiary, 0.55)
    const edgeRays = segs(palette.moving, 0.9)

    const dotGeo = new THREE.BufferGeometry()
    dotGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(CAP * 3), 3)
    )
    const dots = new THREE.Points(
      dotGeo,
      new THREE.PointsMaterial({
        color: palette.moving,
        size: 6,
        sizeAttenuation: false,
      })
    )
    dots.frustumCulled = false
    return { points, refined, result, fan, rim, rays, edgeRays, dots }
  }, [])

  useFrame(() => {
    const r = castFan(
      cast,
      headingAt(time.current),
      VIEW_ANGLE,
      v.rays,
      v.iterations,
      THRESHOLD,
      s.points,
      s.result,
      s.refined
    )
    const n = r.count

    const fanPos = s.fan.geometry.attributes.position as THREE.BufferAttribute
    writeFanPositions(EYE, s.points, n, H, fanPos.array as Float32Array)
    fanPos.needsUpdate = true
    s.fan.geometry.setDrawRange(0, fanIndexCount(n))

    const rimPos = s.rim.geometry.attributes.position as THREE.BufferAttribute
    const rayPos = s.rays.geometry.attributes.position as THREE.BufferAttribute
    const edgePos = s.edgeRays.geometry.attributes
      .position as THREE.BufferAttribute
    const dotPos = s.dots.geometry.attributes.position as THREE.BufferAttribute
    let plain = 0
    let edges = 0
    for (let i = 0; i < n; i++) {
      const x = s.points[i * 2]
      const z = s.points[i * 2 + 1]
      rimPos.setXYZ(i, x, H + 0.01, z)
      const target = s.refined[i] ? edgePos : rayPos
      const k = s.refined[i] ? edges++ : plain++
      target.setXYZ(k * 2, EYE.x, H + 0.02, EYE.y)
      target.setXYZ(k * 2 + 1, x, H + 0.02, z)
      if (s.refined[i]) dotPos.setXYZ(k, x, H + 0.03, z)
    }
    rimPos.needsUpdate = rayPos.needsUpdate = true
    edgePos.needsUpdate = dotPos.needsUpdate = true
    s.rim.geometry.setDrawRange(0, n)
    s.rays.geometry.setDrawRange(0, plain * 2)
    s.edgeRays.geometry.setDrawRange(0, edges * 2)
    s.dots.geometry.setDrawRange(0, edges)
    s.rays.visible = s.edgeRays.visible = s.dots.visible = v.showRays
  })

  return (
    <>
      <primitive object={s.fan} />
      <primitive object={s.rim} />
      <primitive object={s.rays} />
      <primitive object={s.edgeRays} />
      <primitive object={s.dots} />
      <mesh position={[EYE.x, 0.2, EYE.y]}>
        <sphereGeometry args={[0.18, 24, 16]} />
        <meshBasicMaterial color={palette.subject} />
      </mesh>
      {WALLS.map((o, i) =>
        o.kind === "box" ? (
          <mesh key={i} position={[o.x, 0.3, o.y]}>
            <boxGeometry args={[o.hx * 2, 0.6, o.hy * 2]} />
            <meshStandardMaterial color={palette.object} roughness={0.8} />
          </mesh>
        ) : (
          <mesh key={i} position={[o.x, 0.3, o.y]}>
            <cylinderGeometry args={[o.r, o.r, 0.6, 32]} />
            <meshStandardMaterial color={palette.object} roughness={0.8} />
          </mesh>
        )
      )}
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 11.5, 3.4], target: [0, 0, 0.2] },
  params: [
    { key: "rays", label: "Rays", min: 4, max: MAX_RAYS, step: 1, value: 24 },
    {
      key: "iterations",
      label: "Edge-resolve iterations",
      min: 0,
      max: 8,
      step: 1,
      value: 4,
    },
    { key: "showRays", label: "Show rays", type: "toggle", value: true },
  ],
  readout: (v) => {
    const r = castFan(
      cast,
      headingAt(0),
      VIEW_ANGLE,
      v.rays,
      v.iterations,
      THRESHOLD,
      readoutPoints,
      readoutResult
    )
    return `${r.rays} rays + ${r.refineCasts} edge casts → ${r.count + 1} vertices (start pose)`
  },
  Scene,
})
