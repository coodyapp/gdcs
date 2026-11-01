/**
 * Frame-data helpers for melee attacks: startup → active → recovery, plus a
 * per-swing hit registry so one swing damages each target at most once.
 */
export type AttackPhase = "startup" | "active" | "recovery" | "done"

export interface FrameData {
  startup: number
  active: number
  recovery: number
}

export function attackPhase(frame: number, f: FrameData): AttackPhase {
  if (frame < f.startup) return "startup"
  if (frame < f.startup + f.active) return "active"
  if (frame < f.startup + f.active + f.recovery) return "recovery"
  return "done"
}

export interface Box {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export const boxesOverlap = (a: Box, b: Box) =>
  a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY

export class HitRegistry {
  private hit = new Set<number>()
  /** Call when a new swing starts. */
  begin() {
    this.hit.clear()
  }
  /** True the first time `target` is hit this swing. */
  tryHit(target: number): boolean {
    if (this.hit.has(target)) return false
    this.hit.add(target)
    return true
  }
}
