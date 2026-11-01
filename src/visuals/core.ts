import { createContext, useContext } from "react"
import type { ComponentType } from "react"

/** Shared colours for every scene: neutral stage, a few semantic accents. */
export const palette = {
  stage: "#0a0a0a",
  surface: "#27272a",
  /** Default colour for solid props: light enough to read under the stage lights. */
  object: "#71717a",
  grid: "#2a2a2e",
  guide: "#71717a",
  foreground: "#e4e4e7",
  primary: "#38bdf8",
  secondary: "#f97316",
  tertiary: "#a78bfa",
  positive: "#22c55e",
  negative: "#fb7185",
  warning: "#fbbf24",
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
