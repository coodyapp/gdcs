import { Suspense, useLayoutEffect } from "react"
import { Canvas, useThree } from "@react-three/fiber"
import { useEffect } from "react"
import { OrbitControls } from "@react-three/drei"

import { palette, type Values, type VisualDef } from "./core"

/**
 * The WebGL part of a visual. Loaded lazily with the scene module, so
 * three.js and React Three Fiber never enter the main bundle or SSR.
 */
export default function Stage({
  def,
  values,
  compact,
  label,
}: {
  def: VisualDef<Values>
  values: Values
  compact: boolean
  label: string
}) {
  const camera = def.camera ?? { position: [6, 4, 6] }
  return (
    <Canvas
      // Cards: DPR 1 and 30 fps on demand (see Throttle); pages: full quality.
      dpr={compact ? 1 : [1, 2]}
      frameloop={compact ? "demand" : "always"}
      orthographic={camera.orthographic}
      camera={{
        position: camera.position,
        fov: camera.fov ?? 45,
        zoom: camera.zoom ?? (camera.orthographic ? 60 : 1),
        near: 0.05,
        far: 500,
      }}
      gl={{ antialias: true, stencil: true, powerPreference: "low-power" }}
      aria-label={label}
      role="img"
    >
      <color attach="background" args={[palette.stage]} />
      {compact && <Throttle fps={30} />}
      <ambientLight intensity={1.1} />
      <hemisphereLight args={["#ffffff", "#262626", 0.6]} />
      <directionalLight position={[5, 8, 4]} intensity={1.4} />
      {def.gridY !== undefined && <ReferenceGrid y={def.gridY} />}
      <Suspense fallback={null}>
        <def.Scene v={values} />
      </Suspense>
      {def.orbit !== false && !compact && (
        <OrbitControls
          makeDefault
          target={camera.target ?? [0, 0, 0]}
          enablePan={false}
          enableZoom
          enableDamping
        />
      )}
      {/* Orbit-less or compact scenes still look at the declared target. */}
      {(def.orbit === false || compact) && (
        <LookAt target={camera.target ?? [0, 0, 0]} />
      )}
    </Canvas>
  )
}

const GRID_SIZE = 60
const GRID_LINES = "#fafafa"
const GRID_OPACITY = 0.1
/** Just under the ground, so surfaces lying on it do not flicker against it. */
const GRID_GAP = 0.001
function ReferenceGrid({ y }: { y: number }) {
  return (
    <gridHelper
      args={[GRID_SIZE, GRID_SIZE, GRID_LINES, GRID_LINES]}
      position={[0, y - GRID_GAP, 0]}
      renderOrder={-1}
      material-transparent
      material-opacity={GRID_OPACITY}
      material-depthWrite={false}
    />
  )
}

function LookAt({ target }: { target: [number, number, number] }) {
  const camera = useThree((s) => s.camera)
  useLayoutEffect(() => {
    camera.lookAt(...target)
    camera.updateProjectionMatrix()
  }, [camera, target])
  return null
}

/** Drives a demand-mode canvas at a fixed rate, paused while the tab is hidden. */
function Throttle({ fps }: { fps: number }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) invalidate()
    }, 1000 / fps)
    return () => clearInterval(id)
  }, [invalidate, fps])
  return null
}
