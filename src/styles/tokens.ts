/**
 * Design tokens (docs/design-system.md). Single source for TypeScript (the
 * Three.js palette, tests). `globals.css` mirrors these values as
 * `--color-sim-*` / `--color-cat-*`; keep both in sync.
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

/** Semantic accents for simulations and data. */
export const sim = {
  cyan: "#2dd4ef", // subject, selection, ray, focus
  orange: "#ff9f43", // energy, heat, impulse, moving thing
  violet: "#b98cff", // secondary object, rotation
  green: "#3ee09a", // success, valid, grounded, goal, normals
  yellow: "#f5d547", // velocity, trajectory, highlight
  pink: "#f383c4", // acceleration, torque
  red: "#f65a5a", // force, error, contact
} as const

/** UI-only blue (Systems); never used in simulations. */
export const uiBlue = "#5b9dff"

export const categoryAccent: Record<string, string> = {
  threejs: sim.cyan,
  mathematics: sim.violet,
  "game-feel": sim.pink,
  systems: uiBlue,
  ai: sim.green,
  performance: sim.yellow,
  physics: sim.orange,
  animation: "#e08cf0",
}
