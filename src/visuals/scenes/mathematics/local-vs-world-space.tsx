import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Edges, Line } from "@react-three/drei"
import * as THREE from "three"

import {
  chain,
  invert,
  rotation,
  transformPoint,
  translation,
  type Vec3,
} from "@/lib/transforms"

import { defineVisual, palette, rad, useClock } from "../../kit"

type V = { spin: boolean; yaw: number; mode: string }

const PIVOT: Vec3 = [-1.6, 0.4, -0.4]
const TILT = 0.3 // parent leans around world Z, so local ≠ world axes
const CHILD_LOCAL = new THREE.Vector3(2.4, 0.45, 0)
const POINT: Vec3 = [1.6, 1.3, 1.6]

const parentWorld = (yaw: number) =>
  chain(translation(...PIVOT), rotation("Z", TILT), rotation("Y", yaw))

function Axes({
  length,
  width,
  opacity = 1,
}: {
  length: number
  width: number
  opacity?: number
}) {
  const common = { lineWidth: width, transparent: opacity < 1, opacity }
  return (
    <>
      <Line
        points={[
          [0, 0, 0],
          [length, 0, 0],
        ]}
        color={palette.negative}
        {...common}
      />
      <Line
        points={[
          [0, 0, 0],
          [0, length, 0],
        ]}
        color={palette.positive}
        {...common}
      />
      <Line
        points={[
          [0, 0, 0],
          [0, 0, length],
        ]}
        color={palette.primary}
        {...common}
      />
    </>
  )
}

function Scene({ v }: { v: V }) {
  const time = useClock()
  const world = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Group>(null)
  const ghost = useRef<THREE.Mesh>(null)

  // The child is a real Object3D re-parented with add()/attach().
  const child = useMemo(() => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.6, 0.6),
      new THREE.MeshStandardMaterial({ color: palette.subject, roughness: 0.5 })
    )
    m.position.copy(CHILD_LOCAL)
    return m
  }, [])

  useEffect(() => {
    const parent = spin.current
    const root = world.current
    if (!parent || !root) return
    parent.updateWorldMatrix(true, true)
    if (v.mode === "child") {
      parent.add(child)
      child.position.copy(CHILD_LOCAL)
      child.quaternion.identity()
    } else if (v.mode === "attach") {
      root.attach(child) // keeps the world pose
    } else {
      root.add(child) // keeps local numbers → jumps
    }
  }, [v.mode, child])

  useEffect(() => () => void child.removeFromParent(), [child])

  useFrame(() => {
    if (!spin.current || !ghost.current) return
    spin.current.rotation.y = v.spin ? time.current * 0.8 : rad(v.yaw)
    spin.current.updateWorldMatrix(true, false)
    // Ghost: where the child would be if it were still parented.
    ghost.current.position.copy(CHILD_LOCAL)
    spin.current.localToWorld(ghost.current.position)
    spin.current.getWorldQuaternion(ghost.current.quaternion)
    ghost.current.visible = v.mode !== "child"
  })

  return (
    <group ref={world}>
      {/* World axes: thin and faint, they never move. */}
      <Axes length={3.2} width={1} opacity={0.35} />
      <group position={PIVOT} rotation={[0, 0, TILT]}>
        <group ref={spin}>
          <Axes length={1.5} width={3.5} />
          <mesh position={[1.2, 0, 0]}>
            <boxGeometry args={[2.4, 0.16, 0.16]} />
            <meshStandardMaterial color={palette.object} roughness={0.7} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.13, 16, 16]} />
            <meshBasicMaterial color={palette.foreground} />
          </mesh>
        </group>
      </group>
      <mesh ref={ghost} visible={false}>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
        <meshBasicMaterial
          color={palette.tertiary}
          transparent
          opacity={0.06}
          depthWrite={false}
        />
        <Edges color={palette.tertiary} />
      </mesh>
      <mesh position={POINT}>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshBasicMaterial color={palette.moving} />
      </mesh>
      <Line
        points={[PIVOT, POINT]}
        color={palette.guide}
        lineWidth={1.5}
        dashed
        dashSize={0.12}
        gapSize={0.1}
      />
    </group>
  )
}

const f = (p: Vec3) =>
  p.map((x) => (Math.abs(x) < 0.005 ? 0 : x).toFixed(2)).join(", ")

export default defineVisual<V>({
  gridY: 0,
  camera: { position: [1.2, 4.6, 6.2], target: [0, 0.7, 0] },
  params: [
    { key: "spin", label: "Spin parent", type: "toggle", value: true },
    {
      key: "yaw",
      label: "Parent yaw (spin off)",
      min: -180,
      max: 180,
      step: 1,
      value: 40,
      unit: "°",
    },
    {
      key: "mode",
      label: "White cube's parent",
      type: "select",
      value: "child",
      options: [
        { value: "child", label: "The arm (local)" },
        { value: "attach", label: "World via attach()" },
        { value: "add", label: "World via add()" },
      ],
    },
  ],
  readout: (v) => {
    if (v.spin)
      return `Yellow point world (${f(POINT)}) is fixed; its parent-local coords change every frame. Turn spin off to read them.`
    const m = parentWorld(rad(v.yaw))
    const local = transformPoint(invert(m)!, POINT)
    const back = transformPoint(m, local)
    return `worldToLocal (${f(POINT)}) → (${f(local)}) · localToWorld → (${f(back)})`
  },
  Scene,
})
