import { useEffect, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { defineVisual, palette, useClock } from "../../kit"

type V = { count: number; size: number; trimmed: boolean }

const W = 8
const H = 5
const MAX = 96
/** Each shaded fragment adds 8/255 to the red channel: exact counts up to 31. */
const STEP = 8

const countVertex = /* glsl */ `
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }`
const countFragment = /* glsl */ `
  void main() { gl_FragColor = vec4(${STEP}.0 / 255.0, 0.0, 0.0, 1.0); }`

const heatVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`
const heatFragment = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 c0, c1, c2, c3, c4, c5;
  varying vec2 vUv;
  void main() {
    float n = floor(texture2D(map, vUv).r * 255.0 / ${STEP}.0 + 0.5);
    vec3 col = n < 0.5 ? c0 : n < 1.5 ? c1 : n < 2.5 ? c2 : n < 4.5 ? c3 : n < 7.5 ? c4 : c5;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`

/** Average screen coverage of one particle, in units of size², at load. */
const MEAN_SCALE_SQ = 0.25 + 0.55 + 1.21 / 3 // E[(0.5 + 1.1u)²], u ~ U(0, 1)
const Z = new THREE.Vector3(0, 0, 1)
const OCTAGON = 2 * Math.SQRT2 * 0.25 // area of an octagon inscribed in r = 0.5

function Scene({ v }: { v: V }) {
  const time = useClock()
  const target = useMemo(
    () =>
      new THREE.WebGLRenderTarget(512, 320, {
        depthBuffer: false,
        type: THREE.UnsignedByteType,
      }),
    []
  )
  const offScene = useMemo(() => new THREE.Scene(), [])
  const offCamera = useMemo(
    () => new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 0.1, 10),
    []
  )
  const quad = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  const octagon = useMemo(() => new THREE.CircleGeometry(0.5, 8), [])
  const particles = useMemo(() => {
    const mesh = new THREE.InstancedMesh<THREE.BufferGeometry>(
      quad,
      new THREE.ShaderMaterial({
        vertexShader: countVertex,
        fragmentShader: countFragment,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
      MAX
    )
    mesh.frustumCulled = false
    return mesh
  }, [quad])
  const heat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: heatVertex,
        fragmentShader: heatFragment,
        toneMapped: false,
        uniforms: {
          map: { value: target.texture },
          c0: { value: new THREE.Color("#101014") },
          c1: { value: new THREE.Color(palette.primary) },
          c2: { value: new THREE.Color(palette.positive) },
          c3: { value: new THREE.Color(palette.warning) },
          c4: { value: new THREE.Color(palette.secondary) },
          c5: { value: new THREE.Color(palette.negative) },
        },
      }),
    [target]
  )
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const p = useMemo(() => new THREE.Vector3(), [])
  const s = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    offCamera.position.z = 5
    offScene.add(particles)
    return () => {
      offScene.remove(particles)
      target.dispose()
      quad.dispose()
      octagon.dispose()
      heat.dispose()
      ;(particles.material as THREE.Material).dispose()
    }
  }, [offScene, offCamera, particles, target, quad, octagon, heat])

  useFrame(({ gl }) => {
    particles.geometry = v.trimmed ? octagon : quad
    particles.count = v.count
    const t = time.current
    // A rising smoke column: particles grow and spread as they age.
    for (let i = 0; i < v.count; i++) {
      const phase = (i * 0.618034) % 1
      const u = (t * 0.16 + phase) % 1
      const sway = Math.sin(u * 6 + i * 1.7) * (0.3 + 1.7 * u)
      p.set(sway + Math.sin(t * 0.5) * 0.4 * u, -H / 2 - 0.3 + u * (H + 0.6), 0)
      const k = v.size * (0.5 + 1.1 * u)
      s.set(k, k, 1)
      q.setFromAxisAngle(Z, i * 1.3 + t * (i % 2 ? 0.4 : -0.4))
      m.compose(p, q, s)
      particles.setMatrixAt(i, m)
    }
    particles.instanceMatrix.needsUpdate = true
    gl.setRenderTarget(target)
    gl.setClearColor(0x000000, 1)
    gl.clear()
    gl.render(offScene, offCamera)
    gl.setRenderTarget(null)
  })

  return (
    <mesh material={heat}>
      <planeGeometry args={[W, H]} />
    </mesh>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 0, 6.1], target: [0, 0, 0] },
  grid: false,
  orbit: false,
  params: [
    { key: "count", label: "Particles", min: 4, max: MAX, step: 1, value: 36 },
    {
      key: "size",
      label: "Particle size",
      min: 0.4,
      max: 2.4,
      step: 0.05,
      value: 1.2,
      unit: "u",
    },
    { key: "trimmed", label: "Trim to octagon", type: "toggle", value: false },
  ],
  readout: (v) => {
    const shape = v.trimmed ? OCTAGON : 1
    const avg = (v.count * v.size * v.size * MEAN_SCALE_SQ * shape) / (W * H)
    return `Average overdraw ≈ ${avg.toFixed(2)}× over the view · ${v.trimmed ? "octagons shade 29% fewer fragments than full quads" : "full quads shade their transparent corners too"}`
  },
  Scene,
})
