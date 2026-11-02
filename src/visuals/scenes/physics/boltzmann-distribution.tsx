import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import {
  energyDensity,
  meanThermalEnergy,
  metropolisSweep,
} from "@/lib/physics/metropolis"
import { mulberry32 } from "@/lib/physics/seeded-random"

import { defineVisual, palette, useFixedStep, useVisual } from "../../kit"

type V = { temperature: number; power: number }

const WALKERS = 1500
const SHOWN = 400
const BINS = 48
const E_MAX = 9
const X0 = -4.5
const WIDTH = 9
const PEAK_HEIGHT = 3
const BIN_W = E_MAX / BINS
const toX = (e: number) => X0 + (e / E_MAX) * WIDTH

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const energies = useMemo(() => new Float32Array(WALKERS), [])
  const hist = useMemo(() => new Float32Array(BINS), [])
  const random = useMemo(() => ({ next: mulberry32(1) }), [])
  const bars = useRef<THREE.InstancedMesh>(null)
  const dots = useRef<THREE.InstancedMesh>(null)
  const mean = useRef<THREE.Mesh>(null)
  const matrix = useMemo(() => new THREE.Matrix4(), [])

  // Normalise the display so the theory curve's peak is always PEAK_HEIGHT tall.
  const curve = useMemo(() => {
    const pts: [number, number, number][] = []
    let peak = 0
    for (let i = 0; i <= 160; i++) {
      const e = Math.max(1e-3, (i / 160) * E_MAX)
      peak = Math.max(peak, energyDensity(e, v.temperature, v.power))
    }
    const scale = PEAK_HEIGHT / peak
    for (let i = 0; i <= 160; i++) {
      const e = Math.max(1e-3, (i / 160) * E_MAX)
      pts.push([
        toX(e),
        Math.min(
          PEAK_HEIGHT * 1.15,
          energyDensity(e, v.temperature, v.power) * scale
        ),
        0.3,
      ])
    }
    return { pts, scale }
  }, [v.temperature, v.power])

  // Everyone starts at one low energy: watch the spike relax to equilibrium.
  useEffect(() => {
    energies.fill(0.05)
    hist.fill(0)
    random.next = mulberry32(1)
  }, [energies, hist, random, resetKey, v.temperature, v.power])

  useFixedStep(() => {
    metropolisSweep(
      energies,
      v.temperature,
      v.power,
      Math.max(0.3, v.temperature),
      random.next
    )
    // Exponential moving average of the normalised histogram (smooths noise).
    for (let b = 0; b < BINS; b++) hist[b] *= 0.9
    const w = 0.1 / (WALKERS * BIN_W)
    for (let i = 0; i < WALKERS; i++) {
      const b = Math.floor(energies[i] / BIN_W)
      if (b < BINS) hist[b] += w
    }
  }, 30)

  useFrame(() => {
    const scale = curve.scale
    if (bars.current) {
      for (let b = 0; b < BINS; b++) {
        const h = Math.max(0.001, Math.min(PEAK_HEIGHT * 1.2, hist[b] * scale))
        matrix.makeScale(BIN_W * (WIDTH / E_MAX) * 0.86, h, 0.5)
        matrix.setPosition(toX((b + 0.5) * BIN_W), h / 2, 0)
        bars.current.setMatrixAt(b, matrix)
      }
      bars.current.instanceMatrix.needsUpdate = true
    }
    if (dots.current) {
      let sum = 0
      for (let i = 0; i < WALKERS; i++) sum += energies[i]
      for (let i = 0; i < SHOWN; i++) {
        const e = energies[i]
        // Walkers as a strip of dots in front of the axis (z jitter by index).
        matrix.makeTranslation(
          e < E_MAX ? toX(e) : 1e4,
          -0.25,
          0.9 + ((i * 37) % 23) / 23
        )
        dots.current.setMatrixAt(i, matrix)
      }
      dots.current.instanceMatrix.needsUpdate = true
      if (mean.current)
        mean.current.position.x = toX(Math.min(E_MAX, sum / WALKERS))
    }
  })

  const theoryMean = toX(
    Math.min(E_MAX, meanThermalEnergy(v.temperature, v.power))
  )

  return (
    <group>
      <Line
        points={[
          [X0 - 0.2, 0, 0],
          [X0 + WIDTH + 0.2, 0, 0],
        ]}
        color={palette.guide}
        lineWidth={1.4}
      />
      <Line
        points={[
          [X0, 0, 0],
          [X0, PEAK_HEIGHT + 0.5, 0],
        ]}
        color={palette.guide}
        lineWidth={1.4}
      />
      <instancedMesh
        ref={bars}
        args={[undefined, undefined, BINS]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={palette.subject}
          transparent
          opacity={0.85}
        />
      </instancedMesh>
      <Line points={curve.pts} color={palette.foreground} lineWidth={2.5} />
      <Line
        points={[
          [theoryMean, 0, 0.35],
          [theoryMean, PEAK_HEIGHT + 0.3, 0.35],
        ]}
        color={palette.energy}
        lineWidth={2}
        dashed
        dashSize={0.15}
        gapSize={0.1}
      />
      <mesh ref={mean} position={[theoryMean, PEAK_HEIGHT + 0.3, 0.35]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color={palette.energy} />
      </mesh>
      <instancedMesh
        ref={dots}
        args={[undefined, undefined, SHOWN]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshBasicMaterial color={palette.subject} />
      </instancedMesh>
    </group>
  )
}

export default defineVisual<V>({
  camera: { position: [0.4, 2.6, 9.4], target: [0, 1.3, 0] },
  params: [
    {
      key: "temperature",
      label: "Temperature kT",
      min: 0.3,
      max: 3,
      step: 0.1,
      value: 1.2,
    },
    {
      key: "power",
      label: "Density of states g(E) ∝ E^p",
      min: 0,
      max: 1.5,
      step: 0.1,
      value: 0.5,
    },
  ],
  readout: (v) =>
    `⟨E⟩ = (p+1)kT = ${meanThermalEnergy(v.temperature, v.power).toFixed(2)} · most likely E = ${(v.power * v.temperature).toFixed(2)} · p = 0.5 is a 3D gas (³⁄₂kT)`,
  Scene,
})
