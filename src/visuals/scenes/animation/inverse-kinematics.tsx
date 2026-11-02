import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import { fabrik, twoBoneIK, type P2 } from "@/lib/ik"

import { defineVisual, palette, useClock, type Vec3 } from "../../kit"

type V = {
  solver: string
  orbit: number
  flip: boolean
  iterations: number
}

const ARM: [number, number] = [1.3, 1.1]
const CHAIN = [0.7, 0.6, 0.6, 0.5]
const REACH = 2.4
const BASE_Y = 0.3
const ORBIT_CENTRE: P2 = [0.3, 1.2]
const ORBIT_DIST = Math.hypot(...ORBIT_CENTRE)

/** Place a unit-height cylinder between two points in the XY plane. */
function placeBone(m: THREE.Object3D, a: P2, b: P2) {
  m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0)
  m.rotation.set(0, 0, Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.PI / 2)
  m.scale.set(1, Math.hypot(b[0] - a[0], b[1] - a[1]), 1)
}

function ellipse(cx: number, cy: number, rx: number, ry = rx): Vec3[] {
  return Array.from({ length: 97 }, (_, i) => {
    const a = (i / 96) * Math.PI * 2
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, -0.05] as Vec3
  })
}

/** Target marker: solid green sphere when reachable, red wireframe when not. */
function Target({ refs }: { refs: React.RefObject<THREE.Group | null> }) {
  return (
    <group ref={refs}>
      <mesh name="ok">
        <sphereGeometry args={[0.14, 20, 20]} />
        <meshBasicMaterial color={palette.success} />
      </mesh>
      <mesh name="bad" visible={false}>
        <octahedronGeometry args={[0.22]} />
        <meshBasicMaterial color={palette.error} wireframe />
      </mesh>
    </group>
  )
}

function setTarget(g: THREE.Group | null, p: P2, reached: boolean) {
  if (!g) return
  g.position.set(p[0], p[1], 0.05)
  g.children[0].visible = reached
  g.children[1].visible = !reached
}

