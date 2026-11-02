import { useEffect, useMemo, useRef, type ComponentRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import { createFdtd, resetFdtd, stepFdtd } from "@/lib/physics/fdtd"

import { defineVisual, palette, useFixedStep, useVisual } from "../../kit"

type V = { frequency: number; amplitude: number; courant: number; slab: number }

const N = 220
const X0 = -5.5
const DX = 11 / (N - 1)
const SOURCE = 12
const SLAB_FROM = 130
const SLAB_TO = 175
/** Grid time units (cells of light travel) per real second: ≈ 5.5 scene units/s. */
const CELLS_PER_SECOND = 110
const STEM_EVERY = 6
const STEMS = Math.floor(N / STEM_EVERY)
const HEIGHT = 1.25

type LineRef = ComponentRef<typeof Line>

function writeLine(line: LineRef | null, xyz: Float32Array) {
  if (!line) return
  const attr = line.geometry.attributes
    .instanceStart as THREE.InterleavedBufferAttribute
  const seg = attr.data.array as Float32Array
  for (let i = 0; i < xyz.length / 3 - 1; i++) {
    for (let c = 0; c < 6; c++) seg[i * 6 + c] = xyz[i * 3 + c]
  }
  attr.data.needsUpdate = true
}

function writeSegments(line: LineRef | null, xyz: Float32Array) {
  if (!line) return
  const attr = line.geometry.attributes
    .instanceStart as THREE.InterleavedBufferAttribute
  ;(attr.data.array as Float32Array).set(xyz)
  attr.data.needsUpdate = true
}

/** Clamp for display so an unstable run shows spikes instead of NaN. */
const show = (x: number) =>
  Number.isFinite(x) ? Math.max(-2.2, Math.min(2.2, x)) : 0

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const grid = useMemo(() => createFdtd(N), [])
  const acc = useRef(0)
  const eRef = useRef<LineRef>(null)
  const hRef = useRef<LineRef>(null)
  const eStems = useRef<LineRef>(null)
  const hStems = useRef<LineRef>(null)
  const ePts = useMemo(() => new Float32Array(N * 3), [])
  const hPts = useMemo(() => new Float32Array((N - 1) * 3), [])
  const eSeg = useMemo(() => new Float32Array(STEMS * 6), [])
  const hSeg = useMemo(() => new Float32Array(STEMS * 6), [])
  const flatE = useMemo(
    () =>
      Array.from(
        { length: N },
        (_, i) => [X0 + i * DX, 0, 0] as [number, number, number]
      ),
    []
  )
  const flatH = useMemo(() => flatE.slice(0, N - 1), [flatE])
  const flatStems = useMemo(
    () =>
      Array.from(
        { length: STEMS * 2 },
        () => [X0, 0, 0] as [number, number, number]
      ),
    []
  )

  // Permittivity profile: vacuum, then a dielectric slab.
  useEffect(() => {
    for (let i = 0; i < N; i++)
      grid.eps[i] = i >= SLAB_FROM && i < SLAB_TO ? v.slab : 1
  }, [grid, v.slab])

  useEffect(() => {
    resetFdtd(grid)
    acc.current = 0
  }, [grid, resetKey, v.courant])

  const params = useRef(v)
  params.current = v
  // Soft sinusoidal source with a smooth 2-period turn-on (no start-up spike).
  const source = useMemo(
    () => (t: number) => {
      const { frequency, amplitude } = params.current
      const f = frequency / CELLS_PER_SECOND // cycles per grid time unit
      const ramp = Math.min(1, (t * f) / 2)
      // A soft source radiates s·sin(πf)/(2 sin(πfS)) each way; invert that so
      // the travelling wave has the requested amplitude for any S.
      const S = params.current.courant
      const s =
        (2 * amplitude * Math.sin(Math.PI * f * S)) / Math.sin(Math.PI * f)
      return s * ramp * ramp * Math.sin(2 * Math.PI * f * t)
    },
    []
  )

  useFixedStep((dt) => {
    acc.current += dt * CELLS_PER_SECOND
    const S = params.current.courant
    while (acc.current >= S) {
      stepFdtd(grid, S, SOURCE, source)
      acc.current -= S
    }
  }, 60)

  useFrame(() => {
    for (let i = 0; i < N; i++) {
      ePts[i * 3] = X0 + i * DX
      ePts[i * 3 + 1] = show(grid.ey[i] * HEIGHT)
      ePts[i * 3 + 2] = 0
    }
    for (let i = 0; i < N - 1; i++) {
      // Hz lives half a cell to the right of Ey.
      hPts[i * 3] = X0 + (i + 0.5) * DX
      hPts[i * 3 + 1] = 0
      hPts[i * 3 + 2] = show(grid.hz[i] * HEIGHT)
    }
    for (let k = 0; k < STEMS; k++) {
      const i = k * STEM_EVERY
      const x = X0 + i * DX
      eSeg[k * 6] = x
      eSeg[k * 6 + 1] = 0
      eSeg[k * 6 + 2] = 0
      eSeg[k * 6 + 3] = x
      eSeg[k * 6 + 4] = ePts[i * 3 + 1]
      eSeg[k * 6 + 5] = 0
      hSeg[k * 6] = hPts[i * 3]
      hSeg[k * 6 + 1] = 0
      hSeg[k * 6 + 2] = 0
      hSeg[k * 6 + 3] = hPts[i * 3]
      hSeg[k * 6 + 4] = 0
      hSeg[k * 6 + 5] = hPts[i * 3 + 2]
    }
    writeLine(eRef.current, ePts)
    writeLine(hRef.current, hPts)
    writeSegments(eStems.current, eSeg)
    writeSegments(hStems.current, hSeg)
  })

  const slabWidth = (SLAB_TO - SLAB_FROM) * DX
  const slabX = X0 + ((SLAB_FROM + SLAB_TO) / 2) * DX

  return (
    <group>
      {v.slab > 1.01 && (
        <mesh position={[slabX, 0, 0]}>
          <boxGeometry args={[slabWidth, 2.4, 2.4]} />
          <meshStandardMaterial
            color={palette.object}
            transparent
            opacity={0.12 + 0.06 * (v.slab - 1)}
            depthWrite={false}
          />
        </mesh>
      )}
      <Line
        points={[
          [X0, 0, 0],
          [-X0, 0, 0],
        ]}
        color={palette.guide}
        lineWidth={1}
      />
      <mesh position={[X0 + SOURCE * DX, 0, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial
          color={palette.energy}
          emissive={palette.energy}
          emissiveIntensity={0.5}
        />
      </mesh>
      <Line
        ref={eStems}
        segments
        points={flatStems}
        color={palette.subject}
        lineWidth={1}
        transparent
        opacity={0.45}
        frustumCulled={false}
      />
      <Line
        ref={hStems}
        segments
        points={flatStems}
        color={palette.tertiary}
        lineWidth={1}
        transparent
        opacity={0.45}
        frustumCulled={false}
      />
      <Line
        ref={eRef}
        points={flatE}
        color={palette.subject}
        lineWidth={3}
        frustumCulled={false}
      />
      <Line
        ref={hRef}
        points={flatH}
        color={palette.tertiary}
        lineWidth={3}
        frustumCulled={false}
      />
    </group>
  )
}

export default defineVisual<V>({
  gridY: 0,
  camera: { position: [5.2, 3.4, 7.6], target: [0, 0, 0] },
  params: [
    {
      key: "frequency",
      label: "Source frequency",
      min: 0.5,
      max: 5,
      step: 0.1,
      value: 2.2,
      unit: " Hz",
    },
    {
      key: "amplitude",
      label: "Field amplitude",
      min: 0.4,
      max: 1,
      step: 0.01,
      value: 0.92,
    },
    {
      key: "courant",
      label: "Courant number S = cΔt/Δx",
      min: 0.3,
      max: 1.1,
      step: 0.01,
      value: 0.9,
      digits: 2,
    },
    {
      key: "slab",
      label: "Slab permittivity εr",
      min: 1,
      max: 4,
      step: 0.1,
      value: 2.5,
    },
  ],
  readout: (v) => {
    const lambda = (CELLS_PER_SECOND * DX) / v.frequency
    const stable = v.courant <= 1 ? "stable" : "UNSTABLE (S > 1)"
    return `λ ≈ ${lambda.toFixed(2)} u in vacuum, ${(lambda / Math.sqrt(v.slab)).toFixed(2)} u in slab · S = ${v.courant.toFixed(2)} ${stable}`
  },
  Scene,
})
