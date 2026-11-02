import { createContext, useContext } from "react"
import type { ComponentType } from "react"

import { sim, surfaces, text } from "@/styles/tokens"

/**
 * Shared colours for every scene (docs/design-system.md §2). Meaning:
 * primary = subject/selection/ray (cyan) · secondary = moving thing/energy
 * (orange) · tertiary = secondary object/rotation (violet) · positive =
 * success/valid/normals (green) · warning = velocity/trajectory (yellow) ·
 * accel = acceleration/torque (pink) · negative = force/error/contact (red).
 * Never rely on hue alone: pair with dashes, shapes or labels.
 */
export const palette = {
  stage: surfaces.bg,
  surface: surfaces.surface3,
  /** Default colour for solid props: light enough to read under the stage lights. */
  object: "#71717a",
  grid: "#232327",
  guide: "#8b8b94",
  foreground: text.primary,
  primary: sim.cyan,
  secondary: sim.orange,
  tertiary: sim.violet,
  positive: sim.green,
  warning: sim.yellow,
  accel: sim.pink,
  negative: sim.red,
  // Semantic aliases (prefer these in new scenes).
  subject: sim.cyan,
  moving: sim.orange,
  energy: sim.orange,
  velocity: sim.yellow,
  force: sim.red,
  success: sim.green,
  error: sim.red,
} as const

export type Vec3 = [number, number, number]

export type ParamDef =
  | {
      key: string
      label: string
      type?: "range"
      min: number
      max: number
      step: number
      value: number
      unit?: string
      digits?: number
    }
  | { key: string; label: string; type: "toggle"; value: boolean }
  | {
      key: string
      label: string
      type: "select"
      value: string
      options: { value: string; label: string }[]
    }

export type Values = Record<string, number | boolean | string>

export interface VisualDef<V extends Values = Values> {
  params?: ParamDef[]
  camera?: {
    position: Vec3
    target?: Vec3
    fov?: number
    orthographic?: boolean
    zoom?: number
  }
  /** Allow drag-to-orbit (default true). */
  orbit?: boolean
  /** Draw the reference floor grid (default true). */
  grid?: boolean
  /** Short live readout under the controls, e.g. "Range: 4.2 m". */
  readout?: (v: V) => string
  Scene: ComponentType<{ v: V }>
}

/** Identity helper that keeps `v` typed inside the scene. */
export function defineVisual<V extends Values>(
  def: VisualDef<V>
): VisualDef<V> {
  return def
}

export const initialValues = (params: ParamDef[] = []): Values =>
  Object.fromEntries(params.map((p) => [p.key, p.value]))

interface VisualState {
  playing: boolean
  /** Increments on Reset; scenes restart their simulation when it changes. */
  resetKey: number
  compact: boolean
}

export const VisualContext = createContext<VisualState>({
  playing: true,
  resetKey: 0,
  compact: false,
})

export const useVisual = () => useContext(VisualContext)

export const clamp = (x: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, x))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const deg = (radians: number) => (radians * 180) / Math.PI
export const rad = (degrees: number) => (degrees * Math.PI) / 180
