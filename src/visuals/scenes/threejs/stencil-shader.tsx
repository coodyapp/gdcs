import { useEffect, useMemo, useRef } from "react"
import { createPortal, useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"

import {
  buildFanIndices,
  type Cast,
  castFan,
  castRay,
  fanCapacity,
  fanIndexCount,
  type FanResult,
  type Obstacle,
  writeFanPositions,
} from "@/lib/fov"

import { defineVisual, palette, rad, useClock } from "../../kit"

type V = { mask: boolean; angle: number }

const EYE = { x: 0, y: 0 }
const RADIUS = 4.4
const RAYS = 90
const CAP = fanCapacity(RAYS)
const STENCIL_REF = 1
const WALLS: Obstacle[] = [
  { kind: "box", x: 1.6, y: -0.3, hx: 0.2, hy: 0.6 },
  { kind: "box", x: -1.1, y: 1.3, hx: 0.6, hy: 0.2 },
  { kind: "box", x: 0.6, y: 1.7, hx: 0.2, hy: 0.35 },
  { kind: "box", x: -1.4, y: -1.2, hx: 0.25, hy: 0.5 },
]
/** Hidden things orbit slowly against the sweep: radius, phase, size, shape. */
const HIDDEN = [
  { r: 3.0, p: 2.02, size: 0.34, shape: "ico" },
  { r: 3.2, p: 2.72, size: 0.3, shape: "box" },
  { r: 2.7, p: 3.6, size: 0.34, shape: "ico" },
  { r: 3.3, p: 4.5, size: 0.3, shape: "box" },
  { r: 2.8, p: 5.4, size: 0.34, shape: "ico" },
  { r: 3.3, p: 0.3, size: 0.3, shape: "box" },
  { r: 2.6, p: 1.1, size: 0.32, shape: "ico" },
] as const
const cast: Cast = (angle, out) => castRay(WALLS, EYE, angle, RADIUS, out)

/**
 * The shared Canvas may be created without a stencil buffer (three.js
 * defaults `stencil: false`). In that case the masked layer is drawn into a
 * render target that has its own stencil buffer and composited on top.
 */
let canvasStencil: boolean | null = null

const compositeVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`
const compositeFragment = /* glsl */ `
uniform sampler2D map;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(map, vUv);
  gl_FragColor = vec4(c.rgb / max(c.a, 1e-4), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor = vec4(gl_FragColor.rgb * c.a, c.a);
}`

function Scene({ v }: { v: V }) {
  const time = useClock()
  const gl = useThree((s) => s.gl)
  const direct = useMemo(() => {
    const ok = gl.getContextAttributes()?.stencil === true
    canvasStencil = ok
    return ok
  }, [gl])
  const hidden = useRef<(THREE.Mesh | null)[]>([])

  const s = useMemo(() => {
    const points = new Float32Array(CAP * 2)
    const result: FanResult = { count: 0, rays: 0, refineCasts: 0 }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array((CAP + 1) * 3), 3)
    )
    geo.setIndex(new THREE.BufferAttribute(buildFanIndices(CAP), 1))

    // 1) The mask: invisible, writes STENCIL_REF wherever it passes depth.
    const maskMat = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      stencilWrite: true,
      stencilRef: STENCIL_REF,
      stencilFunc: THREE.AlwaysStencilFunc,
      stencilZPass: THREE.ReplaceStencilOp,
    })
    const mask = new THREE.Mesh(geo, maskMat)
    mask.renderOrder = 1
    mask.frustumCulled = false

    // A faint visible copy so the cone itself can be seen.
    const fill = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: palette.subject,
        transparent: true,
        opacity: 0.07,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    )
    fill.frustumCulled = false
    fill.renderOrder = 3

    const rimGeo = new THREE.BufferGeometry()
    rimGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array((CAP + 2) * 3), 3)
    )
    const rim = new THREE.Line(
      rimGeo,
      new THREE.LineBasicMaterial({ color: palette.subject })
    )
    rim.frustumCulled = false
    rim.renderOrder = 3

    // 2) Hidden objects: drawn only where stencil == STENCIL_REF.
    const hiddenMat = new THREE.MeshStandardMaterial({
      color: palette.moving,
      roughness: 0.5,
      stencilWrite: true, // enables the stencil test for this material
      stencilRef: STENCIL_REF,
      stencilFunc: THREE.EqualStencilFunc,
    })

    const layer = new THREE.Group()
    layer.add(mask, fill, rim)

    // Off-canvas path: a target with its own depth + stencil buffer.
    const rt = new THREE.WebGLRenderTarget(1, 1, {
      depthBuffer: true,
      stencilBuffer: true,
      samples: 4,
      type: THREE.HalfFloatType,
    })
    const rtScene = new THREE.Scene()
    rtScene.add(new THREE.AmbientLight("#ffffff", 1.1))
    rtScene.add(new THREE.HemisphereLight("#ffffff", "#262626", 0.6))
    const sun = new THREE.DirectionalLight("#ffffff", 1.4)
    sun.position.set(5, 8, 4)
    rtScene.add(sun)
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: { map: { value: rt.texture } },
        vertexShader: compositeVertex,
        fragmentShader: compositeFragment,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        premultipliedAlpha: true,
      })
    )
    quad.frustumCulled = false
    quad.renderOrder = 1000

    return {
      points,
      result,
      geo,
      rim,
      hiddenMat,
      layer,
      rt,
      rtScene,
      quad,
      size: new THREE.Vector2(),
      clear: new THREE.Color(),
    }
  }, [])

  useEffect(() => {
    if (direct) return
    s.rtScene.add(s.layer)
    return () => {
      s.rtScene.remove(s.layer)
    }
  }, [direct, s])
  useEffect(() => () => s.rt.dispose(), [s])

  useFrame(({ camera }) => {
    const t = time.current
    const heading = t * 0.5
    const r = castFan(
      cast,
      heading,
      rad(v.angle),
      RAYS,
      4,
      0.4,
      s.points,
      s.result
    )
    const pos = s.geo.attributes.position as THREE.BufferAttribute
    writeFanPositions(EYE, s.points, r.count, 0.02, pos.array as Float32Array)
    pos.needsUpdate = true
    s.geo.setDrawRange(0, fanIndexCount(r.count))

    const rim = s.rim.geometry.attributes.position as THREE.BufferAttribute
    rim.setXYZ(0, EYE.x, 0.04, EYE.y)
    for (let i = 0; i < r.count; i++)
      rim.setXYZ(i + 1, s.points[i * 2], 0.04, s.points[i * 2 + 1])
    rim.setXYZ(r.count + 1, EYE.x, 0.04, EYE.y)
    rim.needsUpdate = true
    s.rim.geometry.setDrawRange(0, r.count + 2)

    // Mask off: skip the stencil test so hidden objects draw everywhere.
    if (s.hiddenMat.stencilWrite !== v.mask) {
      s.hiddenMat.stencilWrite = v.mask
      s.hiddenMat.needsUpdate = true
    }
    for (let i = 0; i < HIDDEN.length; i++) {
      const m = hidden.current[i]
      if (!m) continue
      const h = HIDDEN[i]
      const a = h.p - t * 0.12
      m.position.x = EYE.x + Math.cos(a) * h.r
      m.position.z = EYE.y + Math.sin(a) * h.r
      m.rotation.y = t * 0.8 + i
      m.rotation.x = t * 0.5 + i * 0.7
      m.position.y = 0.45 + Math.sin(t * 1.4 + i) * 0.08
    }

    if (direct) return
    gl.getDrawingBufferSize(s.size)
    if (s.rt.width !== s.size.x || s.rt.height !== s.size.y)
      s.rt.setSize(s.size.x, s.size.y)
    const prev = gl.getRenderTarget()
    const alpha = gl.getClearAlpha()
    gl.getClearColor(s.clear)
    gl.setRenderTarget(s.rt)
    gl.setClearColor(0x000000, 0)
    gl.render(s.rtScene, camera) // autoClear wipes colour, depth and stencil
    gl.setRenderTarget(prev)
    gl.setClearColor(s.clear, alpha)
  })

  // The layer group holds mask, hidden objects and walls. Direct: it sits in
  // the main scene and uses the canvas stencil. Fallback: it renders into
  // the stencil-enabled target and a fullscreen quad composites it.
  return (
    <>
      {direct ? <primitive object={s.layer} /> : <primitive object={s.quad} />}
      {createPortal(
        <>
          {WALLS.map((o, i) =>
            o.kind === "box" ? (
              <mesh key={`w${i}`} position={[o.x, 0.4, o.y]}>
                <boxGeometry args={[o.hx * 2, 0.8, o.hy * 2]} />
                <meshStandardMaterial color={palette.object} roughness={0.8} />
              </mesh>
            ) : null
          )}
          <mesh position={[EYE.x, 0.25, EYE.y]}>
            <sphereGeometry args={[0.2, 24, 16]} />
            <meshBasicMaterial color={palette.subject} />
          </mesh>
          {HIDDEN.map((h, i) => (
            <mesh
              key={`h${i}`}
              position={[0, 0.45, 0]}
              material={s.hiddenMat}
              renderOrder={2}
              ref={(m) => {
                hidden.current[i] = m
              }}
            >
              {h.shape === "ico" ? (
                <icosahedronGeometry args={[h.size, 0]} />
              ) : (
                <boxGeometry
                  args={[h.size * 1.5, h.size * 1.5, h.size * 1.5]}
                />
              )}
            </mesh>
          ))}
        </>,
        s.layer
      )}
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 12, 4], target: [0, 0, 0.2] },
  params: [
    { key: "mask", label: "Stencil mask", type: "toggle", value: true },
    {
      key: "angle",
      label: "View angle",
      min: 30,
      max: 160,
      step: 1,
      value: 100,
      unit: "°",
    },
  ],
  readout: (v) =>
    `${v.mask ? "Mask on: yellow drawn where stencil = 1" : "Mask off: stencil test disabled"} · ${
      canvasStencil === false
        ? "canvas has no stencil → render target with stencilBuffer"
        : canvasStencil
          ? "canvas stencil buffer"
          : "stencil buffer"
    }`,
  Scene,
})
