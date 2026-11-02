import { useEffect, useMemo, useRef, type RefObject } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { rotorInertia, spinFromMomentum, spinFromTorque } from "@/lib/inertia"

import { defineVisual, palette, rad, useFixedStep, useVisual } from "../../kit"

type V = { radius: number; torque: number; conserve: boolean }

interface Rotor {
  angle: number
  omega: number
  r: number
}
interface Sim {
  t: number
  near: Rotor
  wide: Rotor
}

const MASS = 1 // kg on each end, so both rotors weigh the same 2 kg
const SPHERE = 0.22
const NEAR_RADIUS = 0.5
const NEAR_X = -3.05
const WIDE_X = 1.75
const RUN = 5 // s; the torque run restarts so spin never turns into a blur
const MOMENTUM = 3 // kg·m²/s in "conserve" mode
const EASE_RATE = 5 // 1/s, how quickly the masses slide to a new radius
const TORQUE_ARC_R = 0.95

// Dashed spin arc: starts at 12 o'clock and grows counter-clockwise with ω.
const DASHES = 30
const DASH_STEP = rad(10)
const MIN_DASHES = 2
const SPIN_START = Math.PI / 2
const MAX_TORQUE = 1.2
const NEAR_INERTIA = rotorInertia(MASS, NEAR_RADIUS)
const FULL_ARC_TORQUE = spinFromTorque(MAX_TORQUE, NEAR_INERTIA, RUN)
const FULL_ARC_CONSERVE = spinFromMomentum(MOMENTUM, NEAR_INERTIA)

function restart(s: Sim) {
  s.t = 0
  s.near.angle = s.near.omega = 0
  s.wide.angle = s.wide.omega = 0
}

function TorqueArc({ torque }: { torque: number }) {
  const start = rad(-140)
  const arc = (torque / MAX_TORQUE) * rad(240)
  const end = start + arc
  return (
    <group position={[0, 0, 0.02]}>
      <mesh rotation={[0, 0, start]}>
        <torusGeometry args={[TORQUE_ARC_R, 0.04, 8, 64, arc]} />
        <meshBasicMaterial color={palette.force} />
      </mesh>
      <mesh
        position={[
          TORQUE_ARC_R * Math.cos(end),
          TORQUE_ARC_R * Math.sin(end),
          0,
        ]}
        rotation={[0, 0, end]}
      >
        <coneGeometry args={[0.15, 0.34, 16]} />
        <meshBasicMaterial color={palette.force} />
      </mesh>
    </group>
  )
}

