import { useEffect, useMemo, useRef } from "react"
import type { ComponentRef } from "react"
import { Line } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import type * as THREE from "three"

import { PHYSICS_CONSTANTS } from "@/lib/physics/constants"
import {
  FIXED_TIME_STEP,
  SIM_C,
  SIM_SEMI_MAJOR_AXIS as A,
  calculateOrbitalPeriod,
  calculateOrbitalVelocity,
  calculatePrecessionPerOrbit,
  calculateRealPrecessionPerOrbit,
  stepOrbitInPlace,
} from "@/lib/physics/mercury"

import { defineVisual, deg, palette, useFixedStep, useVisual } from "../../kit"

type V = {
  mass: number
  eccentricity: number
  speed: number
  relativity: boolean
}
type LineRef = ComponentRef<typeof Line>

const MSUN = PHYSICS_CONSTANTS.M_sun
const S = 0.42 // sim units → world units
const TRAIL = 720
const SAMPLES_PER_ORBIT = 160 // trail covers the last ~4.5 orbits

/** Sim (x, y) in the orbital plane → world (x, 0, −y), seen from above. */
const wx = (x: number) => x * S
const wz = (y: number) => -y * S

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const M = v.mass * MSUN
  const state = useMemo(() => new Float64Array(6), [])
  const trail = useMemo(() => new Float32Array(TRAIL * 3), [])
  const seg = useRef({
    count: 0,
    elapsed: 0,
    prev: 0,
    prev2: 0,
    px: 1,
    py: 0,
    dirty: true,
  })
  const trailRef = useRef<LineRef>(null)
  const periRef = useRef<LineRef>(null)
  const planet = useRef<THREE.Mesh>(null)
  const sampleEvery = calculateOrbitalPeriod(M, A) / SAMPLES_PER_ORBIT

  // Start at perihelion on +x with the vis-viva speed; restart on Reset or new orbit inputs.
  useEffect(() => {
    const r0 = A * (1 - v.eccentricity)
    state.set([r0, 0, 0, 0, calculateOrbitalVelocity(M, r0, A), 0])
    Object.assign(seg.current, {
      count: 0,
      elapsed: 0,
      prev: r0,
      prev2: Infinity,
      px: r0,
      py: 0,
      dirty: true,
    })
  }, [M, v.eccentricity, resetKey, state])

  // `speed` sim seconds per real second, integrated with a fixed RK4 step.
  useFixedStep(() => {
    const g = seg.current
    const substeps = Math.round(v.speed)
    for (let n = 0; n < substeps; n++) {
      const x = state[0]
      const y = state[1]
      stepOrbitInPlace(state, M, v.relativity, FIXED_TIME_STEP)
      const r = Math.hypot(state[0], state[1])
      // Perihelion = local minimum of r (the previous sample).
      if (g.prev < g.prev2 && g.prev < r) {
        g.px = x
        g.py = y
      }
      g.prev2 = g.prev
      g.prev = r
      g.elapsed += FIXED_TIME_STEP
      if (g.elapsed >= sampleEvery) {
        g.elapsed -= sampleEvery
        if (g.count === TRAIL) trail.copyWithin(0, 3)
        else g.count++
        const k = (g.count - 1) * 3
        trail[k] = wx(state[0])
        trail[k + 1] = 0
        trail[k + 2] = wz(state[1])
      }
    }
    g.dirty = true
  }, 120)

  const initial = useMemo(
    () =>
      Array.from(
        { length: TRAIL },
        () => [wx(A), 0, 0] as [number, number, number]
      ),
    []
  )
  const reference = useMemo(() => {
    const e = v.eccentricity
    const p = A * (1 - e * e)
    return Array.from({ length: 181 }, (_, i) => {
      const th = (i / 180) * Math.PI * 2
      const r = p / (1 + e * Math.cos(th))
      return [wx(r * Math.cos(th)), -0.01, wz(r * Math.sin(th))] as [
        number,
        number,
        number,
      ]
    })
  }, [v.eccentricity])

  useFrame(() => {
    const g = seg.current
    planet.current?.position.set(wx(state[0]), 0, wz(state[1]))
    if (!g.dirty) return
    g.dirty = false
    const line = trailRef.current
    if (line && g.count > 0) {
      const attr = line.geometry.getAttribute(
        "instanceStart"
      ) as THREE.InterleavedBufferAttribute
      const out = attr.data.array as Float32Array
      const last = (g.count - 1) * 3
      for (let i = 0; i < TRAIL - 1; i++) {
        const a = Math.min(i * 3, last)
        const b = Math.min(i * 3 + 3, last)
        out[i * 6] = trail[a]
        out[i * 6 + 1] = trail[a + 1]
        out[i * 6 + 2] = trail[a + 2]
        out[i * 6 + 3] = trail[b]
        out[i * 6 + 4] = trail[b + 1]
        out[i * 6 + 5] = trail[b + 2]
      }
      attr.data.needsUpdate = true
    }
    const peri = periRef.current
    if (peri) {
      const attr = peri.geometry.getAttribute(
        "instanceStart"
      ) as THREE.InterleavedBufferAttribute
      const out = attr.data.array as Float32Array
      out[3] = wx(g.px)
      out[4] = 0.02
      out[5] = wz(g.py)
      attr.data.needsUpdate = true
    }
  })

  return (
    <group>
      <Line
        points={reference}
        color={palette.guide}
        lineWidth={1}
        dashed
        dashSize={0.15}
        gapSize={0.12}
      />
      <Line
        points={[
          [0, -0.01, 0],
          [wx(A * (1 - v.eccentricity)), -0.01, 0],
        ]}
        color={palette.guide}
        lineWidth={1.5}
      />
      <Line
        ref={trailRef}
        points={initial}
        color={palette.subject}
        lineWidth={2}
        transparent
        opacity={0.85}
        frustumCulled={false}
      />
      <Line
        ref={periRef}
        points={[
          [0, 0.02, 0],
          [wx(A), 0.02, 0],
        ]}
        color={palette.tertiary}
        lineWidth={2.5}
        frustumCulled={false}
      />
      <mesh>
        <sphereGeometry args={[0.32, 32, 32]} />
        <meshStandardMaterial
          color={palette.foreground}
          emissive={palette.foreground}
          emissiveIntensity={0.6}
        />
      </mesh>
      <mesh ref={planet}>
        <sphereGeometry args={[0.14, 20, 20]} />
        <meshStandardMaterial
          color={palette.moving}
          emissive={palette.moving}
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  )
}

