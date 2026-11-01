import { useMemo, useRef } from "react"
import type { ComponentRef } from "react"
import { Line } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import type * as THREE from "three"

import { defineVisual, palette, useClock } from "../../kit"

type V = { mix: number; level: number; real: boolean }
type LineRef = ComponentRef<typeof Line>

const SAMPLES = 180
const HALF = 4 // box spans x ∈ [−4, 4] (L = 8 world units, 1 in model units)
const Y_SCALE = 1.1

/** Rewrites a drei <Line> in place from packed xyz points (no allocation). */
function writeLine(line: LineRef | null, xyz: Float32Array) {
  if (!line) return
  const attr = line.geometry.getAttribute(
    "instanceStart"
  ) as THREE.InterleavedBufferAttribute
  const seg = attr.data.array as Float32Array
  for (let i = 0; i < xyz.length / 3 - 1; i++) {
    seg[i * 6] = xyz[i * 3]
    seg[i * 6 + 1] = xyz[i * 3 + 1]
    seg[i * 6 + 2] = xyz[i * 3 + 2]
    seg[i * 6 + 3] = xyz[i * 3 + 3]
    seg[i * 6 + 4] = xyz[i * 3 + 4]
    seg[i * 6 + 5] = xyz[i * 3 + 5]
  }
  attr.data.needsUpdate = true
}

function Scene({ v }: { v: V }) {
  const time = useClock(0.7)
  const densityRef = useRef<LineRef>(null)
  const realRef = useRef<LineRef>(null)
  const marker = useRef<THREE.Mesh>(null)
  const density = useMemo(() => new Float32Array(SAMPLES * 3), [])
  const real = useMemo(() => new Float32Array(SAMPLES * 3), [])
  const initial = useMemo(
    () =>
      Array.from({ length: SAMPLES }, (_, i) => {
        const x = (i / (SAMPLES - 1)) * 2 * HALF - HALF
        return [x, 0, 0] as [number, number, number]
      }),
    []
  )

  useFrame(() => {
    // ψ(x,t) = a1·φ1(x)·e^{−iE1 t} + a2·φn(x)·e^{−iEn t}, with E_n = n² (units of E1, ħ = 1).
    const t = time.current
    const n = Math.round(v.level)
    const a1 = Math.sqrt(1 - v.mix)
    const a2 = Math.sqrt(v.mix)
    const c1 = Math.cos(t)
    const s1 = Math.sin(t)
    const cn = Math.cos(n * n * t)
    const sn = Math.sin(n * n * t)
    let mean = 0
    let norm = 0
    for (let i = 0; i < SAMPLES; i++) {
      const x = i / (SAMPLES - 1)
      const p1 = Math.SQRT2 * a1 * Math.sin(Math.PI * x)
      const pn = Math.SQRT2 * a2 * Math.sin(n * Math.PI * x)
      const re = p1 * c1 + pn * cn
      const im = -p1 * s1 - pn * sn
      const prob = re * re + im * im
      const wx = x * 2 * HALF - HALF
      density[i * 3] = wx
      density[i * 3 + 1] = prob * Y_SCALE
      real[i * 3] = wx
      real[i * 3 + 1] = 1.6 + re * 0.55
      real[i * 3 + 2] = -0.05
      mean += wx * prob
      norm += prob
    }
    writeLine(densityRef.current, density)
    if (v.real) writeLine(realRef.current, real)
    if (marker.current) marker.current.position.x = norm > 0 ? mean / norm : 0
  })

  return (
    <group>
      {[-HALF - 0.08, HALF + 0.08].map((x) => (
        <mesh key={x} position={[x, 1.7, 0]}>
          <boxGeometry args={[0.16, 3.4, 1.2]} />
          <meshStandardMaterial color={palette.object} />
        </mesh>
      ))}
      <Line
        points={[
          [-HALF, 0, 0],
          [HALF, 0, 0],
        ]}
        color={palette.guide}
        lineWidth={1}
      />
      <Line
        ref={densityRef}
        points={initial}
        color={palette.primary}
        lineWidth={3}
        frustumCulled={false}
      />
      {v.real && (
        <Line
          ref={realRef}
          points={initial}
          color={palette.secondary}
          lineWidth={1.5}
          frustumCulled={false}
        />
      )}
      <mesh ref={marker} position={[0, -0.12, 0]}>
        <coneGeometry args={[0.14, 0.28, 16]} />
        <meshStandardMaterial
          color={palette.warning}
          emissive={palette.warning}
          emissiveIntensity={0.4}
        />
      </mesh>
    </group>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 1.9, 9.6], target: [0, 1.4, 0] },
  grid: false,
  params: [
    {
      key: "mix",
      label: "Excited-state mix",
      min: 0,
      max: 0.95,
      step: 0.05,
      value: 0.45,
      digits: 2,
    },
    {
      key: "level",
      label: "Excited level n",
      min: 2,
      max: 6,
      step: 1,
      value: 2,
      digits: 0,
    },
    { key: "real", label: "Show Re ψ", type: "toggle", value: true },
  ],
  readout: (v) => {
    const n = Math.round(v.level)
    const beat = (2 * Math.PI) / (n * n - 1)
    return `E${n}/E1 = ${n * n} · beat period ${beat.toFixed(2)} ħ/E1 · ⟨E⟩ = ${(1 - v.mix + v.mix * n * n).toFixed(2)} E1`
  },
  Scene,
})
