import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import {
  createGas,
  idealPressure,
  rmsSpeed,
  stepGas,
} from "@/lib/physics/ideal-gas"

import { defineVisual, palette, useFixedStep, useVisual } from "../../kit"

type V = { count: number; temperature: number; width: number }

const MAX = 300
const HALF_Y = 1.6
const HALF_Z = 2
// Speed ramp with rising lightness (inferno-like): violet (slow) → orange → bright
// yellow (fast, velocity). Lerped in RGB so it never detours through green.
const SLOW = new THREE.Color(palette.tertiary)
const MID = new THREE.Color(palette.energy)
const FAST = new THREE.Color(palette.velocity)

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const mesh = useRef<THREE.InstancedMesh>(null)
  const piston = useRef<THREE.MeshStandardMaterial>(null)
  const half = useMemo<[number, number, number]>(
    () => [2.4, HALF_Y, HALF_Z],
    []
  )
  const gas = useMemo(
    () => ({ current: createGas(MAX, [2.4, HALF_Y, HALF_Z], 1) }),
    []
  )
  const matrix = useMemo(() => new THREE.Matrix4(), [])
  const color = useMemo(() => new THREE.Color(), [])
  const pressure = useRef(0)

  const width = useRef(v.width)
  width.current = v.width
  // Fresh, seeded gas on Reset (never per frame).
  useEffect(() => {
    gas.current = createGas(MAX, [width.current / 2, HALF_Y, HALF_Z], 1)
  }, [gas, resetKey])

  useFixedStep((dt) => {
    half[0] = v.width / 2
    const count = Math.round(v.count)
    // Wall impulse this step = pressure × wall area × dt, so this measures P.
    const impulse = stepGas(gas.current, count, dt, v.temperature, half)
    const area = 8 * (half[0] * HALF_Y + HALF_Y * HALF_Z + half[0] * HALF_Z)
    pressure.current = pressure.current * 0.97 + (impulse / (area * dt)) * 0.03
  }, 120)

  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const g = gas.current
    const count = Math.round(v.count)
    const vScale = Math.sqrt(v.temperature)
    for (let i = 0; i < count; i++) {
      matrix.makeTranslation(g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2])
      m.setMatrixAt(i, matrix)
      const speed =
        Math.hypot(g.vel[i * 3], g.vel[i * 3 + 1], g.vel[i * 3 + 2]) * vScale
      const s = Math.min(1, speed / 3.5) * 2
      if (s < 1) color.copy(SLOW).lerp(MID, s)
      else color.copy(MID).lerp(FAST, s - 1)
      m.setColorAt(i, color)
    }
    m.count = count
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    // Wall glow follows the measured momentum flux (pressure).
    if (piston.current)
      piston.current.emissiveIntensity = Math.min(0.9, pressure.current * 0.06)
  })

  const w = v.width
  const edges = useMemo(
    () =>
      new THREE.EdgesGeometry(new THREE.BoxGeometry(w, HALF_Y * 2, HALF_Z * 2)),
    [w]
  )
  useEffect(() => () => edges.dispose(), [edges])
  return (
    <group position={[0, HALF_Y + 0.05, 0]}>
      <mesh>
        <boxGeometry args={[w, HALF_Y * 2, HALF_Z * 2]} />
        <meshStandardMaterial
          color={palette.object}
          transparent
          opacity={0.1}
          depthWrite={false}
        />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={palette.guide} />
      </lineSegments>
      <mesh position={[0, -HALF_Y - 0.05, 0]}>
        <boxGeometry args={[w + 0.2, 0.1, HALF_Z * 2 + 0.2]} />
        <meshStandardMaterial color={palette.object} />
      </mesh>
      {/* Movable right wall (piston): drag "Box width" to change the volume. */}
      <mesh position={[w / 2 + 0.06, 0, 0]}>
        <boxGeometry args={[0.12, HALF_Y * 2, HALF_Z * 2]} />
        <meshStandardMaterial
          ref={piston}
          color={palette.object}
          emissive={palette.force}
          emissiveIntensity={0.2}
          transparent
          opacity={0.6}
          depthWrite={false}
        />
      </mesh>
      <instancedMesh
        ref={mesh}
        args={[undefined, undefined, MAX]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.075, 10, 10]} />
        <meshStandardMaterial />
      </instancedMesh>
    </group>
  )
}

export default defineVisual<V>({
  gridY: 0.05,
  camera: { position: [5.4, 4.6, 7.4], target: [0, 1.4, 0] },
  params: [
    {
      key: "count",
      label: "Particles N",
      min: 20,
      max: MAX,
      step: 1,
      value: 160,
      digits: 0,
    },
    {
      key: "temperature",
      label: "Temperature kT",
      min: 0.4,
      max: 2.4,
      step: 0.1,
      value: 1.1,
    },
    {
      key: "width",
      label: "Box width (volume)",
      min: 2.4,
      max: 5.6,
      step: 0.1,
      value: 4.8,
      unit: " u",
    },
  ],
  readout: (v) => {
    const V = v.width * HALF_Y * 2 * HALF_Z * 2
    return `V = ${V.toFixed(1)} u³ · P = NkT/V = ${idealPressure(Math.round(v.count), v.temperature, V).toFixed(2)} · v_rms = ${rmsSpeed(v.temperature).toFixed(2)} u/s`
  },
  Scene,
})
