import { Suspense, useLayoutEffect } from "react"
import { Canvas, useThree } from "@react-three/fiber"
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
      dpr={compact ? [1, 1.5] : [1, 2]}
      orthographic={camera.orthographic}
      camera={{
        position: camera.position,
        fov: camera.fov ?? 45,
        zoom: camera.zoom ?? (camera.orthographic ? 60 : 1),
        near: 0.05,
        far: 500,
      }}
      gl={{ antialias: true, powerPreference: "low-power" }}
      aria-label={label}
      role="img"
    >
      <color attach="background" args={[palette.stage]} />
      <ambientLight intensity={1.1} />
      <hemisphereLight args={["#ffffff", "#27272a", 0.6]} />
      <directionalLight position={[5, 8, 4]} intensity={1.4} />
      {def.grid !== false && (
        <gridHelper
          args={[20, 20, palette.grid, palette.grid]}
          position={[0, -0.001, 0]}
        />
      )}
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

function LookAt({ target }: { target: [number, number, number] }) {
  const camera = useThree((s) => s.camera)
  useLayoutEffect(() => {
    camera.lookAt(...target)
    camera.updateProjectionMatrix()
  }, [camera, target])
  return null
}
