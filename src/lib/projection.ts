/**
 * Camera projection in the OpenGL convention used by Three.js: the camera sits
 * at the origin of view space looking down -Z, and NDC x, y and z all run from
 * -1 to 1. Matrices are column-major, same layout as THREE.Matrix4.elements.
 */
import type { Mat4, Vec3 } from "./transforms"

export type Vec4 = [number, number, number, number]

/** Perspective matrix from a vertical field of view in radians. */
export function perspective(
  fovY: number,
  aspect: number,
  near: number,
  far: number
): Mat4 {
  const f = 1 / Math.tan(fovY / 2)
  const nf = near - far
  // prettier-ignore
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) / nf, -1,
    0, 0, (2 * far * near) / nf, 0,
  ]
}

/** Symmetric orthographic matrix from half the view width and height. */
export function orthographic(
  halfWidth: number,
  halfHeight: number,
  near: number,
  far: number
): Mat4 {
  const nf = near - far
  // prettier-ignore
  return [
    1 / halfWidth, 0, 0, 0,
    0, 1 / halfHeight, 0, 0,
    0, 0, 2 / nf, 0,
    0, 0, (far + near) / nf, 1,
  ]
}

/** View-space point to clip space (before the perspective divide). */
export function toClip(m: Mat4, [x, y, z]: Vec3): Vec4 {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
    m[3] * x + m[7] * y + m[11] * z + m[15],
  ]
}

/** Perspective divide: clip space to NDC. */
export function clipToNdc([x, y, z, w]: Vec4): Vec3 {
  return [x / w, y / w, z / w]
}

/** View-space point straight to NDC. */
export function projectToNdc(m: Mat4, point: Vec3): Vec3 {
  return clipToNdc(toClip(m, point))
}

/** True when an NDC point lies inside the visible cube. */
export function insideNdc([x, y, z]: Vec3): boolean {
  return Math.abs(x) <= 1 && Math.abs(y) <= 1 && Math.abs(z) <= 1
}

/** NDC to pixels. Pixel y grows downward, NDC y grows upward. */
export function ndcToPixels(
  [x, y]: Vec3,
  width: number,
  height: number
): [number, number] {
  return [((x + 1) / 2) * width, ((1 - y) / 2) * height]
}

/** Pixels back to NDC x and y (the inverse of `ndcToPixels`). */
export function pixelsToNdc(
  px: number,
  py: number,
  width: number,
  height: number
): [number, number] {
  return [(px / width) * 2 - 1, 1 - (py / height) * 2]
}

/** World-space height a perspective camera sees at distance `d`. */
export function visibleHeight(d: number, fovY: number): number {
  return 2 * d * Math.tan(fovY / 2)
}

/** NDC depth of a point `d` units in front of a perspective camera. */
export function perspectiveDepth(d: number, near: number, far: number): number {
  return (far + near) / (far - near) - (2 * far * near) / ((far - near) * d)
}
