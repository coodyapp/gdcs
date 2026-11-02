import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import {
  cosHalfAngle,
  inViewCone,
  lineOfSight,
  makeHit,
  type Obstacle,
} from "@/lib/fov"

import { Arrow, makeLine, setArrow, setSegment } from "../../arrow"
import { defineVisual, palette, rad, useClock } from "../../kit"

type V = { angle: number; radius: number; walls: boolean }

const EYE = { x: -2.6, y: 0 }
const Y = 0.25
const ARC = 48
const WALLS: Obstacle[] = [
  { kind: "box", x: -0.7, y: -1.0, hx: 0.25, hy: 0.5 },
  { kind: "circle", x: -0.6, y: 1.0, r: 0.4 },
  { kind: "box", x: 0.6, y: 0.1, hx: 0.25, hy: 0.6 },
]
const NONE: Obstacle[] = []
/** Targets glide on ellipses: center, radii, angular speed, phase. */
const TARGETS = [
  { cx: 0.9, cy: 0, rx: 1.6, ry: 2.2, w: 0.4, p: 0 },
  { cx: 1.6, cy: 0.4, rx: 0.8, ry: 1.6, w: -0.55, p: 1 },
  { cx: -0.4, cy: 0, rx: 1, ry: 2.4, w: 0.3, p: 2 },
  { cx: 1.2, cy: -0.4, rx: 2.2, ry: 1.2, w: -0.3, p: 3.5 },
  { cx: -1.2, cy: 0.6, rx: 0.8, ry: 1.6, w: 0.5, p: 4.5 },
  { cx: 0, cy: 0, rx: 3.2, ry: 2.6, w: 0.2, p: 5.5 },
]

