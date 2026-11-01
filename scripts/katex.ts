import katex from "katex"
import type { Plugin } from "vite-plus"

/** Matches tex`...` tagged templates (no nested backticks or ${}). */
const TEX = /\btex`((?:[^`\\$]|\\.|\$(?!\{))*)`/g

/** Pre-renders a TeX string; throws on invalid TeX so the build fails. */
export function renderTex(source: string) {
  return katex.renderToString(source, {
    throwOnError: true,
    output: "html",
    strict: "error",
  })
}

/**
 * Replaces every tex`...` in content modules with `{ tex, html }`, where
 * `html` is KaTeX output rendered at build time. Browsers download only
 * KaTeX's CSS and fonts, never its JavaScript.
 */
export function katexPlugin(): Plugin {
  return {
    name: "gdcs-katex",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes("/src/content/sheets/") || !code.includes("tex`")) return
      const out = code.replace(TEX, (_, raw: string) => {
        return JSON.stringify({ tex: raw, html: renderTex(raw) })
      })
      return { code: out, map: null }
    },
  }
}
