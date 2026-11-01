import { useEffect, useMemo } from "react"
import { Line } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { clamp, defineVisual, palette, useClock } from "../../kit"

type V = { spread: number; potential: number; phase: boolean }

const RES = 56 // 3136 vertices: comfortably 60 fps with per-frame CPU updates
const SIZE = 7.2
const HALF = SIZE / 2
const BARRIER_X = 1.25
const BARRIER_R = 0.82
const CYCLE = 9

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

/** Indexed RES×RES grid in the XZ plane with position and colour buffers. */
function makeSurface() {
  const positions = new Float32Array(RES * RES * 3)
  const colors = new Float32Array(RES * RES * 3)
  const indices = new Uint16Array((RES - 1) * (RES - 1) * 6)
  const step = SIZE / (RES - 1)
  let o = 0
  for (let row = 0; row < RES; row++) {
    for (let col = 0; col < RES; col++) {
      const i = (row * RES + col) * 3
      positions[i] = -HALF + col * step
      positions[i + 2] = -HALF + row * step
      if (row < RES - 1 && col < RES - 1) {
        const a = row * RES + col
        indices[o++] = a
        indices[o++] = a + RES
        indices[o++] = a + 1
        indices[o++] = a + 1
        indices[o++] = a + RES
        indices[o++] = a + RES + 1
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3))
  return { geometry, positions, colors }
}

function Scene({ v }: { v: V }) {
  const time = useClock(0.35)
  const surface = useMemo(makeSurface, [])
  useEffect(() => () => surface.geometry.dispose(), [surface])
  // Phase colour ramp endpoints (linear RGB), pre-allocated.
  const ramp = useMemo(
    () => ({
      a: new THREE.Color(palette.primary),
      b: new THREE.Color(palette.tertiary),
      low: new THREE.Color(palette.surface),
    }),
    []
  )

  useFrame(() => {
    const t = time.current
    const cycle = t % CYCLE
    const center = -3.15 + cycle * 0.86
    const encounter = smoothstep(BARRIER_X - 1.05, BARRIER_X + 0.35, center)
    const T = clamp(Math.exp(-v.potential * 0.68), 0.12, 1)
    const R = 1 - T
    // Free-packet dispersion: the width grows with time since launch.
    const sigma = (0.34 + v.spread * 4.5) * (1 + cycle * 0.055)
    const inv2s2 = 1 / (2 * sigma * sigma)
    const reflected = BARRIER_X - (center - BARRIER_X) * 0.72
    const dip = clamp(v.potential * 0.26)
    const { positions: p, colors: c } = surface
    const { a, b, low } = ramp
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i]
      const z = p[i + 2]
      const edge =
        smoothstep(0, 0.55, HALF - Math.abs(x)) *
        smoothstep(0, 0.55, HALF - Math.abs(z))
      const fwd = Math.exp(-((x - center) ** 2 + z * z) * inv2s2)
      const back = Math.exp(-((x - reflected) ** 2 + z * z) * inv2s2)
      const bx = x - BARRIER_X
      const barrier = Math.exp(-(bx * bx + z * z) / (BARRIER_R * BARRIER_R))
      const rho =
        clamp(
          ((1 - encounter) * fwd + encounter * (R * back + T * fwd)) * edge
        ) *
        (1 - dip * barrier)
      const phase =
        7.2 * x -
        t * 4.6 +
        encounter * R * Math.atan2(z, bx) +
        v.potential * barrier
      p[i + 1] = rho * 1.7
      // Brightness = |ψ|², hue = arg ψ (cyan ↔ violet), so wavefronts stay visible.
      const mixPhase = v.phase ? 0.5 + 0.5 * Math.cos(phase) : 0
      const lit = clamp(0.05 + rho * 1.4)
      c[i] = low.r + (a.r + (b.r - a.r) * mixPhase - low.r) * lit
      c[i + 1] = low.g + (a.g + (b.g - a.g) * mixPhase - low.g) * lit
      c[i + 2] = low.b + (a.b + (b.b - a.b) * mixPhase - low.b) * lit
    }
    surface.geometry.attributes.position.needsUpdate = true
    surface.geometry.attributes.color.needsUpdate = true
  })

  const boundary = useMemo(
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
  const ring = useMemo(
    () =>
      Array.from({ length: 73 }, (_, i) => {
        const ang = (i / 72) * Math.PI * 2
        return [
          BARRIER_X + Math.cos(ang) * BARRIER_R,
          0.04,
          Math.sin(ang) * BARRIER_R,
        ] as [number, number, number]
      }),
    []
  )

  return (
    <group>
      <mesh geometry={surface.geometry} frustumCulled={false}>
        <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
      </mesh>
      <Line points={boundary} color={palette.guide} lineWidth={1.5} />
      <mesh position={[BARRIER_X, (0.12 + v.potential * 0.12) / 2, 0]}>
        <cylinderGeometry
          args={[BARRIER_R, BARRIER_R, 0.12 + v.potential * 0.12, 48]}
        />
        <meshStandardMaterial
          color={palette.negative}
          transparent
          opacity={0.3}
        />
      </mesh>
      <Line points={ring} color={palette.negative} lineWidth={1.8} />
    </group>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 7.4, 8.6], target: [0, 0, 0.3] },
  grid: false,
  params: [
    {
      key: "spread",
      label: "Initial spread",
      min: 0.025,
      max: 0.12,
      step: 0.005,
      value: 0.07,
      digits: 3,
    },
    {
      key: "potential",
      label: "Potential strength",
      min: 0,
      max: 2,
      step: 0.1,
      value: 1.1,
      digits: 1,
    },
    { key: "phase", label: "Colour by phase", type: "toggle", value: true },
  ],
  readout: (v) => {
    const T = Math.min(1, Math.max(0.12, Math.exp(-v.potential * 0.68)))
    return `Illustrative split · transmitted ${(T * 100).toFixed(0)}% · reflected ${((1 - T) * 100).toFixed(0)}%`
  },
  Scene,
})
