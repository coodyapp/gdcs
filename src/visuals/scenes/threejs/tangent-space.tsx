import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Line } from "@react-three/drei"
import * as THREE from "three"

import { bitangentFrom, tangentToWorld, type V3 } from "@/lib/tangent-space"

import { deg, defineVisual, palette, useClock } from "../../kit"

type V = { normalMap: boolean; strength: number }

const SIZE = 6.6
const SEGMENTS = 50
/** A frame every STRIDE vertices, offset so no frame sits on the patch edge. */
const STRIDE = 10
const TEXTURE = 256

const T_LEN = 0.72
const B_LEN = 0.72
const N_LEN = 0.6
const P_LEN = 1
const LIFT = 0.015

const TAU = Math.PI * 2

const surfaceY = (x: number, z: number) =>
  1.25 * Math.cos(x * 0.34) * Math.cos(z * 0.34) - 0.45

/**
 * Unit tangent-space normal of a tiling procedural bump: the gradient of a sum
 * of sines with whole-number frequencies. Same function fills the texture and
 * places the red arrows, so the arrows show what the shader samples.
 */
function bump(u: number, v: number): V3 {
  const a = TAU * 11 * u
  const b = TAU * 7 * v
  const c = TAU * (5 * u + 13 * v)
  const d = TAU * (16 * u - 4 * v)
  const dhdu =
    11 * Math.cos(a) * Math.cos(b) + 5 * Math.cos(c) + 8 * Math.cos(d)
  const dhdv =
    -7 * Math.sin(a) * Math.sin(b) + 13 * Math.cos(c) - 2 * Math.cos(d)
  const x = -dhdu * 0.022
  const y = -dhdv * 0.022
  const len = Math.hypot(x, y, 1)
  return [x / len, y / len, 1 / len]
}

function makeNormalMap() {
  const data = new Uint8Array(TEXTURE * TEXTURE * 4)
  for (let j = 0; j < TEXTURE; j++) {
    for (let i = 0; i < TEXTURE; i++) {
      const [x, y, z] = bump((i + 0.5) / TEXTURE, (j + 0.5) / TEXTURE)
      const o = (j * TEXTURE + i) * 4
      data[o] = (x * 0.5 + 0.5) * 255
      data[o + 1] = (y * 0.5 + 0.5) * 255
      data[o + 2] = (z * 0.5 + 0.5) * 255
      data[o + 3] = 255
    }
  }
  const texture = new THREE.DataTexture(data, TEXTURE, TEXTURE)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

interface Frame {
  p: V3
  t: V3
  b: V3
  n: V3
  sample: V3
}

function makeSurface() {
  const geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS)
  geometry.rotateX(-Math.PI / 2) // +U = +X, +V = −Z, normal = +Y
  const pos = geometry.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++)
    pos.setY(i, surfaceY(pos.getX(i), pos.getZ(i)))
  geometry.computeVertexNormals()
  geometry.computeTangents() // indexed, with position, normal and uv

  // Frames read the attributes the renderer uses, not a parallel calculation.
  const nor = geometry.attributes.normal as THREE.BufferAttribute
  const tan = geometry.attributes.tangent as THREE.BufferAttribute
  const uv = geometry.attributes.uv as THREE.BufferAttribute
  const frames: Frame[] = []
  const row = SEGMENTS + 1
  for (let j = STRIDE / 2; j < row; j += STRIDE) {
    for (let i = STRIDE / 2; i < row; i += STRIDE) {
      const k = j * row + i
      const n: V3 = [nor.getX(k), nor.getY(k), nor.getZ(k)]
      const t: V3 = [tan.getX(k), tan.getY(k), tan.getZ(k)]
      frames.push({
        p: [
          pos.getX(k) + n[0] * LIFT,
          pos.getY(k) + n[1] * LIFT,
          pos.getZ(k) + n[2] * LIFT,
        ],
        t,
        b: bitangentFrom(n, t, tan.getW(k)),
        n,
        sample: bump(uv.getX(k), uv.getY(k)),
      })
    }
  }
  return { geometry, frames }
}

