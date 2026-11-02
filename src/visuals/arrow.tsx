/**
 * Thick, unlit 3D arrow for math scenes. Render <Arrow ref={g} /> once, then
 * call setArrow(g.current, from, to) inside useFrame (no allocations).
 */
import type { Ref } from "react"
import * as THREE from "three"

const UP = new THREE.Vector3(0, 1, 0)
const DIR = new THREE.Vector3()

export function Arrow({
  ref,
  color,
  radius = 0.045,
  head = 0.26,
  hollow = false,
}: {
  ref: Ref<THREE.Group>
  color: string
  radius?: number
  head?: number
  /** Secondary vectors get a wireframe head (shape cue, not just hue). */
  hollow?: boolean
}) {
  return (
    <group ref={ref} userData={{ head }}>
      <mesh>
        <cylinderGeometry args={[radius, radius, 1, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh>
        <coneGeometry args={[head * 0.45, head, hollow ? 8 : 20, 1]} />
        <meshBasicMaterial color={color} wireframe={hollow} />
      </mesh>
    </group>
  )
}

/** Place an <Arrow> group so it runs from `from` to `to`. */
export function setArrow(
  g: THREE.Group | null,
  from: THREE.Vector3,
  to: THREE.Vector3
) {
  if (!g) return
  DIR.subVectors(to, from)
  const len = DIR.length()
  g.visible = len > 1e-3
  if (!g.visible) return
  const fullHead = g.userData.head as number
  const head = Math.min(fullHead, len * 0.5)
  g.position.copy(from)
  g.quaternion.setFromUnitVectors(UP, DIR.divideScalar(len))
  const [shaft, cone] = g.children
  shaft.scale.set(1, len - head, 1)
  shaft.position.y = (len - head) / 2
  cone.scale.setScalar(head / fullHead)
  cone.position.y = len - head / 2
}

/** A 1px line whose points are rewritten in place (optionally dashed). */
export function makeLine(
  color: string,
  points: number,
  dashed?: { dash: number; gap: number },
  opacity = 1
) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(points * 3), 3)
  )
  if (dashed)
    geometry.setAttribute(
      "lineDistance",
      new THREE.BufferAttribute(new Float32Array(points), 1)
    )
  const material = dashed
    ? new THREE.LineDashedMaterial({
        color,
        dashSize: dashed.dash,
        gapSize: dashed.gap,
        transparent: opacity < 1,
        opacity,
      })
    : new THREE.LineBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
      })
  return new THREE.Line(geometry, material)
}

/** Rewrite a two-point makeLine() line from a to b. */
export function setSegment(
  line: THREE.Line,
  a: THREE.Vector3,
  b: THREE.Vector3
) {
  const pos = line.geometry.attributes.position as THREE.BufferAttribute
  pos.setXYZ(0, a.x, a.y, a.z)
  pos.setXYZ(1, b.x, b.y, b.z)
  pos.needsUpdate = true
  line.geometry.computeBoundingSphere()
  const dist = line.geometry.attributes.lineDistance as
    | THREE.BufferAttribute
    | undefined
  if (dist) {
    dist.setX(1, a.distanceTo(b))
    dist.needsUpdate = true
  }
}
