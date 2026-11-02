import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import {
  fourierNumber,
  heatStep,
  maxStableDt,
} from "@/lib/physics/heat-diffusion"

import { defineVisual, palette, useFixedStep, useVisual } from "../../kit"

type V = { diffusivity: number; power: number; stepRatio: number }

const N = 49
const SIZE = 7.2
const HALF = SIZE / 2
const DX = SIZE / (N - 1)
const HEATER_RADIUS = 0.42
/** Simulated seconds per real second. */
const SIM_SPEED = 2
const HEIGHT = 1.4

// Cold → hot ramp from the shared palette with rising lightness (inferno-like:
// dark → violet → orange → yellow), so it reads without hue. Height repeats it.
const RAMP = [
  palette.surface,
  palette.tertiary,
  palette.energy,
  palette.warning,
].map((c) => new THREE.Color(c))
const COLD_NEGATIVE = new THREE.Color(palette.error)

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const buffers = useMemo(
    () => [new Float32Array(N * N), new Float32Array(N * N)],
    []
  )
  const current = useRef(0)
  const acc = useRef(0)
  const fixed = useMemo(() => new Float32Array(N * N), [])

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(SIZE, SIZE, N - 1, N - 1)
    g.rotateX(-Math.PI / 2)
    g.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(N * N * 3), 3)
    )
    return g
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])

  // Heater disc: cells held at T = power (Dirichlet), everything else free.
  useEffect(() => {
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = -HALF + i * DX
        const z = -HALF + j * DX
        fixed[j * N + i] = Math.hypot(x, z) <= HEATER_RADIUS ? v.power : -1
      }
    }
  }, [fixed, v.power])

  useEffect(() => {
    buffers[0].fill(0)
    buffers[1].fill(0)
    acc.current = 0
  }, [buffers, resetKey, v.diffusivity, v.stepRatio])

  useFixedStep((dt) => {
    const dtSim = v.stepRatio * maxStableDt(v.diffusivity, DX)
    const r = fourierNumber(v.diffusivity, dtSim, DX)
    acc.current += dt * SIM_SPEED
    let guard = 0
    while (acc.current >= dtSim && guard++ < 50) {
      const a = buffers[current.current]
      const b = buffers[1 - current.current]
      heatStep(a, b, N, r, fixed)
      current.current = 1 - current.current
      acc.current -= dtSim
    }
  }, 60)

  useFrame(() => {
    const T = buffers[current.current]
    const pos = geometry.attributes.position as THREE.BufferAttribute
    const col = geometry.attributes.color as THREE.BufferAttribute
    const p = pos.array as Float32Array
    const c = col.array as Float32Array
    // PlaneGeometry rows run from -z to +z after the rotation, matching j.
    for (let k = 0; k < N * N; k++) {
      let t = T[k]
      if (!Number.isFinite(t)) t = 0
      const h = Math.max(-0.8, Math.min(1.6, t))
      p[k * 3 + 1] = h * HEIGHT
      if (t < -0.02) {
        // Negative temperature: only an unstable explicit step can produce it.
        c[k * 3] = COLD_NEGATIVE.r
        c[k * 3 + 1] = COLD_NEGATIVE.g
        c[k * 3 + 2] = COLD_NEGATIVE.b
        continue
      }
      const s = Math.min(1, Math.max(0, t)) * (RAMP.length - 1)
      const i = Math.min(RAMP.length - 2, Math.floor(s))
      const f = s - i
      const a = RAMP[i]
      const b = RAMP[i + 1]
      c[k * 3] = a.r + (b.r - a.r) * f
      c[k * 3 + 1] = a.g + (b.g - a.g) * f
      c[k * 3 + 2] = a.b + (b.b - a.b) * f
    }
    pos.needsUpdate = true
    col.needsUpdate = true
    geometry.computeVertexNormals()
  })

  const border = useMemo(
    () =>
      [
        [-HALF, 0.02, -HALF],
        [HALF, 0.02, -HALF],
        [HALF, 0.02, HALF],
        [-HALF, 0.02, HALF],
        [-HALF, 0.02, -HALF],
      ] as [number, number, number][],
    []
  )

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          vertexColors
          side={THREE.DoubleSide}
          roughness={0.85}
        />
      </mesh>
      <mesh position={[0, -0.08, 0]}>
        <boxGeometry args={[SIZE + 0.2, 0.12, SIZE + 0.2]} />
        <meshStandardMaterial color={palette.object} />
      </mesh>
      <Line points={border} color={palette.guide} lineWidth={1.5} />
      <mesh position={[0, -0.25, 0]}>
        <cylinderGeometry args={[HEATER_RADIUS, HEATER_RADIUS, 0.2, 32]} />
        <meshStandardMaterial
          color={palette.energy}
          emissive={palette.energy}
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  )
}

export default defineVisual<V>({
  gridY: -0.02,
  camera: { position: [0, 7.4, 8.6], target: [0, 0, 0.3] },
  params: [
    {
      key: "diffusivity",
      label: "Diffusivity α",
      min: 0.04,
      max: 0.24,
      step: 0.01,
      value: 0.18,
      unit: " u²/s",
    },
    {
      key: "power",
      label: "Heater temperature",
      min: 0.1,
      max: 1,
      step: 0.05,
      value: 0.9,
    },
    {
      key: "stepRatio",
      label: "Δt / Δt_max",
      min: 0.2,
      max: 1.2,
      step: 0.05,
      value: 0.8,
      digits: 2,
    },
  ],
  readout: (v) => {
    const dtMax = maxStableDt(v.diffusivity, DX)
    const r = 0.25 * v.stepRatio
    return `Δt_max = Δx²/4α = ${(dtMax * 1000).toFixed(1)} ms · r = αΔt/Δx² = ${r.toFixed(3)} ${r <= 0.25 ? "≤ ¼ stable" : "> ¼ UNSTABLE"}`
  },
  Scene,
})