function Scene({ v }: { v: V }) {
  const time = useClock()
  const showTwo = v.solver !== "fabrik"
  const showChain = v.solver !== "two-bone"
  const both = showTwo && showChain
  const twoBase: P2 = [both ? -2.6 : 0, BASE_Y]
  const chainBase: P2 = [both ? 2.6 : 0, BASE_Y]

  const upper = useRef<THREE.Mesh>(null)
  const lower = useRef<THREE.Mesh>(null)
  const elbow = useRef<THREE.Mesh>(null)
  const hand = useRef<THREE.Mesh>(null)
  const pole = useRef<THREE.Mesh>(null)
  const twoTarget = useRef<THREE.Group>(null)
  const chainTarget = useRef<THREE.Group>(null)
  const bones = useRef<(THREE.Mesh | null)[]>([])
  const rings = useRef<(THREE.Mesh | null)[]>([])
  const joints = useMemo<P2[]>(
    () => [
      [0, 0],
      [0, 0.7],
      [0, 1.3],
      [0, 1.9],
      [0, 2.4],
    ],
    []
  )
  const lastBase = useRef<P2>([NaN, NaN])
  const tgt = useMemo<P2>(() => [0, 0], [])

  useFrame(() => {
    const t = time.current * 0.7
    const ox = Math.cos(t) * v.orbit
    const oy = Math.sin(t) * v.orbit * 0.85
    const bend = v.flip ? -1 : 1

    if (showTwo) {
      tgt[0] = twoBase[0] + ORBIT_CENTRE[0] + ox
      tgt[1] = twoBase[1] + ORBIT_CENTRE[1] + oy
      const s = twoBoneIK(twoBase, ARM[0], ARM[1], tgt, bend)
      const [b, e, h] = s.joints
      if (upper.current) placeBone(upper.current, b, e)
      if (lower.current) placeBone(lower.current, e, h)
      elbow.current?.position.set(e[0], e[1], 0)
      hand.current?.position.set(h[0], h[1], 0)
      // Pole: a point on the bend side of the base→target line.
      if (pole.current) {
        const dx = tgt[0] - b[0]
        const dy = tgt[1] - b[1]
        const d = Math.hypot(dx, dy) || 1
        pole.current.position.set(
          (b[0] + tgt[0]) / 2 + (dy / d) * 1.3 * bend,
          (b[1] + tgt[1]) / 2 - (dx / d) * 1.3 * bend,
          0
        )
        pole.current.rotation.y = t * 2
      }
      setTarget(twoTarget.current, tgt, s.reached)
    }

    if (showChain) {
      // Re-seed the chain upright when its base moves (layout change).
      if (lastBase.current[0] !== chainBase[0]) {
        let y = chainBase[1]
        joints.forEach((j, i) => {
          if (i > 0) y += CHAIN[i - 1]
          j[0] = chainBase[0]
          j[1] = i === 0 ? chainBase[1] : y
        })
        lastBase.current = [chainBase[0], chainBase[1]]
      }
      tgt[0] = chainBase[0] + ORBIT_CENTRE[0] + ox
      tgt[1] = chainBase[1] + ORBIT_CENTRE[1] + oy
      // Warm start: keep last frame's pose, run a few iterations.
      fabrik(joints, tgt, 1e-3, v.iterations, CHAIN)
      for (let i = 0; i < CHAIN.length; i++) {
        const m = bones.current[i]
        if (m) placeBone(m, joints[i], joints[i + 1])
      }
      for (let i = 0; i < joints.length; i++)
        rings.current[i]?.position.set(joints[i][0], joints[i][1], 0)
      const reachable =
        Math.hypot(tgt[0] - chainBase[0], tgt[1] - chainBase[1]) <= REACH
      setTarget(chainTarget.current, tgt, reachable)
    }
  })

  const reachCircle = (base: P2) => (
    <Line
      points={ellipse(base[0], base[1], REACH)}
      color={palette.guide}
      lineWidth={1}
      dashed
      dashSize={0.15}
      gapSize={0.12}
    />
  )
  const orbitPath = (base: P2) => (
    <Line
      points={ellipse(
        base[0] + ORBIT_CENTRE[0],
        base[1] + ORBIT_CENTRE[1],
        v.orbit,
        v.orbit * 0.85
      )}
      color={palette.success}
      lineWidth={1}
      transparent
      opacity={0.35}
    />
  )
  const baseBlock = (base: P2) => (
    <mesh position={[base[0], base[1] - 0.15, 0]}>
      <boxGeometry args={[0.6, 0.3, 0.6]} />
      <meshStandardMaterial color={palette.object} />
    </mesh>
  )

  return (
    <group>
      {showTwo && (
        <group>
          {reachCircle(twoBase)}
          {orbitPath(twoBase)}
          {baseBlock(twoBase)}
          <mesh ref={upper}>
            <cylinderGeometry args={[0.1, 0.1, 1, 16]} />
            <meshStandardMaterial
              color={palette.subject}
              emissive={palette.subject}
              emissiveIntensity={0.2}
            />
          </mesh>
          <mesh ref={lower}>
            <cylinderGeometry args={[0.08, 0.08, 1, 16]} />
            <meshStandardMaterial
              color={palette.subject}
              emissive={palette.subject}
              emissiveIntensity={0.2}
            />
          </mesh>
          <mesh ref={elbow}>
            <sphereGeometry args={[0.13, 16, 16]} />
            <meshBasicMaterial color={palette.foreground} />
          </mesh>
          <mesh ref={hand}>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshBasicMaterial color={palette.foreground} />
          </mesh>
          <mesh ref={pole}>
            <octahedronGeometry args={[0.16]} />
            <meshBasicMaterial color={palette.tertiary} />
          </mesh>
          <Target refs={twoTarget} />
        </group>
      )}
      {showChain && (
        <group>
          {reachCircle(chainBase)}
          {orbitPath(chainBase)}
          {baseBlock(chainBase)}
          {CHAIN.map((_, i) => (
            <mesh key={i} ref={(m) => void (bones.current[i] = m)}>
              <cylinderGeometry args={[0.06, 0.06, 1, 12]} />
              <meshStandardMaterial
                color={palette.moving}
                emissive={palette.moving}
                emissiveIntensity={0.2}
              />
            </mesh>
          ))}
          {joints.map((_, i) => (
            <mesh key={i} ref={(m) => void (rings.current[i] = m)}>
              <torusGeometry args={[0.12, 0.035, 8, 24]} />
              <meshBasicMaterial color={palette.moving} />
            </mesh>
          ))}
          <Target refs={chainTarget} />
        </group>
      )}
    </group>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 0.5, 7.9], target: [0, 0.4, 0] },
  grid: false,
  params: [
    {
      key: "solver",
      label: "Solver",
      type: "select",
      value: "both",
      options: [
        { value: "both", label: "Both side by side" },
        { value: "two-bone", label: "Analytic two-bone" },
        { value: "fabrik", label: "FABRIK (4 bones)" },
      ],
    },
    {
      key: "orbit",
      label: "Target orbit radius",
      min: 0.4,
      max: 1.8,
      step: 0.05,
      value: 1.35,
      unit: "u",
      digits: 2,
    },
    {
      key: "flip",
      label: "Flip pole (elbow side)",
      type: "toggle",
      value: false,
    },
    {
      key: "iterations",
      label: "FABRIK iterations / frame",
      min: 1,
      max: 20,
      step: 1,
      value: 8,
    },
  ],
  readout: (v) => {
    const far = ORBIT_DIST + v.orbit
    return `Reach ${REACH.toFixed(1)} u · farthest target ${far.toFixed(2)} u · ${far > REACH ? "unreachable on part of the orbit (red)" : "always reachable"}`
  },
  Scene,
})
