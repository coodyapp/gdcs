import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { mulberry32 } from "@/lib/noise"

import { defineVisual, palette, rad, useClock } from "../../kit"

type V = { fov: number; far: number; sweep: boolean; yaw: number }

const EYE = new THREE.Vector3(-4.6, 0.5, 0)
const ASPECT = 16 / 9
const NEAR = 0.4

// Deterministic scatter so the readout count matches the scene.
const OBJECTS = (() => {
  const rand = mulberry32(11)
  const list: { pos: THREE.Vector3; r: number; box: boolean }[] = []
  while (list.length < 40) {
    const x = -3.4 + rand() * 9
    const z = -4.2 + rand() * 8.4
    const r = 0.18 + rand() * 0.22
    const pos = new THREE.Vector3(x, r, z)
    if (list.some((o) => o.pos.distanceTo(pos) < o.r + r + 0.35)) continue
    list.push({ pos, r, box: rand() < 0.5 })
  }
  return list
})()

const viewCam = new THREE.PerspectiveCamera(60, ASPECT, NEAR, 7)
viewCam.position.copy(EYE)
const frustum = new THREE.Frustum()
const viewProj = new THREE.Matrix4()
const sphere = new THREE.Sphere()

function updateFrustum(fov: number, far: number, yawDeg: number) {
  viewCam.fov = fov
  viewCam.far = far
  viewCam.updateProjectionMatrix()
  // Camera looks down -Z by default; yaw so 0° faces +X.
  viewCam.rotation.set(0, rad(yawDeg) - Math.PI / 2, 0)
  viewCam.updateMatrixWorld()
  viewProj.multiplyMatrices(
    viewCam.projectionMatrix,
    viewCam.matrixWorldInverse
  )
  frustum.setFromProjectionMatrix(viewProj)
}

const visible = (o: (typeof OBJECTS)[number]) =>
  frustum.intersectsSphere(sphere.set(o.pos, o.r * 1.15))

function Scene({ v }: { v: V }) {
  const time = useClock()
  const gizmo = useRef<THREE.Group>(null)
  const mats = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const on = useMemo(() => new THREE.Color(palette.subject), [])
  const off = useMemo(() => new THREE.Color(palette.object), [])

  // Frustum outline in camera space: near and far rectangles plus 4 edges.
  const edges = useMemo(() => {
    const corners = [NEAR, v.far].map((d) => {
      const h = d * Math.tan(rad(v.fov / 2))
      const w = h * ASPECT
      return [
        [-w, -h, -d],
        [w, -h, -d],
        [w, h, -d],
        [-w, h, -d],
      ]
    })
    const pts: number[] = []
    for (const quad of corners)
      for (let i = 0; i < 4; i++) pts.push(...quad[i], ...quad[(i + 1) % 4])
    for (let i = 0; i < 4; i++) pts.push(...corners[0][i], ...corners[1][i])
    return new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute(pts, 3)
    )
  }, [v.fov, v.far])

  useFrame(() => {
    const yaw = v.sweep ? Math.sin(time.current * 0.5) * 32 : v.yaw
    updateFrustum(v.fov, v.far, yaw)
    gizmo.current?.rotation.copy(viewCam.rotation)
    OBJECTS.forEach((o, i) => {
      const m = mats.current[i]
      if (!m) return
      const seen = visible(o)
      m.color.copy(seen ? on : off)
      m.opacity = seen ? 1 : 0.3
    })
  })

  return (
    <>
      {OBJECTS.map((o, i) => (
        <mesh key={i} position={o.pos}>
          {o.box ? (
            <boxGeometry args={[o.r * 1.6, o.r * 1.6, o.r * 1.6]} />
          ) : (
            <sphereGeometry args={[o.r, 20, 12]} />
          )}
          <meshStandardMaterial
            ref={(m) => {
              mats.current[i] = m
            }}
            transparent
            roughness={0.7}
          />
        </mesh>
      ))}
      <group ref={gizmo} position={EYE}>
        <mesh>
          <boxGeometry args={[0.35, 0.3, 0.45]} />
          <meshBasicMaterial color={palette.moving} />
        </mesh>
        <lineSegments geometry={edges}>
          <lineBasicMaterial color={palette.moving} />
        </lineSegments>
      </group>
    </>
  )
}

function countVisible(v: V) {
  updateFrustum(v.fov, v.far, v.yaw)
  return OBJECTS.filter(visible).length
}

export default defineVisual<V>({
  gridY: 0,
  camera: { position: [0.6, 14, 5.2], target: [0.6, 0, -0.2] },
  params: [
    {
      key: "fov",
      label: "Vertical FOV",
      min: 20,
      max: 100,
      step: 1,
      value: 50,
      unit: "°",
    },
    {
      key: "far",
      label: "Far plane",
      min: 2,
      max: 12,
      step: 0.1,
      value: 6.5,
      unit: "u",
    },
    { key: "sweep", label: "Sweep camera", type: "toggle", value: true },
    {
      key: "yaw",
      label: "Yaw (sweep off)",
      min: -60,
      max: 60,
      step: 1,
      value: 10,
      unit: "°",
    },
  ],
  readout: (v) => {
    if (v.sweep)
      return `${OBJECTS.length} objects · solid white = drawn, faded grey = culled · turn off sweep to count`
    const n = countVisible(v)
    return `Drawn ${n} / ${OBJECTS.length} · culled ${OBJECTS.length - n}`
  },
  Scene,
})
