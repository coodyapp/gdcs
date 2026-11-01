/**
 * Distance-based level-of-detail selection with hysteresis, matching the
 * semantics of THREE.LOD: level i (i ≥ 1) is entered once the distance reaches
 * `switchAt[i - 1]`, and while it is active it is only left again when the
 * distance drops below `switchAt[i - 1] * (1 - hysteresis)`.
 */
export function selectLod(
  distance: number,
  switchAt: readonly number[],
  current: number,
  hysteresis = 0
) {
  let level = 0
  for (let i = 0; i < switchAt.length; i++) {
    const shown = current === i + 1
    const threshold = shown ? switchAt[i] * (1 - hysteresis) : switchAt[i]
    if (distance >= threshold) level = i + 1
    else break
  }
  return level
}

/** Screen-space size of a bounding sphere, in pixels of viewport height. */
export function projectedSize(
  radius: number,
  distance: number,
  fovYDegrees: number,
  viewportHeight: number
) {
  const half = Math.tan((fovYDegrees * Math.PI) / 360)
  return (radius / (Math.max(distance, 1e-6) * half)) * viewportHeight
}
