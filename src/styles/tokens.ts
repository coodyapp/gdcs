/**
 * Design tokens (docs/reference/design-system.md). Single source for TypeScript (the
 * Three.js palette, tests). `globals.css` mirrors these values; keep both in
 * sync.
 *
 * Rule (Coody brand): the UI is black, white and greys only. Colour (green,
 * yellow, red) is reserved for simulations, where it carries meaning.
 */
export const surfaces = {
  bg: "#0a0a0a", // neutral-950, Coody's background
  card: "#171717", // neutral-900
  surface2: "#262626", // neutral-800, Coody's border/muted
  surface3: "#404040", // neutral-700
} as const

export const text = {
  primary: "#fafafa",
  secondary: "#a3a3a3",
  meta: "#a3a3a3",
} as const

/** Light mode UI. Simulations, code and formulas stay on dark panels in both themes. */
export const light = {
  bg: "#ffffff",
  card: "#fafafa", // neutral-50
  muted: "#f5f5f5", // neutral-100
  text: "#0a0a0a",
  secondary: "#616161",
} as const

/** Neutral steps usable in UI and inside simulations. */
export const neutral = {
  white: "#fafafa",
  light: "#d4d4d4",
  mid: "#a3a3a3",
  dim: "#737373",
  dark: "#404040",
} as const

/**
 * The only hues, simulations only: Tailwind green/yellow/red-400, the steps
 * that read well on Coody's neutral-950 background.
 */
export const sim = {
  green: "#05df72", // success, valid, grounded, goal, normals
  yellow: "#fdc700", // moving thing, energy, velocity (dashed), highlight
  red: "#ff6467", // force, error, contact, danger
} as const
