import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { defineVisual, palette, rad, useClock } from "../../kit"

type V = { auto: boolean; aim: number; far: number }

const ORIGIN = new THREE.Vector3(-3.5, 0.6, 0)
const OBSTACLES: {
  pos: [number, number, number]
  kind: "box" | "sphere"
  size: number
}[] = [
  { pos: [1.2, 0.6, -2.2], kind: "box", size: 1.2 },
  { pos: [2.6, 0.7, 0.4], kind: "sphere", size: 0.75 },
  { pos: [0.4, 0.5, 2.1], kind: "box", size: 1 },
  { pos: [-0.6, 0.55, -0.4], kind: "sphere", size: 0.45 },
]

function Scene({ v }: { v: V }) {
  const time = useClock()
  const group = useRef<THREE.Group>(null)
  const dot = useRef<THREE.Mesh>(null)
  const arrow = useMemo(
    () =>
      new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(),
        0.8,
        palette.positive,
        0.2,
        0.12
      ),
    []
  )
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const dir = useMemo(() => new THREE.Vector3(), [])
  const end = useMemo(() => new THREE.Vector3(), [])
  const normal = useMemo(() => new THREE.Vector3(), [])
  const nm = useMemo(() => new THREE.Matrix3(), [])
  const beamGeometry = useMemo(
    () => new THREE.BufferGeometry().setFromPoints([ORIGIN, ORIGIN]),
    []
  )
  const beam = useMemo(
    () =>
      new THREE.Line(
        beamGeometry,
        new THREE.LineBasicMaterial({ color: palette.primary })
      ),
    [beamGeometry]
  )

  useFrame(() => {
    if (!group.current || !dot.current) return
    const angle = v.auto ? Math.sin(time.current * 0.6) * 0.9 : rad(v.aim)
    dir.set(Math.cos(angle), 0, Math.sin(angle)).normalize()
    raycaster.set(ORIGIN, dir)
    raycaster.far = v.far
    const [hit] = raycaster.intersectObjects(group.current.children, false)
    if (hit) {
      end.copy(hit.point)
      nm.getNormalMatrix(hit.object.matrixWorld)
      normal.copy(hit.face!.normal).applyMatrix3(nm).normalize()
      arrow.position.copy(hit.point)
      arrow.setDirection(normal)
    } else {
      end.copy(ORIGIN).addScaledVector(dir, v.far)
    }
    arrow.visible = Boolean(hit)
    dot.current.visible = Boolean(hit)
    dot.current.position.copy(end)
    const pos = beamGeometry.attributes.position as THREE.BufferAttribute
    pos.setXYZ(1, end.x, end.y, end.z)
    pos.needsUpdate = true
    beam.material.color.set(hit ? palette.primary : palette.guide)
  })

  return (
    <>
      <group ref={group}>
        {OBSTACLES.map((o, i) => (
          <mesh key={i} position={o.pos}>
            {o.kind === "box" ? (
              <boxGeometry args={[o.size, o.size, o.size]} />
            ) : (
              <sphereGeometry args={[o.size, 32, 16]} />
            )}
            <meshStandardMaterial color={palette.object} roughness={0.7} />
          </mesh>
        ))}
      </group>
      <mesh position={ORIGIN}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial color={palette.foreground} />
      </mesh>
      <primitive object={beam} />
      <mesh ref={dot}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color={palette.secondary} />
      </mesh>
      <primitive object={arrow} />
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 7.5, 6.5], target: [0, 0, 0] },
  params: [
    { key: "auto", label: "Auto sweep", type: "toggle", value: true },
    {
      key: "aim",
      label: "Aim angle",
      min: -60,
      max: 60,
      step: 1,
      value: 10,
      unit: "°",
    },
    {
      key: "far",
      label: "Max distance",
      min: 1,
      max: 9,
      step: 0.1,
      value: 7,
      unit: "u",
    },
  ],
  Scene,
})
