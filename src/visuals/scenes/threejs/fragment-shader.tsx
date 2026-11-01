import { useEffect, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { defineVisual, palette, useClock } from "../../kit"

type V = { effect: string; speed: number; scale: number }

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const header = /* glsl */ `
uniform float uTime;
uniform float uScale;
uniform vec3 uA;
uniform vec3 uB;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float valueNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
`

const bodies: Record<string, string> = {
  ripples: /* glsl */ `
void main() {
  vec2 p = (vUv - 0.5) * vec2(1.6, 1.0);
  float d = length(p);
  float rings = 0.5 + 0.5 * sin(d * 30.0 * uScale - uTime * 4.0);
  float fade = smoothstep(0.75, 0.1, d);
  gl_FragColor = vec4(mix(uA * 0.08, uA, rings * fade), 1.0);
}`,
  plasma: /* glsl */ `
void main() {
  vec2 p = (vUv - 0.5) * vec2(1.6, 1.0) * 6.0 * uScale;
  float t = uTime;
  float v = sin(p.x + t) + sin(p.y * 1.3 - t * 0.8)
          + sin(length(p + vec2(sin(t * 0.3), cos(t * 0.4)) * 3.0) - t);
  float k = 0.5 + 0.5 * sin(v * 1.6);
  gl_FragColor = vec4(mix(uA, uB, k), 1.0);
}`,
  dissolve: /* glsl */ `
void main() {
  float n = valueNoise(vUv * vec2(16.0, 10.0) * uScale);
  float cut = 0.5 + 0.48 * sin(uTime * 0.8);
  if (n < cut) discard;
  float edge = smoothstep(cut + 0.06, cut, n);
  vec3 base = mix(uA * 0.5, uA, vUv.y);
  gl_FragColor = vec4(mix(base, uB, edge), 1.0);
}`,
}

function Scene({ v }: { v: V }) {
  const time = useClock()
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScale: { value: 1 },
      uA: { value: new THREE.Color(palette.primary) },
      uB: { value: new THREE.Color(palette.secondary) },
    }),
    []
  )
  // One material per effect; switching swaps programs, the uniforms are shared.
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        // colorspace_fragment converts our linear colour to the canvas output space.
        fragmentShader:
          header +
          bodies[v.effect].replace(
            /}\s*$/,
            "  #include <colorspace_fragment>\n}"
          ),
        side: THREE.DoubleSide,
      }),
    [uniforms, v.effect]
  )
  useEffect(() => () => material.dispose(), [material])

  useFrame(() => {
    uniforms.uTime.value = (time.current * v.speed) % 1000
    uniforms.uScale.value = v.scale
  })

  return (
    <>
      <mesh material={material}>
        <planeGeometry args={[7.2, 4.5, 1, 1]} />
      </mesh>
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[7.32, 4.62]} />
        <meshBasicMaterial color={palette.surface} />
      </mesh>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 0, 6.4], target: [0, 0, 0] },
  grid: false,
  params: [
    {
      key: "effect",
      label: "Fragment program",
      type: "select",
      value: "ripples",
      options: [
        { value: "ripples", label: "Ripples" },
        { value: "plasma", label: "Plasma" },
        { value: "dissolve", label: "Dissolve" },
      ],
    },
    {
      key: "speed",
      label: "Time speed (uTime ×)",
      min: 0,
      max: 3,
      step: 0.05,
      value: 1,
      digits: 2,
    },
    {
      key: "scale",
      label: "Pattern scale",
      min: 0.3,
      max: 3,
      step: 0.05,
      value: 1,
      digits: 2,
    },
  ],
  readout: (v) =>
    `${v.effect}: 1 draw call, 2 triangles · a full-screen pass at 1920×1080 runs this ~2.07 M times per frame`,
  Scene,
})
