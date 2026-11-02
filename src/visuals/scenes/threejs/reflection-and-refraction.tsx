import { Line } from "@react-three/drei"

import { criticalAngle, fresnel, snell } from "@/lib/optics"

import {
  deg,
  defineVisual,
  palette,
  rad,
  useAnimationTime,
  type Vec3,
} from "../../kit"

type V = { auto: boolean; angle: number; n1: number; n2: number }

const L = 3.4
const W = 9.5
const H = 3.4

const ray = (theta: number, up: boolean, sideSign: number, len = L): Vec3 => [
  sideSign * Math.sin(theta) * len,
  (up ? 1 : -1) * Math.cos(theta) * len,
  0,
]

/** Arc from the normal (up or down) to angle theta, on one side. */
function arc(theta: number, up: boolean, side: number, r: number): Vec3[] {
  const n = Math.max(2, Math.ceil(theta / 0.05))
  return Array.from({ length: n + 1 }, (_, i) =>
    ray((theta * i) / n, up, side, r)
  )
}

/** Medium slab: denser medium = more opaque. */
function Medium({ n, up }: { n: number; up: boolean }) {
  return (
    <mesh position={[0, (up ? 1 : -1) * (H / 2), -0.2]}>
      <planeGeometry args={[W, H]} />
      <meshBasicMaterial
        color={palette.object}
        transparent
        opacity={0.06 + ((n - 1) / 1.4) * 0.4}
      />
    </mesh>
  )
}

function Scene({ v }: { v: V }) {
  const time = useAnimationTime(0.5)
  const theta = v.auto
    ? rad(44 + 41 * Math.sin(time - Math.PI / 2))
    : rad(v.angle)
  const theta2 = snell(theta, v.n1, v.n2)
  const tir = theta2 === null
  const F = fresnel(theta, v.n1, v.n2)
  const crit = criticalAngle(v.n1, v.n2)

  const inc = ray(theta, true, -1)
  const incDir = Math.atan2(-inc[1], -inc[0]) // direction of travel
  const refl = ray(theta, true, 1)
  const refr = theta2 === null ? null : ray(theta2, false, 1)

  return (
    <group>
      <Medium n={v.n1} up />
      <Medium n={v.n2} up={false} />
      <Line
        points={[
          [-W / 2, 0, 0],
          [W / 2, 0, 0],
        ]}
        color={palette.guide}
        lineWidth={1}
      />
      {/* Surface normal */}
      <Line
        points={[
          [0, -H * 0.85, 0],
          [0, H * 0.85, 0],
        ]}
        color={palette.positive}
        lineWidth={2}
        dashed
        dashSize={0.18}
        gapSize={0.12}
      />
      {/* Critical-angle cone (only when going into a less dense medium) */}
      {crit !== null &&
        [-1, 1].map((s) => (
          <Line
            key={s}
            points={[[0, 0, 0], ray(crit, true, s, L * 0.9)]}
            color={palette.guide}
            lineWidth={1}
            dashed
            dashSize={0.08}
            gapSize={0.1}
          />
        ))}
      {/* Incident ray with arrowhead */}
      <Line points={[inc, [0, 0, 0]]} color={palette.subject} lineWidth={4} />
      <mesh
        position={[inc[0] * 0.45, inc[1] * 0.45, 0]}
        rotation={[0, 0, incDir - Math.PI / 2]}
      >
        <coneGeometry args={[0.13, 0.32, 16]} />
        <meshBasicMaterial color={palette.subject} />
      </mesh>
      {/* Reflected ray: brightness follows Fresnel F */}
      <Line
        points={[[0, 0, 0], refl]}
        color={palette.moving}
        lineWidth={1.5 + 3 * F}
        dashed
        dashSize={0.22}
        gapSize={0.12}
        transparent
        opacity={0.15 + 0.85 * F}
      />
      {/* Refracted ray: carries the rest, 1 − F */}
      {refr && (
        <Line
          points={[[0, 0, 0], refr]}
          color={palette.tertiary}
          lineWidth={1.5 + 3 * (1 - F)}
          transparent
          opacity={0.15 + 0.85 * (1 - F)}
        />
      )}
      {/* Angle arcs */}
      <Line
        points={arc(theta, true, -1, 0.9)}
        color={palette.subject}
        lineWidth={2}
      />
      {theta2 !== null && (
        <Line
          points={arc(theta2, false, 1, 0.9)}
          color={palette.tertiary}
          lineWidth={2}
        />
      )}
      <mesh>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color={tir ? palette.moving : palette.foreground} />
      </mesh>
    </group>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 0, 10.5], target: [0, 0, 0] },
  grid: false,
  orbit: false,
  params: [
    { key: "auto", label: "Auto sweep angle", type: "toggle", value: true },
    {
      key: "angle",
      label: "Angle of incidence θ₁",
      min: 0,
      max: 89,
      step: 1,
      value: 35,
      unit: "°",
    },
    {
      key: "n1",
      label: "Upper IOR n₁",
      min: 1,
      max: 2.42,
      step: 0.01,
      value: 1.5,
      digits: 2,
    },
    {
      key: "n2",
      label: "Lower IOR n₂",
      min: 1,
      max: 2.42,
      step: 0.01,
      value: 1,
      digits: 2,
    },
  ],
  readout: (v) => {
    const c = criticalAngle(v.n1, v.n2)
    const crit =
      c === null ? "no TIR (n₁ ≤ n₂)" : `critical ${deg(c).toFixed(1)}°`
    if (v.auto)
      return `${crit} · F at 0° = ${(fresnel(0, v.n1, v.n2) * 100).toFixed(1)}%`
    const t2 = snell(rad(v.angle), v.n1, v.n2)
    const F = fresnel(rad(v.angle), v.n1, v.n2)
    return `${crit} · θ₂ = ${t2 === null ? "TIR" : deg(t2).toFixed(1) + "°"} · reflected ${(F * 100).toFixed(1)}%`
  },
  Scene,
})