function Scene({ v }: { v: V }) {
  const time = useClock()
  const guardArrow = useRef<THREE.Group>(null)
  const targets = useRef<(THREE.Mesh | null)[]>([])
  const dots = useRef<(THREE.Mesh | null)[]>([])

  const outline = useMemo(() => {
    const line = makeLine(palette.subject, ARC + 3)
    line.frustumCulled = false
    return line
  }, [])
  const sight = useMemo(
    () =>
      TARGETS.map(() => {
        const line = makeLine(palette.success, 2, undefined, 0.7)
        line.frustumCulled = false
        return line
      }),
    []
  )
  const blocked = useMemo(
    () =>
      TARGETS.map(() => {
        const line = makeLine(palette.error, 2)
        line.frustumCulled = false
        return line
      }),
    []
  )
  const mats = useMemo(
    () => TARGETS.map(() => new THREE.MeshBasicMaterial()),
    []
  )
  const s = useMemo(
    () => ({
      fwd: { x: 1, y: 0 },
      tgt: { x: 0, y: 0 },
      hit: makeHit(),
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      eye: new THREE.Vector3(EYE.x, Y, EYE.y),
    }),
    []
  )

  useFrame(() => {
    const t = time.current
    const heading = Math.sin(t * 0.45) * 0.6
    const half = rad(v.angle) / 2
    const cosHalf = cosHalfAngle(rad(v.angle))
    const walls = v.walls ? WALLS : NONE
    s.fwd.x = Math.cos(heading)
    s.fwd.y = Math.sin(heading)

    // Cone outline: eye → arc → eye.
    const pos = outline.geometry.attributes.position as THREE.BufferAttribute
    pos.setXYZ(0, EYE.x, 0.02, EYE.y)
    for (let k = 0; k <= ARC; k++) {
      const a = heading - half + (2 * half * k) / ARC
      pos.setXYZ(
        k + 1,
        EYE.x + Math.cos(a) * v.radius,
        0.02,
        EYE.y + Math.sin(a) * v.radius
      )
    }
    pos.setXYZ(ARC + 2, EYE.x, 0.02, EYE.y)
    pos.needsUpdate = true

    s.b.set(EYE.x + s.fwd.x * 0.9, Y, EYE.y + s.fwd.y * 0.9)
    setArrow(guardArrow.current, s.eye, s.b)

    for (let i = 0; i < TARGETS.length; i++) {
      const T = TARGETS[i]
      const ang = T.p + T.w * t
      s.tgt.x = T.cx + Math.cos(ang) * T.rx
      s.tgt.y = T.cy + Math.sin(ang) * T.ry
      const mesh = targets.current[i]
      const dot = dots.current[i]
      if (!mesh || !dot) continue
      mesh.position.set(s.tgt.x, Y, s.tgt.y)

      const inCone = inViewCone(EYE, s.fwd, s.tgt, v.radius, cosHalf)
      const clear = inCone && lineOfSight(walls, EYE, s.tgt, s.hit)
      const mat = mats[i]
      if (clear) {
        mat.color.set(palette.success)
        mat.wireframe = false
      } else if (inCone) {
        mat.color.set(palette.tertiary)
        mat.wireframe = false
      } else {
        mat.color.set(palette.object)
        mat.wireframe = true
      }
      sight[i].visible = clear
      blocked[i].visible = inCone && !clear
      dot.visible = inCone && !clear
      if (clear) {
        s.a.set(s.tgt.x, Y, s.tgt.y)
        setSegment(sight[i], s.eye, s.a)
      } else if (inCone) {
        s.a.set(s.hit.x, Y, s.hit.y)
        setSegment(blocked[i], s.eye, s.a)
        dot.position.copy(s.a)
      }
    }
  })

  return (
    <>
      <primitive object={outline} />
      {sight.map((l, i) => (
        <primitive key={`s${i}`} object={l} />
      ))}
      {blocked.map((l, i) => (
        <primitive key={`b${i}`} object={l} />
      ))}
      <mesh position={[EYE.x, Y, EYE.y]}>
        <sphereGeometry args={[0.2, 24, 16]} />
        <meshBasicMaterial color={palette.subject} />
      </mesh>
      <Arrow ref={guardArrow} color={palette.subject} radius={0.035} />
      {v.walls &&
        WALLS.map((o, i) =>
          o.kind === "box" ? (
            <mesh key={i} position={[o.x, 0.4, o.y]}>
              <boxGeometry args={[o.hx * 2, 0.8, o.hy * 2]} />
              <meshStandardMaterial color={palette.object} roughness={0.8} />
            </mesh>
          ) : (
            <mesh key={i} position={[o.x, 0.4, o.y]}>
              <cylinderGeometry args={[o.r, o.r, 0.8, 32]} />
              <meshStandardMaterial color={palette.object} roughness={0.8} />
            </mesh>
          )
        )}
      {TARGETS.map((_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            targets.current[i] = m
          }}
          material={mats[i]}
        >
          <sphereGeometry args={[0.2, 10, 6]} />
        </mesh>
      ))}
      {TARGETS.map((_, i) => (
        <mesh
          key={`d${i}`}
          ref={(m) => {
            dots.current[i] = m
          }}
        >
          <sphereGeometry args={[0.08, 12, 8]} />
          <meshBasicMaterial color={palette.error} />
        </mesh>
      ))}
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [-0.2, 10.5, 4.2], target: [-0.2, 0, 0.4] },
  params: [
    {
      key: "angle",
      label: "View angle",
      min: 20,
      max: 180,
      step: 1,
      value: 90,
      unit: "°",
    },
    {
      key: "radius",
      label: "View radius",
      min: 2,
      max: 7,
      step: 0.1,
      value: 4.5,
      unit: "u",
    },
    { key: "walls", label: "Obstacles", type: "toggle", value: true },
  ],
  readout: (v) =>
    `cos(θ/2) = ${Math.cos(rad(v.angle) / 2).toFixed(3)} · radius ${v.radius.toFixed(1)} u`,
  Scene,
})