const MERCURY_A = 5.791e10 // m
const ORBITS_PER_CENTURY = 415

export default defineVisual<V>({
  camera: { position: [-0.6, 9.6, 2.6], target: [-0.6, 0, 0.1] },
  params: [
    {
      key: "mass",
      label: "Star mass",
      min: 0.5,
      max: 3,
      step: 0.1,
      value: 1.5,
      unit: "M☉",
      digits: 1,
    },
    {
      key: "eccentricity",
      label: "Eccentricity",
      min: 0,
      max: 0.7,
      step: 0.01,
      value: 0.206,
      digits: 3,
    },
    {
      key: "speed",
      label: "Time scale",
      min: 1,
      max: 200,
      step: 1,
      value: 120,
      unit: "×",
      digits: 0,
    },
    {
      key: "relativity",
      label: "General relativity",
      type: "toggle",
      value: true,
    },
  ],
  readout: (v) => {
    const M = v.mass * MSUN
    const sim = deg(calculatePrecessionPerOrbit(M, A, v.eccentricity))
    const rp = A * (1 - v.eccentricity)
    const beta = calculateOrbitalVelocity(M, rp, A) / SIM_C
    const real =
      calculateRealPrecessionPerOrbit(MSUN, MERCURY_A, 0.206) *
      (180 / Math.PI) *
      3600 *
      ORBITS_PER_CENTURY
    return `${v.relativity ? `Δω ${sim.toFixed(2)}°/orbit` : "Classical: orbit closes"} · v/c at perihelion ${beta.toFixed(3)} · real Mercury ${real.toFixed(1)}″/century`
  },
  Scene,
})
