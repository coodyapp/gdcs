import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import { traceAllLines, type PointCharge } from "@/lib/physics/electric-field"

import { defineVisual, palette, useClock } from "../../kit"

type V = { separation: number; charge: number; density: number }

const DOTS_PER_LINE = 3
const MAX_DOTS = 64 * DOTS_PER_LINE
/** Scene units per second that the flow markers travel along a line. */
const FLOW_SPEED = 0.9

function chargeColor(q: number) {
  if (Math.abs(q) < 1e-6) return palette.object
  return q > 0 ? palette.primary : palette.negative
}

function Scene({ v }: { v: V }) {
  const time = useClock()
  const dots = useRef<THREE.InstancedMesh>(null)
  const matrix = useMemo(() => new THREE.Matrix4(), [])

  const charges = useMemo<PointCharge[]>(
    () => [
      { x: -v.separation * 1.8, y: 0, q: 1 },
      { x: v.separation * 1.8, y: 0, q: v.charge },
    ],
    [v.separation, v.charge]
  )

  // Field lines plus cumulative arc length per vertex, for the flow markers.
  const lines = useMemo(() => {
    const active = charges.filter((c) => Math.abs(c.q) > 1e-6)
    return traceAllLines(active, v.density, { maxSteps: 110 })
      .slice(0, 64)
      .map(({ seed, points }) => {
        const count = points.length / 3
        const arc = new Float32Array(count)
        for (let i = 1; i < count; i++) {
          arc[i] =
            arc[i - 1] +
            Math.hypot(
              points[i * 3] - points[i * 3 - 3],
              points[i * 3 + 1] - points[i * 3 - 2]
            )
        }
        const tuples: [number, number, number][] = []
        for (let i = 0; i < count; i++)
          tuples.push([points[i * 3], points[i * 3 + 1], 0])
        return {
          q: active[seed].q,
          points,
          tuples,
          arc,
          length: arc[count - 1],
        }
      })
  }, [charges, v.density])

  useEffect(() => {
    if (dots.current)
      dots.current.count = Math.min(MAX_DOTS, lines.length * DOTS_PER_LINE)
  }, [lines])

  useFrame(() => {
    const mesh = dots.current
    if (!mesh) return
    let d = 0
    for (const line of lines) {
      if (line.length < 0.2) continue
      for (let k = 0; k < DOTS_PER_LINE && d < MAX_DOTS; k++) {
        // Markers move along the line's own direction (away from + or toward −).
        let s =
          (time.current * FLOW_SPEED + (k / DOTS_PER_LINE) * line.length) %
          line.length
        if (line.q < 0) s = line.length - s
        let i = 1
        while (i < line.arc.length - 1 && line.arc[i] < s) i++
        const seg = line.arc[i] - line.arc[i - 1] || 1
        const f = (s - line.arc[i - 1]) / seg
        const p = line.points
        matrix.makeTranslation(
          p[i * 3 - 3] + (p[i * 3] - p[i * 3 - 3]) * f,
          p[i * 3 - 2] + (p[i * 3 + 1] - p[i * 3 - 2]) * f,
          0.02
        )
        mesh.setMatrixAt(d++, matrix)
      }
    }
    mesh.count = d
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      {lines.map((line, i) => (
        <Line
          key={i}
          points={line.tuples}
          color={palette.warning}
          lineWidth={1.4}
          transparent
          opacity={0.75}
        />
      ))}
      <instancedMesh
        ref={dots}
        args={[undefined, undefined, MAX_DOTS]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.065, 10, 10]} />
        <meshBasicMaterial color={palette.secondary} />
      </instancedMesh>
      {charges.map((c, i) => (
        <mesh key={i} position={[c.x, c.y, 0]}>
          <sphereGeometry
            args={[0.18 + 0.1 * Math.min(2, Math.abs(c.q)), 32, 32]}
          />
          <meshStandardMaterial
            color={chargeColor(c.q)}
            emissive={chargeColor(c.q)}
            emissiveIntensity={0.35}
          />
        </mesh>
      ))}
    </group>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 0, 10.5], target: [0, 0, 0] },
  grid: false,
  params: [
    {
      key: "separation",
      label: "Charge spacing",
      min: 0.4,
      max: 1.8,
      step: 0.1,
      value: 1.2,
    },
    {
      key: "charge",
      label: "Right charge",
      min: -2,
      max: 2,
      step: 0.1,
      value: -1,
      unit: " q",
      digits: 1,
    },
    {
      key: "density",
      label: "Lines per unit charge",
      min: 6,
      max: 20,
      step: 1,
      value: 12,
    },
  ],
  readout: (v) => {
    const d = v.separation * 3.6
    const kind =
      Math.abs(v.charge) < 0.05
        ? "single charge"
        : v.charge < 0
          ? v.charge === -1
            ? "dipole"
            : "unequal opposite charges"
          : "like charges (null point between)"
    // Field at the midpoint from both charges (k = 1).
    const mid = 1 / (d / 2) ** 2 - v.charge / (d / 2) ** 2
    return `${kind} · distance ${d.toFixed(2)} · |E| at midpoint ${Math.abs(mid).toFixed(2)} kq/u²`
  },
  Scene,
})
