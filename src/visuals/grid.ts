/** How far behind a straight-on view the grid sits, so content stays in front. */
const GRID_BEHIND = 6

/**
 * The faint grid behind every simulation. A view from an angle gets a floor. A
 * view straight along an axis would see a floor edge-on, so the grid turns to
 * face the camera and sits behind the content.
 */
export function gridPlacement(
  position: readonly number[],
  target: readonly number[]
) {
  const view = position.map((p, i) => p - target[i])
  const length = Math.hypot(...view) || 1
  const axis = view.map((v) => v / length)
  if (Math.abs(axis[2]) > 0.9)
    return {
      rotation: [Math.PI / 2, 0, 0] as const,
      position: [
        target[0],
        target[1],
        target[2] - Math.sign(axis[2]) * GRID_BEHIND,
      ] as const,
    }
  if (Math.abs(axis[0]) > 0.9)
    return {
      rotation: [0, 0, Math.PI / 2] as const,
      position: [
        target[0] - Math.sign(axis[0]) * GRID_BEHIND,
        target[1],
        target[2],
      ] as const,
    }
  return {
    rotation: [0, 0, 0] as const,
    position: [0, -0.001, 0] as const,
  }
}
