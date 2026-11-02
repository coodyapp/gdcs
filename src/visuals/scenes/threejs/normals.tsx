import { useEffect, useMemo } from "react"
import * as THREE from "three"

import { defineVisual, palette, rad } from "../../kit"

type V = { maxSlope: number; arrows: string; relief: number }

const SIZE = 7
const SEGMENTS = 9
const ARROW = 0.55

const height = (x: number, z: number, relief: number) =>
  relief *
  (0.75 * Math.sin(x * 0.75) * Math.cos(z * 0.55) +
    0.35 * Math.sin(x * 1.4 + z * 0.9) +
    0.25 * Math.cos(z * 1.6 - 0.4))

/** Fills a LineSegments buffer with arrows from each point along its normal. */
function arrowLines(
  points: THREE.BufferAttribute,
  normals: THREE.BufferAttribute
) {
  const out = new Float32Array(points.count * 6)
  for (let i = 0; i < points.count; i++) {
    const x = points.getX(i)
    const y = points.getY(i)
    const z = points.getZ(i)
    out.set(
      [
        x,
        y,
        z,
        x + normals.getX(i) * ARROW,
        y + normals.getY(i) * ARROW,
        z + normals.getZ(i) * ARROW,
      ],
      i * 6
    )
  }
  // Per-segment distances so LineDashedMaterial can dash each arrow.
  const dist = new Float32Array(points.count * 2)
  for (let i = 0; i < points.count; i++) dist[i * 2 + 1] = ARROW
  return new THREE.BufferGeometry()
    .setAttribute("position", new THREE.BufferAttribute(out, 3))
    .setAttribute("lineDistance", new THREE.BufferAttribute(dist, 1))
}

function Scene({ v }: { v: V }) {
  const { smooth, flat, faceArrows, vertexArrows } = useMemo(() => {
    const smooth = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS)
    smooth.rotateX(-Math.PI / 2)
    const pos = smooth.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++)
      pos.setY(i, height(pos.getX(i), pos.getZ(i), v.relief))
    smooth.computeVertexNormals()

    // Non-indexed copy: every triangle owns its vertices, so normals are flat.
    const flat = smooth.toNonIndexed()
    flat.computeVertexNormals()
    flat.setAttribute(
      "color",
      new THREE.BufferAttribute(
        new Float32Array(flat.attributes.position.count * 3),
        3
      )
    )

    // Face arrows start at triangle centroids.
    const fp = flat.attributes.position as THREE.BufferAttribute
    const fn = flat.attributes.normal as THREE.BufferAttribute
    const tris = fp.count / 3
    const centroids = new THREE.BufferAttribute(new Float32Array(tris * 3), 3)
    const faceN = new THREE.BufferAttribute(new Float32Array(tris * 3), 3)
    for (let t = 0; t < tris; t++) {
      const a = t * 3
      centroids.setXYZ(
        t,
        (fp.getX(a) + fp.getX(a + 1) + fp.getX(a + 2)) / 3,
        (fp.getY(a) + fp.getY(a + 1) + fp.getY(a + 2)) / 3,
        (fp.getZ(a) + fp.getZ(a + 1) + fp.getZ(a + 2)) / 3
      )
      faceN.setXYZ(t, fn.getX(a), fn.getY(a), fn.getZ(a))
    }
    return {
      smooth,
      flat,
      faceArrows: arrowLines(centroids, faceN),
      vertexArrows: arrowLines(
        pos,
        smooth.attributes.normal as THREE.BufferAttribute
      ),
    }
  }, [v.relief])

  // Recolour triangles whenever the slope limit changes.
  useEffect(() => {
    const limit = Math.cos(rad(v.maxSlope))
    // Walkable = neutral grey, too steep = red (error); lightness differs too.
    const ok = new THREE.Color(palette.object)
    const bad = new THREE.Color(palette.error)
    const n = flat.attributes.normal as THREE.BufferAttribute
    const c = flat.attributes.color as THREE.BufferAttribute
    for (let i = 0; i < n.count; i++) {
      const col = n.getY(i) >= limit ? ok : bad
      c.setXYZ(i, col.r, col.g, col.b)
    }
    c.needsUpdate = true
  }, [flat, v.maxSlope])

  useEffect(
    () => () => {
      smooth.dispose()
      flat.dispose()
      faceArrows.dispose()
      vertexArrows.dispose()
    },
    [smooth, flat, faceArrows, vertexArrows]
  )

  const showFace = v.arrows === "face" || v.arrows === "both"
  const showVertex = v.arrows === "vertex" || v.arrows === "both"

  return (
    <group position={[0, 0.2, 0]}>
      <mesh geometry={flat}>
        <meshStandardMaterial vertexColors roughness={0.85} flatShading />
      </mesh>
      <mesh geometry={flat} position={[0, 0.002, 0]}>
        <meshBasicMaterial
          color={palette.stage}
          wireframe
          transparent
          opacity={0.35}
        />
      </mesh>
      {showFace && (
        <lineSegments geometry={faceArrows}>
          <lineBasicMaterial color={palette.success} />
        </lineSegments>
      )}
      {showVertex && (
        <lineSegments geometry={vertexArrows}>
          <lineDashedMaterial
            color={palette.tertiary}
            dashSize={0.09}
            gapSize={0.07}
          />
        </lineSegments>
      )}
    </group>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 6.5, 8.6], target: [0, 0.1, 0] },
  grid: false,
  params: [
    {
      key: "maxSlope",
      label: "Max walkable slope",
      min: 10,
      max: 70,
      step: 1,
      value: 32,
      unit: "°",
    },
    {
      key: "arrows",
      label: "Normals shown",
      type: "select",
      value: "face",
      options: [
        { value: "face", label: "Face (flat)" },
        { value: "vertex", label: "Vertex (smooth)" },
        { value: "both", label: "Both" },
      ],
    },
    {
      key: "relief",
      label: "Terrain relief",
      min: 0.2,
      max: 1.6,
      step: 0.05,
      value: 0.9,
      digits: 2,
    },
  ],
  readout: (v) =>
    `Walkable when n·up ≥ cos(${v.maxSlope}°) = ${Math.cos(rad(v.maxSlope)).toFixed(3)}`,
  Scene,
})
