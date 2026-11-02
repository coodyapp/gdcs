/**
 * Design tokens (docs/design-system.md). Single source for TypeScript (the
 * Three.js palette, tests). `globals.css` mirrors these values; keep both in
 * sync.
 *
 * Rule (Coody brand): the UI is black, white and greys only. Colour (green,
 * yellow, red) is reserved for simulations, where it carries meaning.
 */
export const surfaces = {
  bg: "#0a0a0a",
  card: "#141416",
  surface2: "#1c1c1f",
  surface3: "#27272a",
} as const

export const text = {
  primary: "#fafafa",
  secondary: "#a1a1aa",
  meta: "#8b8b94",
} as const

/** Neutral steps usable in UI and inside simulations. */
export const neutral = {
  white: "#fafafa",
  light: "#d4d4d8",
  mid: "#a1a1aa",
  dim: "#71717a",
  dark: "#3f3f46",
} as const

/** The only hues, simulations only (tuned for #0a0a0a; all ≥ 5.7:1 on cards). */
export const sim = {
  green: "#3ee09a", // success, valid, grounded, goal, normals
  yellow: "#f5d547", // moving thing, energy, velocity (dashed), highlight
  red: "#f65a5a", // force, error, contact, danger
} as const