function RotorView({
  x,
  sim,
  which,
  fullArc,
  torque,
}: {
  x: number
  sim: RefObject<Sim>
  which: "near" | "wide"
  fullArc: number
  torque: number | null
}) {
  const arm = useRef<THREE.Group>(null)
  const rod = useRef<THREE.Mesh>(null)
  const massA = useRef<THREE.Mesh>(null)
  const massB = useRef<THREE.Mesh>(null)
  const orbit = useRef<THREE.Mesh>(null)
  const dashes = useRef<THREE.InstancedMesh>(null)
  const tip = useRef<THREE.Mesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame(() => {
    const { angle, omega, r } = sim.current[which]
    arm.current?.rotation.set(0, 0, angle)
    rod.current?.scale.set(r, 1, 1)
    massA.current?.position.set(r, 0, 0)
    massB.current?.position.set(-r, 0, 0)
    orbit.current?.scale.set(r, r, 1)

    const ring = Math.max(1.3, r + 0.42)
    const count = Math.max(
      MIN_DASHES,
      Math.min(DASHES, Math.round((omega / fullArc) * DASHES))
    )
    const mesh = dashes.current
    if (mesh) {
      for (let i = 0; i < count; i++) {
        const phi = SPIN_START + (i + 0.5) * DASH_STEP
        dummy.position.set(ring * Math.cos(phi), ring * Math.sin(phi), 0)
        dummy.rotation.set(0, 0, phi + Math.PI / 2)
        dummy.scale.set(ring * DASH_STEP * 0.6, 1, 1)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.count = count
      mesh.instanceMatrix.needsUpdate = true
    }
    const end = SPIN_START + count * DASH_STEP
    tip.current?.position.set(ring * Math.cos(end), ring * Math.sin(end), 0)
    tip.current?.rotation.set(0, 0, end)
  })

  return (
    <group position={[x, 0, 0]}>
      {/* The path the masses sweep: shows how far out the mass sits. */}
      <mesh ref={orbit}>
        <torusGeometry args={[1, 0.016, 8, 96]} />
        <meshBasicMaterial color={palette.tertiary} />
      </mesh>
      <group ref={arm}>
        <mesh ref={rod}>
          <boxGeometry args={[2, 0.07, 0.07]} />
          <meshStandardMaterial color={palette.object} />
        </mesh>
        <mesh ref={massA}>
          <sphereGeometry args={[SPHERE, 24, 24]} />
          <meshStandardMaterial color={palette.subject} />
        </mesh>
        <mesh ref={massB}>
          <sphereGeometry args={[SPHERE, 24, 24]} />
          <meshStandardMaterial color={palette.tertiary} />
        </mesh>
      </group>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.05]}>
        <cylinderGeometry args={[0.12, 0.12, 0.2, 20]} />
        <meshStandardMaterial color={palette.object} />
      </mesh>
      {torque !== null && <TorqueArc torque={torque} />}
      <instancedMesh
        ref={dashes}
        args={[undefined, undefined, DASHES]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 0.07, 0.03]} />
        <meshBasicMaterial color={palette.velocity} />
      </instancedMesh>
      <mesh ref={tip}>
        <coneGeometry args={[0.15, 0.34, 16]} />
        <meshBasicMaterial color={palette.velocity} />
      </mesh>
    </group>
  )
}

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const sim = useRef<Sim>({
    t: 0,
    near: { angle: 0, omega: 0, r: NEAR_RADIUS },
    wide: { angle: 0, omega: 0, r: v.radius },
  })

  // In torque mode any change starts a clean run. In conserve mode the slider
  // must not restart anything: moving the masses is the whole experiment.
  const run = v.conserve ? "conserve" : `torque/${v.radius}/${v.torque}`
  useEffect(() => {
    restart(sim.current)
  }, [resetKey, run])
  useEffect(() => {
    if (!v.conserve) sim.current.wide.r = v.radius
  }, [v.conserve, v.radius])

  useFixedStep((dt) => {
    const s = sim.current
    if (v.conserve) {
      s.wide.r += (v.radius - s.wide.r) * (1 - Math.exp(-EASE_RATE * dt))
      s.near.omega = spinFromMomentum(MOMENTUM, NEAR_INERTIA)
      s.wide.omega = spinFromMomentum(MOMENTUM, rotorInertia(MASS, s.wide.r))
    } else {
      s.t += dt
      if (s.t >= RUN) restart(s)
      s.near.omega += (v.torque / NEAR_INERTIA) * dt
      s.wide.omega += (v.torque / rotorInertia(MASS, s.wide.r)) * dt
    }
    s.near.angle = (s.near.angle + s.near.omega * dt) % (2 * Math.PI)
    s.wide.angle = (s.wide.angle + s.wide.omega * dt) % (2 * Math.PI)
  }, 120)

  const fullArc = v.conserve ? FULL_ARC_CONSERVE : FULL_ARC_TORQUE
  const torque = v.conserve ? null : v.torque
  return (
    <>
      <RotorView
        x={NEAR_X}
        sim={sim}
        which="near"
        fullArc={fullArc}
        torque={torque}
      />
      <RotorView
        x={WIDE_X}
        sim={sim}
        which="wide"
        fullArc={fullArc}
        torque={torque}
      />
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 0.5, 7.2], target: [0, 0, 0] },
  grid: false,
  params: [
    {
      key: "radius",
      label: "Mass radius",
      min: 0.5,
      max: 2.2,
      step: 0.1,
      value: 1.8,
      unit: "m",
    },
    {
      key: "torque",
      label: "Torque",
      min: 0.2,
      max: MAX_TORQUE,
      step: 0.1,
      value: 0.8,
      unit: "N·m",
    },
    {
      key: "conserve",
      label: "Conserve angular momentum",
      type: "toggle",
      value: false,
    },
  ],
  readout: (v) => {
    const wide = rotorInertia(MASS, v.radius)
    if (v.conserve) {
      const near = spinFromMomentum(MOMENTUM, NEAR_INERTIA)
      const spun = spinFromMomentum(MOMENTUM, wide)
      return `L ${MOMENTUM.toFixed(1)} kg·m²/s, no torque · Near I ${NEAR_INERTIA.toFixed(2)}, ω ${near.toFixed(2)} rad/s · Wide I ${wide.toFixed(2)}, ω ${spun.toFixed(2)} rad/s`
    }
    const near = spinFromTorque(v.torque, NEAR_INERTIA, RUN)
    const spun = spinFromTorque(v.torque, wide, RUN)
    return `After ${RUN} s · Near I ${NEAR_INERTIA.toFixed(2)}, ω ${near.toFixed(2)} rad/s · Wide I ${wide.toFixed(2)}, ω ${spun.toFixed(2)} rad/s`
  },
  Scene,
})