/** Flat [from, to] pairs for <Line segments>, one per frame. */
function axisSegments(frames: Frame[], axis: "t" | "b" | "n", length: number) {
  const out: number[] = []
  for (const f of frames) {
    const d = f[axis]
    out.push(...f.p)
    out.push(
      f.p[0] + d[0] * length,
      f.p[1] + d[1] * length,
      f.p[2] + d[2] * length
    )
  }
  return out
}

function Scene({ v }: { v: V }) {
  const { geometry, frames } = useMemo(makeSurface, [])
  const normalMap = useMemo(makeNormalMap, [])
  const axes = useMemo(
    () => ({
      t: axisSegments(frames, "t", T_LEN),
      b: axisSegments(frames, "b", B_LEN),
      n: axisSegments(frames, "n", N_LEN),
    }),
    [frames]
  )

  // normalScale mirrors the shader: mapN.xy *= normalScale, then normalize.
  const strength = v.normalMap ? v.strength : 0
  const perturbed = useMemo(() => {
    const out: number[] = []
    for (const f of frames) {
      const [x, y, z] = f.sample
      const d = tangentToWorld([x * strength, y * strength, z], f.t, f.b, f.n)
      out.push(...f.p)
      out.push(
        f.p[0] + d[0] * P_LEN,
        f.p[1] + d[1] * P_LEN,
        f.p[2] + d[2] * P_LEN
      )
    }
    return out
  }, [frames, strength])

  useEffect(
    () => () => {
      geometry.dispose()
      normalMap.dispose()
    },
    [geometry, normalMap]
  )

  // A slow sway: the detail stays glued on while the world-space normals turn.
  const time = useClock()
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    if (group.current)
      group.current.rotation.y = 0.25 * Math.sin(time.current * 0.5)
  })

  return (
    <>
      {/* Low, raking light: relief only reads when N·L varies a lot. */}
      <directionalLight position={[-6, 2.2, -3]} intensity={5} />
      <group ref={group}>
        <mesh geometry={geometry}>
          {/* Strength 0 keeps the same shader program when toggling off. */}
          <meshStandardMaterial
            color={palette.surface}
            roughness={0.6}
            metalness={0.05}
            normalMap={normalMap}
            normalScale={[strength, strength]}
          />
        </mesh>
        <Line
          segments
          points={axes.t}
          color={palette.subject}
          lineWidth={2.2}
        />
        <Line
          segments
          dashed
          dashSize={0.13}
          gapSize={0.08}
          points={axes.b}
          color={palette.moving}
          lineWidth={2.2}
        />
        <Line
          segments
          points={axes.n}
          color={palette.success}
          lineWidth={2.2}
        />
        {v.normalMap && (
          <Line
            segments
            points={perturbed}
            color={palette.error}
            lineWidth={3}
          />
        )}
      </group>
    </>
  )
}

/** Largest xy/z among the frame samples, for the readout's tilt in degrees. */
const MAX_SLOPE = (() => {
  let max = 0
  for (let j = STRIDE / 2; j <= SEGMENTS; j += STRIDE) {
    for (let i = STRIDE / 2; i <= SEGMENTS; i += STRIDE) {
      const [x, y, z] = bump(i / SEGMENTS, 1 - j / SEGMENTS)
      max = Math.max(max, Math.hypot(x, y) / z)
    }
  }
  return max
})()

export default defineVisual<V>({
  camera: { position: [0, 7.3, 6.9], target: [0, 0.1, 0.5] },
  grid: false,
  params: [
    { key: "normalMap", label: "Normal map", type: "toggle", value: true },
    {
      key: "strength",
      label: "Perturbation strength",
      min: 0,
      max: 2,
      step: 0.05,
      value: 1,
      digits: 2,
    },
  ],
  readout: (v) =>
    v.normalMap
      ? `Lit normal tilts up to ${deg(Math.atan(v.strength * MAX_SLOPE)).toFixed(0)}° from N. Geometry unchanged.`
      : "Normal map off: lit normal = N, surface shades smooth.",
  Scene,
})
