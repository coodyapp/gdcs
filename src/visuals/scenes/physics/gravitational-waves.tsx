import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { PHYSICS_CONSTANTS } from "@/lib/physics/constants"
import { GravitationalWavesService } from "@/lib/physics/gravitational-waves.service"

import { clamp, defineVisual, palette, useClock } from "../../kit"

type V = { frequency: number; strain: number; m1: number; m2: number }

const SIZE = 10
const RES = 56 // 57² ≈ 3.2k vertices, updated on the CPU each frame
const SEPARATION = 2.4
const WELL = 0.18
const MIN_R = 0.45
const WAVELENGTH = 2.6
const MAX_VISUAL_ORBIT_HZ = 0.6 // playback cap so the orbit never aliases
const REFERENCE_DISTANCE_M = 100e6 * 3.085677581491367e16 // 100 Mpc

function Scene({ v }: { v: V }) {
  const time = useClock()
  const body1 = useRef<THREE.Mesh>(null)
  const body2 = useRef<THREE.Mesh>(null)
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, RES, RES)
    geo.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array((RES + 1) ** 2 * 3), 3)
    )
    return geo
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  const ramp = useMemo(
    () => ({
      // Sequential ramp: dim grey troughs → bright cyan crests (lightness carries the sign).
      trough: new THREE.Color(palette.surface),
      crest: new THREE.Color(palette.subject),
    }),
    []
  )

  useFrame(() => {
    const fVis = Math.min(MAX_VISUAL_ORBIT_HZ, v.frequency)
    const phase = 2 * Math.PI * fVis * time.current
    const total = v.m1 + v.m2
    // Barycentric orbit: each body sits at r_i = a·m_other/(m1+m2).
    const r1 = (SEPARATION * v.m2) / total
    const r2 = (SEPARATION * v.m1) / total
    const c = Math.cos(phase)
    const s = Math.sin(phase)
    const x1 = r1 * c
    const z1 = r1 * s
    const x2 = -r2 * c
    const z2 = -r2 * s
    const k = (2 * Math.PI) / WAVELENGTH
    const amp = 0.22 * v.strain

    const pos = geometry.attributes.position.array as Float32Array
    const col = geometry.attributes.color.array as Float32Array
    const { trough, crest } = ramp
    for (let i = 0, j = 0; i < pos.length; i += 3, j++) {
      const x = pos[i]
      const z = -pos[i + 1] // plane is rotated −90° about X: local +Y → world −Z
      const d1 = Math.hypot(x - x1, z - z1)
      const d2 = Math.hypot(x - x2, z - z2)
      const well =
        -WELL * (v.m1 / Math.max(d1, MIN_R) + v.m2 / Math.max(d2, MIN_R))
      // Quadrupole radiation: twice the orbital phase, spiralling outward, h ∝ 1/r far away.
      const r = Math.hypot(x, z)
      const envelope = clamp((r - 0.8) / 1.4) * (2 / Math.max(r, 2))
      const h = Math.cos(2 * phase - 2 * Math.atan2(z, x) - k * r) * envelope
      pos[i + 2] = well + amp * h
      const t = 0.5 + 0.5 * h
      col[j * 3] = trough.r + (crest.r - trough.r) * t
      col[j * 3 + 1] = trough.g + (crest.g - trough.g) * t
      col[j * 3 + 2] = trough.b + (crest.b - trough.b) * t
    }
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.color.needsUpdate = true

    const depth1 = -WELL * (v.m1 / MIN_R + v.m2 / Math.max(SEPARATION, MIN_R))
    const depth2 = -WELL * (v.m2 / MIN_R + v.m1 / Math.max(SEPARATION, MIN_R))
    body1.current?.position.set(x1, depth1 + 0.25, z1)
    body2.current?.position.set(x2, depth2 + 0.25, z2)
  })

  const size1 = 0.14 + 0.06 * Math.cbrt(v.m1)
  const size2 = 0.14 + 0.06 * Math.cbrt(v.m2)
  return (
    <group>
      <mesh
        geometry={geometry}
        rotation={[-Math.PI / 2, 0, 0]}
        frustumCulled={false}
      >
        <meshBasicMaterial vertexColors wireframe transparent opacity={0.75} />
      </mesh>
      <mesh ref={body1}>
        <sphereGeometry args={[size1, 24, 24]} />
        <meshStandardMaterial
          color={palette.moving}
          emissive={palette.moving}
          emissiveIntensity={0.5}
        />
      </mesh>
      <mesh ref={body2}>
        <sphereGeometry args={[size2, 24, 24]} />
        <meshStandardMaterial
          color={palette.tertiary}
          emissive={palette.tertiary}
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  )
}

const MSUN = PHYSICS_CONSTANTS.M_sun

export default defineVisual<V>({
  gridY: 0,
  camera: { position: [0, 7.2, 8.8], target: [0, -0.7, 0] },
  params: [
    {
      key: "frequency",
      label: "Orbital frequency",
      min: 0.1,
      max: 10,
      step: 0.1,
      value: 1,
      unit: "Hz",
      digits: 1,
    },
    {
      key: "strain",
      label: "Visual strain scale",
      min: 0.1,
      max: 5,
      step: 0.1,
      value: 1.6,
      digits: 1,
    },
    {
      key: "m1",
      label: "Mass 1",
      min: 0.5,
      max: 10,
      step: 0.1,
      value: 1.4,
      unit: "M☉",
      digits: 1,
    },
    {
      key: "m2",
      label: "Mass 2",
      min: 0.5,
      max: 10,
      step: 0.1,
      value: 1.4,
      unit: "M☉",
      digits: 1,
    },
  ],
  readout: (v) => {
    const m1 = v.m1 * MSUN
    const m2 = v.m2 * MSUN
    const fGW = 2 * v.frequency
    const h = GravitationalWavesService.calculateStrainAmplitude(
      m1,
      m2,
      REFERENCE_DISTANCE_M,
      fGW
    )
    const mc = (v.m1 * v.m2) ** 0.6 / (v.m1 + v.m2) ** 0.2
    const a = Math.cbrt(
      (PHYSICS_CONSTANTS.G * (m1 + m2)) / (2 * Math.PI * v.frequency) ** 2
    )
    return `f_GW ${fGW.toFixed(1)} Hz · chirp mass ${mc.toFixed(2)} M☉ · separation ${(a / 1000).toFixed(0)} km · h ≈ ${h.toExponential(1)} at 100 Mpc`
  },
  Scene,
})
