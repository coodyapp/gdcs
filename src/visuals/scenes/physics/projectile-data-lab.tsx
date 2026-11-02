import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import {
  G_EARTH,
  histogram,
  projectileSamples,
  sampleStats,
} from "@/lib/physics/mechanics-labs"

import { defineVisual, palette, rad, useClock } from "../../kit"

type V = { angle: number; speed: number; spread: number; runs: number }

const X0 = -4.4
const WIDTH = 8.8
const PEAK = 2.6
const BINS = 10
const HIST_Z = -0.8

type P = [number, number, number]

function Scene({ v }: { v: V }) {
  const time = useClock()
  const balls = useRef<THREE.Group>(null)
  const a = rad(v.angle)
  const data = useMemo(() => {
    const samples = projectileSamples(v.angle, v.speed, v.spread, v.runs)
    const stats = sampleStats(samples)
    const domainMax = stats.max + Math.max(1, (stats.max - stats.min) * 0.12)
    const toX = (r: number) => X0 + (r / domainMax) * WIDTH
    // One vertical scale for all arcs, so faster launches really fly higher.
    const vMax = v.speed * (1 + v.spread / 100)
    const yScale = PEAK / Math.max(1, (vMax * Math.sin(a)) ** 2 / (2 * G_EARTH))
    const speeds = [
      v.speed * (1 - v.spread / 100),
      v.speed,
      v.speed * (1 + v.spread / 100),
    ]
    const arcs = speeds.map((s) => {
      const T = (2 * s * Math.sin(a)) / G_EARTH
      return Array.from({ length: 65 }, (_, i) => {
        const t = (i / 64) * T
        const x = s * Math.cos(a) * t
        const y = s * Math.sin(a) * t - 0.5 * G_EARTH * t * t
        return [toX(x), Math.max(0, y * yScale), 0] as P
      })
    })
    const counts = histogram(samples, BINS, stats.min, stats.max)
    const maxCount = Math.max(1, ...counts)
    const x0 = toX(stats.min)
    const binW = (toX(stats.max) - x0) / BINS
    const ideal = (v.speed ** 2 * Math.sin(2 * a)) / G_EARTH
    return { samples, stats, toX, arcs, counts, maxCount, x0, binW, ideal }
  }, [a, v.angle, v.runs, v.speed, v.spread])

  // Replay the launches one after another along the centre arc.
  useFrame(() => {
    const g = balls.current
    if (!g) return
    const arc = data.arcs[1]
    const f = (time.current * 0.6) % 1
    const i = Math.min(arc.length - 1, Math.floor(f * (arc.length - 1)))
    g.position.set(arc[i][0], arc[i][1], arc[i][2])
  })

  const { stats, toX, arcs, counts, maxCount, x0, binW, ideal } = data
  return (
    <>
      <mesh position={[0, -0.06, -0.2]}>
        <boxGeometry args={[10, 0.12, 2.4]} />
        <meshStandardMaterial color={palette.surface} />
      </mesh>
      {arcs.map((pts, i) => (
        <Line
          key={i}
          points={pts}
          color={i === 1 ? palette.subject : palette.guide}
          lineWidth={i === 1 ? 2.5 : 1}
        />
      ))}
      <group ref={balls}>
        <mesh>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial
            color={palette.foreground}
            emissive={palette.foreground}
            emissiveIntensity={0.2}
          />
        </mesh>
      </group>
      {data.samples.map((r, i) => (
        <mesh key={i} position={[toX(r), 0.08, ((i % 5) - 2) * 0.14]}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshStandardMaterial
            color={palette.moving}
            emissive={palette.moving}
            emissiveIntensity={0.4}
          />
        </mesh>
      ))}
      {counts.map((c, i) => {
        const h = Math.max(0.03, (c / maxCount) * 1.2)
        return (
          <mesh key={i} position={[x0 + (i + 0.5) * binW, h / 2, HIST_Z]}>
            <boxGeometry args={[Math.max(0.02, binW * 0.85), h, 0.2]} />
            <meshStandardMaterial color={palette.tertiary} />
          </mesh>
        )
      })}
      <Line
        points={[
          [toX(stats.mean), 0, 0.5],
          [toX(stats.mean), 2.3, 0.5],
        ]}
        color={palette.moving}
        lineWidth={3}
      />
      <Line
        points={[
          [toX(ideal), 0, 0.55],
          [toX(ideal), 1.9, 0.55],
        ]}
        color={palette.success}
        lineWidth={2}
        dashed
        dashSize={0.1}
        gapSize={0.07}
      />
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 4.6, 8.4], target: [0, 0.9, 0] },
  grid: false,
  params: [
    {
      key: "angle",
      label: "Launch angle",
      min: 10,
      max: 80,
      step: 1,
      value: 45,
      unit: "°",
    },
    {
      key: "speed",
      label: "Mean speed",
      min: 10,
      max: 40,
      step: 1,
      value: 24,
      unit: "m/s",
    },
    {
      key: "spread",
      label: "Speed error (±)",
      min: 0,
      max: 25,
      step: 1,
      value: 12,
      unit: "%",
    },
    {
      key: "runs",
      label: "Trials",
      min: 10,
      max: 40,
      step: 10,
      value: 30,
    },
  ],
  readout: (v) => {
    const s = sampleStats(projectileSamples(v.angle, v.speed, v.spread, v.runs))
    const ideal = (v.speed ** 2 * Math.sin(2 * rad(v.angle))) / G_EARTH
    return `Mean ${s.mean.toFixed(1)} m · ideal ${ideal.toFixed(1)} m · σ ${s.std.toFixed(1)} m · spread ${s.min.toFixed(0)}–${s.max.toFixed(0)} m`
  },
  Scene,
})
