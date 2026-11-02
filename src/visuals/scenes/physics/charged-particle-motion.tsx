import { useEffect, useMemo, useRef, type ComponentRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import {
  borisStep,
  cyclotronPeriod,
  eulerStep,
  exbDriftSpeed,
  larmorRadius,
  rk4Step,
  type ParticleState,
} from "@/lib/physics/lorentz"

import { defineVisual, palette, useFixedStep, useVisual } from "../../kit"

type V = { electric: number; magnetic: number; speed: number; method: string }

const TRAIL = 240
const START_X = -4.2
/** Simulated seconds per real second (q/m = 1 units). */
const SIM_SPEED = 2
const HZ = 120
const STEPPERS = { boris: borisStep, rk4: rk4Step, euler: eulerStep }

type LineRef = ComponentRef<typeof Line>

/** Overwrite a drei <Line>'s vertices in place (no geometry rebuild). */
function writeLine(line: LineRef | null, xyz: Float32Array) {
  if (!line) return
  const attr = line.geometry.attributes
    .instanceStart as THREE.InterleavedBufferAttribute
  const seg = attr.data.array as Float32Array
  for (let i = 0; i < xyz.length / 3 - 1; i++) {
    for (let c = 0; c < 6; c++) seg[i * 6 + c] = xyz[i * 3 + c]
  }
  attr.data.needsUpdate = true
  // Dashed lines also need their per-segment distances refreshed.
  const dist = line.geometry.attributes.instanceDistanceStart as
    | THREE.InterleavedBufferAttribute
    | undefined
  if (!dist) return
  const d = dist.data.array as Float32Array
  let total = 0
  for (let i = 0; i < xyz.length / 3 - 1; i++) {
    const j = i * 3
    d[i * 2] = total
    total += Math.hypot(
      xyz[j + 3] - xyz[j],
      xyz[j + 4] - xyz[j + 1],
      xyz[j + 5] - xyz[j + 2]
    )
    d[i * 2 + 1] = total
  }
  dist.data.needsUpdate = true
}

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const particle = useRef<THREE.Mesh>(null)
  const trailRef = useRef<LineRef>(null)
  const velRef = useRef<LineRef>(null)
  const trail = useMemo(() => new Float32Array(TRAIL * 3), [])
  const velPts = useMemo(() => new Float32Array(6), [])
  const initial = useMemo(
    () =>
      Array.from(
        { length: TRAIL },
        () => [START_X, 0, 0] as [number, number, number]
      ),
    []
  )
  const s = useRef<ParticleState>({
    x: START_X,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
  })
  const E = useMemo<[number, number, number]>(() => [0, 0, 0], [])
  const B = useMemo<[number, number, number]>(() => [0, 0, 0], [])
  const frame = useRef(0)

  const restart = () => {
    // Enter from the side the E×B drift moves away from, with the guiding
    // centre (y = (v − v_drift)/B for q > 0) on the x axis.
    const drift = v.electric / v.magnetic
    const x =
      Math.abs(v.electric) < 0.03 ? 0 : -Math.sign(drift) * Math.abs(START_X)
    const y = Math.max(-2.5, Math.min(2.5, (v.speed - drift) / v.magnetic))
    const p = s.current
    p.x = x
    p.y = y
    p.z = 0
    p.vx = v.speed
    p.vy = 0
    p.vz = 0
    for (let i = 0; i < TRAIL; i++) {
      trail[i * 3] = x
      trail[i * 3 + 1] = y
      trail[i * 3 + 2] = 0
    }
  }
  const restartRef = useRef(restart)
  restartRef.current = restart
  useEffect(
    () => restartRef.current(),
    [resetKey, v.speed, v.method, v.electric, v.magnetic]
  )

  useFixedStep((dt) => {
    // E along +y (in the screen plane), B along +z (out of the screen).
    E[1] = v.electric
    B[2] = v.magnetic
    const step = STEPPERS[v.method as keyof typeof STEPPERS] ?? borisStep
    const p = s.current
    step(p, E, B, 1, dt * SIM_SPEED)
    if (Math.abs(p.x) > 5.2 || Math.abs(p.y) > 3.4 || !Number.isFinite(p.x))
      restart()
    // Record a trail point every other step.
    if ((frame.current++ & 1) === 0) {
      trail.copyWithin(0, 3)
      trail[TRAIL * 3 - 3] = p.x
      trail[TRAIL * 3 - 2] = p.y
      trail[TRAIL * 3 - 1] = 0
    }
  }, HZ)

  useFrame(() => {
    const p = s.current
    particle.current?.position.set(p.x, p.y, 0)
    writeLine(trailRef.current, trail)
    velPts[0] = p.x
    velPts[1] = p.y
    // Long enough that the dashes clear the charge sphere.
    velPts[3] = p.x + p.vx * 1.2
    velPts[4] = p.y + p.vy * 1.2
    writeLine(velRef.current, velPts)
  })

  // Field glyphs: violet E arrows along y, grey dots for B coming out of the screen.
  const arrows = useMemo(() => {
    const out: { x: number; y: number }[] = []
    for (let i = -4; i <= 4; i += 2)
      for (let j = -2; j <= 2; j += 2) out.push({ x: i, y: j })
    return out
  }, [])
  const len = v.electric * 1.1

  return (
    <group>
      {arrows.map((a, i) => (
        <group key={i} position={[a.x + 1, a.y + 0.6, -0.6]}>
          {Math.abs(len) > 0.02 && (
            <>
              <Line
                points={[
                  [0, -len / 2, 0],
                  [0, len / 2, 0],
                ]}
                color={palette.tertiary}
                lineWidth={1.5}
                transparent
                opacity={0.8}
              />
              <mesh
                position={[0, len / 2, 0]}
                rotation={[0, 0, len < 0 ? Math.PI : 0]}
              >
                <coneGeometry args={[0.08, 0.2, 12]} />
                <meshBasicMaterial
                  color={palette.tertiary}
                  transparent
                  opacity={0.8}
                />
              </mesh>
            </>
          )}
          <mesh position={[-1, -0.6, 0]}>
            <circleGeometry args={[0.04 + v.magnetic * 0.025, 16]} />
            <meshBasicMaterial color={palette.guide} />
          </mesh>
        </group>
      ))}
      <Line
        ref={trailRef}
        points={initial}
        color={palette.subject}
        lineWidth={2.5}
        frustumCulled={false}
      />
      <Line
        ref={velRef}
        points={[
          [START_X, 0, 0],
          [START_X, 0, 0],
        ]}
        color={palette.velocity}
        lineWidth={2.5}
        dashed
        dashSize={0.1}
        gapSize={0.07}
        frustumCulled={false}
      />
      <mesh ref={particle} position={[START_X, 0, 0]}>
        <sphereGeometry args={[0.17, 24, 24]} />
        <meshStandardMaterial
          color={palette.moving}
          emissive={palette.moving}
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 0, 10], target: [0, 0, 0] },
  grid: false,
  params: [
    {
      key: "electric",
      label: "Electric field E (↑)",
      min: -0.8,
      max: 0.8,
      step: 0.05,
      value: 0.35,
      digits: 2,
    },
    {
      key: "magnetic",
      label: "Magnetic field B (out of screen)",
      min: 0.1,
      max: 2.6,
      step: 0.1,
      value: 1.4,
    },
    {
      key: "speed",
      label: "Initial speed",
      min: 0.3,
      max: 1.8,
      step: 0.1,
      value: 0.9,
    },
    {
      key: "method",
      label: "Integrator",
      type: "select",
      value: "boris",
      options: [
        { value: "boris", label: "Boris push" },
        { value: "rk4", label: "RK4" },
        { value: "euler", label: "Explicit Euler" },
      ],
    },
  ],
  readout: (v) =>
    `r_L ≈ ${larmorRadius(v.speed, v.magnetic, 1).toFixed(2)} · period ${cyclotronPeriod(v.magnetic, 1).toFixed(2)} · E×B drift ${exbDriftSpeed(v.electric, v.magnetic).toFixed(2)} → x`,
  Scene,
})
