import type { Tex } from "./types"

/**
 * Marks a TeX formula: tex`\frac{a}{b}`. The `katex` build plugin replaces
 * every call with `{ tex, html }` holding pre-rendered KaTeX HTML, so no math
 * library ships to the browser. This runtime fallback only keeps the source.
 */
export function tex(strings: TemplateStringsArray): Tex {
  return { tex: strings.raw.join(""), html: "" }
}
