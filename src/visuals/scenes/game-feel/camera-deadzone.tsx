import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import { defineVisual, palette, useVisual, type Vec3 } from "../../kit"
import { damp, deadzoneAxis, smoothNoise } from "@/lib/game-feel"

type V = { width: number; depth: number; smoothing: number; trails: boolean }

const VIEW_W = 5.6
const VIEW_D = 3.5
const TRAIL = 140
const TRAIL_DT = 1 / 24

const rect = (w: number, d: number): Vec3[] => [
  [-w / 2, 0, -d / 2],
  [w / 2, 0, -d / 2],
  [w / 2, 0, d / 2],
  [-w / 2, 0, d / 2],
  [-w / 2, 0, -d / 2],
]

function targetAt(t: number, out: THREE.Vector3) {
  const x =
    3.6 * Math.sin(0.37 * t) +
    1.1 * smoothNoise(t * 0.5, 1) +
    0.3 * Math.sin(5.3 * t)
  const z =
    2.2 * Math.sin(0.53 * t + 1) +
    0.8 * smoothNoise(t * 0.5, 2) +
    0.25 * Math.cos(4.1 * t)
  return out.set(x, 0, z)
}

function Scene({ v }: { v: V }) {
  const { playing, resetKey } = useVisual()
  const rig = useRef<THREE.Group>(null)
  const zoneMat = useRef<THREE.MeshBasicMaterial>(null)
  const target = useRef<THREE.Mesh>(null)
  const camDots = useRef<THREE.InstancedMesh>(null)
  const tgtDots = useRef<THREE.InstancedMesh>(null)
  const sim = useRef({
    t: 0,
    cx: 0,
    cz: 0,
    trailAcc: 0,
    n: 0,
    head: 0,
    pushing: false,
  })
  const p = useMemo(() => new THREE.Vector3(), [])
  const m = useMemo(() => new THREE.Matrix4(), [])
  const view = useMemo(() => rect(VIEW_W, VIEW_D), [])
  const zone = useMemo(() => rect(v.width, v.depth), [v.width, v.depth])

  useEffect(() => {
    targetAt(0, p)
    sim.current = {
      t: 0,
      cx: p.x,
      cz: p.z,
      trailAcc: 0,
      n: 0,
      head: 0,
      pushing: false,
    }
  }, [resetKey, p])

  useFrame((_, delta) => {
    const s = sim.current
    if (playing) {
      const dt = Math.min(delta, 0.1)
      s.t += dt
      targetAt(s.t, p)
      const wantX = deadzoneAxis(s.cx, p.x, v.width / 2)
      const wantZ = deadzoneAxis(s.cz, p.z, v.depth / 2)
      s.pushing = wantX !== s.cx || wantZ !== s.cz
      s.cx = v.smoothing > 0 ? damp(s.cx, wantX, v.smoothing, dt) : wantX
      s.cz = v.smoothing > 0 ? damp(s.cz, wantZ, v.smoothing, dt) : wantZ
      s.trailAcc += dt
      if (s.trailAcc >= TRAIL_DT && camDots.current && tgtDots.current) {
        s.trailAcc -= TRAIL_DT
        m.makeTranslation(s.cx, 0.02, s.cz)
        camDots.current.setMatrixAt(s.head, m)
        m.makeTranslation(p.x, 0.01, p.z)
        tgtDots.current.setMatrixAt(s.head, m)
        s.head = (s.head + 1) % TRAIL
        s.n = Math.min(TRAIL, s.n + 1)
        camDots.current.count = s.n
        tgtDots.current.count = s.n
        camDots.current.instanceMatrix.needsUpdate = true
        tgtDots.current.instanceMatrix.needsUpdate = true
      }
    } else {
      targetAt(s.t, p)
    }
    target.current?.position.set(p.x, 0.25, p.z)
    rig.current?.position.set(s.cx, 0.03, s.cz)
    if (zoneMat.current) {
      // Pushing also brightens the fill, so the state is not hue-only.
      zoneMat.current.color.set(s.pushing ? palette.velocity : palette.success)
      zoneMat.current.opacity = s.pushing ? 0.45 : 0.18
    }
    if (camDots.current) camDots.current.visible = v.trails
    if (tgtDots.current) tgtDots.current.visible = v.trails
  })

  return (
    <group>
      <group ref={rig}>
        {/* What the camera sees (16:10). */}
        <Line points={view} color={palette.subject} lineWidth={3} />
        <mesh rotation-x={-Math.PI / 2}>
          <planeGeometry args={[VIEW_W, VIEW_D]} />
          <meshBasicMaterial
            color={palette.subject}
            transparent
            opacity={0.06}
            depthWrite={false}
          />
        </mesh>
        {/* Deadzone: the target may move freely inside it. */}
        <Line
          points={zone}
          color={palette.foreground}
          lineWidth={1.5}
          dashed
          dashSize={0.15}
          gapSize={0.1}
        />
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 0]}>
          <planeGeometry
            args={[Math.max(0.01, v.width), Math.max(0.01, v.depth)]}
          />
          <meshBasicMaterial
            ref={zoneMat}
            color={palette.success}
            transparent
            opacity={0.18}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[0.12, 0.02, 0.12]} />
          <meshBasicMaterial color={palette.subject} />
        </mesh>
      </group>
      <mesh ref={target}>
        <sphereGeometry args={[0.25, 24, 16]} />
        <meshStandardMaterial
          color={palette.moving}
          emissive={palette.moving}
          emissiveIntensity={0.35}
        />
      </mesh>
      <instancedMesh
        ref={camDots}
        args={[undefined, undefined, TRAIL]}
        count={0}
      >
        <boxGeometry args={[0.07, 0.01, 0.07]} />
        <meshBasicMaterial color={palette.subject} />
      </instancedMesh>
      <instancedMesh
        ref={tgtDots}
        args={[undefined, undefined, TRAIL]}
        count={0}
      >
        <boxGeometry args={[0.05, 0.01, 0.05]} />
        <meshBasicMaterial color={palette.moving} transparent opacity={0.6} />
      </instancedMesh>
    </group>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 9.5, 3.6], target: [0, 0, 0.2] },
  params: [
    {
      key: "width",
      label: "Deadzone width",
      min: 0,
      max: 5,
      step: 0.1,
      value: 2.4,
      unit: "u",
    },
    {
      key: "depth",
      label: "Deadzone height",
      min: 0,
      max: 3.2,
      step: 0.1,
      value: 1.4,
      unit: "u",
    },
    {
      key: "smoothing",
      label: "Follow smoothing (0 = off)",
      min: 0,
      max: 15,
      step: 0.5,
      value: 6,
      unit: "/s",
    },
    { key: "trails", label: "Show trails", type: "toggle", value: true },
  ],
  readout: (v) =>
    `Deadzone covers ${Math.round(((v.width * v.depth) / (VIEW_W * VIEW_D)) * 100)}% of the view${v.smoothing > 0 ? ` · catch-up half-life ${((Math.LN2 / v.smoothing) * 1000).toFixed(0)} ms` : " · hard follow"}`,
  Scene,
})
