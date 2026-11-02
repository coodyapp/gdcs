import type { CSSProperties } from "react"

/** CSS variable holding a category's accent (see globals.css `--color-cat-*`). */
export const catColor = (category: string) =>
  `var(--color-cat-${category}, var(--color-text-3))`

/** Inline style that sets `--cat` for `.cat-dot`, borders and the progress bar. */
export const catStyle = (category: string) =>
  ({ "--cat": catColor(category) }) as CSSProperties
