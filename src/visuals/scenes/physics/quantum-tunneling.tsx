import { useMemo, useRef } from "react"
import type { ComponentRef } from "react"
import { Line } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import type * as THREE from "three"

import { clamp, defineVisual, palette, useClock } from "../../kit"

type V = { width: number; height: number; energy: number }
type LineRef = ComponentRef<typeof Line>

const SAMPLES = 220
const LEFT = -4.5
const RIGHT = 4.5
const BARRIER_X = 0.6
const START = -3.6
const TRAVEL = 8.4
/** Gaussian packet: exp(−(x−x0)²/WIDTH²). */
const WIDTH2 = 0.55
const AMP = 1.3

/**
 * Exact transmission through a rectangular barrier (ħ = m = 1):
 * E < V: T = 1 / (1 + V² sinh²(κa) / (4E(V−E))), κ = √(2(V−E))
 * E > V: same with sinh → sin and κ → k = √(2(E−V)); E = V is the a²-limit.
 */
function transmission(energy: number, height: number, width: number) {
  const E = Math.max(energy, 1e-6)
  const V = Math.max(height, 1e-6)
  if (Math.abs(E - V) < 1e-6) return 1 / (1 + (V * width * width) / 2)
  if (E < V) {
    const kappa = Math.sqrt(2 * (V - E))
    return 1 / (1 + (V * V * Math.sinh(kappa * width) ** 2) / (4 * E * (V - E)))
  }
  const k = Math.sqrt(2 * (E - V))
  return 1 / (1 + (V * V * Math.sin(k * width) ** 2) / (4 * E * (E - V)))
}

function writeLine(line: LineRef | null, xyz: Float32Array) {
  if (!line) return
  const attr = line.geometry.getAttribute(
    "instanceStart"
  ) as THREE.InterleavedBufferAttribute
  const seg = attr.data.array as Float32Array
  for (let i = 0; i < xyz.length / 3 - 1; i++) {
    for (let j = 0; j < 6; j++) seg[i * 6 + j] = xyz[i * 3 + j]
  }
  attr.data.needsUpdate = true
}

function Scene({ v }: { v: V }) {
  const time = useClock()
  const lineRef = useRef<LineRef>(null)
  const xyz = useMemo(() => new Float32Array(SAMPLES * 3), [])
  const initial = useMemo(
    () =>
      Array.from(
        { length: SAMPLES },
        (_, i) =>
          [LEFT + (i / (SAMPLES - 1)) * (RIGHT - LEFT), 0, 0] as [
            number,
            number,
            number,
          ]
      ),
    []
  )
  const T = transmission(v.energy, v.height, v.width)
  const face = BARRIER_X - v.width / 2

  useFrame(() => {
    // Group velocity of a free packet is v = ħk/m = √(2E) (scaled for display).
    const speed = 0.5 * Math.sqrt(2 * v.energy)
    const center = START + ((time.current * speed) % TRAVEL)
    // Split smoothly as the packet meets the left face of the barrier.
    const split = clamp((center - (face - 0.7)) / 0.9)
    const s = split * split * (3 - 2 * split)
    const mirror = 2 * face - center
    for (let i = 0; i < SAMPLES; i++) {
      const x = LEFT + (i / (SAMPLES - 1)) * (RIGHT - LEFT)
      const forward = Math.exp(-((x - center) ** 2) / WIDTH2) * (1 - s + s * T)
      const back =
        x < face ? Math.exp(-((x - mirror) ** 2) / WIDTH2) * s * (1 - T) : 0
      xyz[i * 3] = x
      xyz[i * 3 + 1] = v.energy + (forward + back) * AMP
      xyz[i * 3 + 2] = 0.05
    }
    writeLine(lineRef.current, xyz)
  })

  return (
    <group>
      <mesh position={[BARRIER_X, v.height / 2, 0]}>
        <boxGeometry args={[v.width, v.height, 1.4]} />
        <meshStandardMaterial
          color={palette.negative}
          transparent
          opacity={0.4}
        />
      </mesh>
      <Line
        points={[
          [LEFT, 0, 0],
          [RIGHT, 0, 0],
        ]}
        color={palette.guide}
        lineWidth={1}
      />
      <Line
        points={[
          [face - 0.5, v.energy, 0.75],
          [face + v.width + 0.5, v.energy, 0.75],
        ]}
        color={palette.warning}
        lineWidth={1.5}
        dashed
        dashSize={0.18}
        gapSize={0.12}
      />
      <Line
        ref={lineRef}
        points={initial}
        color={palette.primary}
        lineWidth={3}
        frustumCulled={false}
      />
    </group>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 1.9, 9.6], target: [0, 1.3, 0] },
  grid: false,
  params: [
    {
      key: "width",
      label: "Barrier width a",
      min: 0.2,
      max: 1.6,
      step: 0.1,
      value: 0.7,
      digits: 1,
    },
    {
      key: "height",
      label: "Barrier height V",
      min: 0.2,
      max: 2.8,
      step: 0.1,
      value: 1.4,
      digits: 1,
    },
    {
      key: "energy",
      label: "Packet energy E",
      min: 0.4,
      max: 2.2,
      step: 0.1,
      value: 1.1,
      digits: 1,
    },
  ],
  readout: (v) => {
    const T = transmission(v.energy, v.height, v.width)
    return `${v.energy < v.height ? "Tunneling (E < V)" : "Over the barrier (E ≥ V)"} · T = ${(T * 100).toFixed(1)}% · R = ${((1 - T) * 100).toFixed(1)}%`
  },
  Scene,
})
