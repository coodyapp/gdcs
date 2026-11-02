import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { defineVisual, palette, useClock, useVisual } from "../../kit"

type V = { count: number; mode: string }

/** Slow-motion submission rate, so one call at a time is visible. */
const CALLS_PER_SECOND = 260
const HOLD = 0.9
const EXTENT = 7 // width of the cube block in scene units
const CPU_BAR_PER_CALL = 0.0075 // scene units of "CPU time" per call

// Orange = a cube whose own draw call was just sent; cyan = the instanced batch,
// which also gets one outline around the whole block (one call = one shape).
const lit = new THREE.Color(palette.moving)
const litBatch = new THREE.Color(palette.subject)
const base = new THREE.Color(palette.object)

function layout(count: number) {
  const side = Math.ceil(Math.sqrt(count))
  const step = EXTENT / side
  return { side, step, size: step * 0.62 }
}

/** Seconds a cycle takes for a mode: submit time plus a short hold. */
const cycleLength = (calls: number) =>
  Math.max(calls / CALLS_PER_SECOND, 0.35) + HOLD

function Scene({ v }: { v: V }) {
  const time = useClock()
  const { resetKey } = useVisual()
  const { side, step, size } = layout(v.count)
  const geometry = useMemo(
    () => new THREE.BoxGeometry(size, size, size),
    [size]
  )

  // Separate meshes: one draw call (and one material) each.
  const separate = useMemo(() => {
    const group = new THREE.Group()
    for (let i = 0; i < v.count; i++) {
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ color: base, roughness: 0.7 })
      )
      mesh.position.set(
        ((i % side) + 0.5) * step - EXTENT / 2,
        size / 2,
        (Math.floor(i / side) + 0.5) * step - EXTENT / 2
      )
      group.add(mesh)
    }
    return group
  }, [v.count, geometry, side, step, size])

  // One InstancedMesh: a single draw call for all cubes.
  const instanced = useMemo(() => {
    const mesh = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshStandardMaterial({ roughness: 0.7 }),
      v.count
    )
    const m = new THREE.Matrix4()
    for (let i = 0; i < v.count; i++) {
      m.setPosition(
        ((i % side) + 0.5) * step - EXTENT / 2,
        size / 2,
        (Math.floor(i / side) + 0.5) * step - EXTENT / 2
      )
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, base)
    }
    mesh.computeBoundingSphere()
    return mesh
  }, [v.count, geometry, side, step, size])

  useEffect(
    () => () => {
      separate.children.forEach((c) =>
        ((c as THREE.Mesh).material as THREE.Material).dispose()
      )
      ;(instanced.material as THREE.Material).dispose()
      instanced.dispose()
    },
    [separate, instanced]
  )
  useEffect(() => () => geometry.dispose(), [geometry])

  const cpuBar = useRef<THREE.Mesh>(null)
  const batchOutline = useRef<THREE.LineSegments>(null)
  const outlineGeo = useMemo(
    () =>
      new THREE.EdgesGeometry(
        new THREE.BoxGeometry(EXTENT + 0.15, size + 0.1, EXTENT + 0.15)
      ),
    [size]
  )
  useEffect(() => () => outlineGeo.dispose(), [outlineGeo])
  const last = useRef({ mode: "", shown: -1, resetKey })

  useFrame(() => {
    // Which mode is on screen and how far through its submission we are.
    const tSep = cycleLength(v.count)
    const tInst = cycleLength(1)
    let mode = v.mode
    let t = time.current
    if (mode === "auto") {
      t %= tSep + tInst
      mode = t < tSep ? "meshes" : "instanced"
      if (mode === "instanced") t -= tSep
    } else {
      t %= mode === "meshes" ? tSep : tInst
    }
    const calls = mode === "meshes" ? v.count : 1
    const sent = Math.min(calls, Math.floor(t * CALLS_PER_SECOND) + 1)
    const shown = mode === "meshes" ? sent : sent >= 1 ? v.count : 0

    separate.visible = mode === "meshes"
    instanced.visible = mode === "instanced"
    if (batchOutline.current)
      batchOutline.current.visible = mode === "instanced" && sent >= 1
    const prev = last.current
    if (
      prev.mode !== mode ||
      prev.resetKey !== resetKey ||
      shown < prev.shown
    ) {
      prev.shown = 0
      prev.mode = mode
      prev.resetKey = resetKey
      for (const c of separate.children)
        ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).color.copy(
          base
        )
      for (let i = 0; i < v.count; i++) instanced.setColorAt(i, base)
    }
    if (shown > prev.shown) {
      if (mode === "meshes") {
        for (let i = prev.shown; i < shown; i++)
          (
            (separate.children[i] as THREE.Mesh)
              .material as THREE.MeshStandardMaterial
          ).color.copy(lit)
      } else {
        for (let i = 0; i < v.count; i++) instanced.setColorAt(i, litBatch)
      }
      prev.shown = shown
    }
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true

    if (cpuBar.current) {
      const w = Math.max(0.04, sent * CPU_BAR_PER_CALL)
      cpuBar.current.scale.x = w
      cpuBar.current.position.x = -EXTENT / 2 + w / 2
    }
  })

  return (
    <>
      <primitive object={separate} />
      <primitive object={instanced} />
      <lineSegments
        ref={batchOutline}
        geometry={outlineGeo}
        position={[0, size / 2, 0]}
        visible={false}
      >
        <lineBasicMaterial color={palette.subject} />
      </lineSegments>
      {/* CPU time spent submitting this frame grows with the call count. */}
      <mesh position={[0, 0.06, EXTENT / 2 + 0.7]}>
        <boxGeometry args={[EXTENT, 0.04, 0.3]} />
        <meshBasicMaterial color={palette.surface} />
      </mesh>
      <mesh ref={cpuBar} position={[-EXTENT / 2, 0.1, EXTENT / 2 + 0.7]}>
        <boxGeometry args={[1, 0.08, 0.3]} />
        <meshBasicMaterial color={palette.velocity} />
      </mesh>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 8.4, 9], target: [0, 0, 1] },
  orbit: false,
  params: [
    {
      key: "count",
      label: "Cubes",
      min: 64,
      max: 1024,
      step: 32,
      value: 576,
    },
    {
      key: "mode",
      label: "Submission",
      type: "select",
      value: "auto",
      options: [
        { value: "auto", label: "Alternate" },
        { value: "meshes", label: "Separate meshes" },
        { value: "instanced", label: "InstancedMesh" },
      ],
    },
  ],
  readout: (v) => {
    const cpu = (n: number) =>
      `${((n * 10) / 1000).toFixed(n > 100 ? 1 : 2)} ms`
    const sep = `separate meshes: ${v.count} draw calls ≈ ${cpu(v.count)} CPU`
    const inst = `InstancedMesh: 1 draw call ≈ ${cpu(1)}`
    if (v.mode === "meshes") return `${sep} (at ~10 µs per call)`
    if (v.mode === "instanced") return `${inst} for all ${v.count} cubes`
    return `${sep} · ${inst} (at ~10 µs per call)`
  },
  Scene,
})
