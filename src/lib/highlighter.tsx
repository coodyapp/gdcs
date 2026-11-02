import * as React from "react"
import {
  createHighlighterCore,
  type GrammarState,
  type HighlighterCore,
} from "shiki/core"
import { createJavaScriptRegexEngine } from "shiki/engine/javascript"

// Add the languages you need. Each one loads the first time it is used.
const languages = {
  bash: () => import("shiki/langs/shellscript.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  glsl: () => import("shiki/langs/glsl.mjs"),
  diff: () => import("shiki/langs/diff.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  javascript: () => import("shiki/langs/javascript.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  jsx: () => import("shiki/langs/jsx.mjs"),
  markdown: () => import("shiki/langs/markdown.mjs"),
  python: () => import("shiki/langs/python.mjs"),
  sql: () => import("shiki/langs/sql.mjs"),
  tsx: () => import("shiki/langs/tsx.mjs"),
  typescript: () => import("shiki/langs/typescript.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
}

const aliases: Record<string, keyof typeof languages> = {
  js: "javascript",
  md: "markdown",
  py: "python",
  sh: "bash",
  shell: "bash",
  shellscript: "bash",
  ts: "typescript",
  yml: "yaml",
  zsh: "bash",
}

/**
 * Coody-neutral syntax theme: hierarchy through white/grey steps and weight,
 * no hues (colour is reserved for simulations). All ≥ 4.5:1 on code surfaces.
 */
const gdcsTheme = {
  name: "gdcs",
  type: "dark" as const,
  colors: { "editor.background": "#00000000", "editor.foreground": "#d4d4d4" },
  settings: [
    { settings: { foreground: "#d4d4d4" } },
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#a3a3a3", fontStyle: "italic" },
    },
    {
      scope: ["keyword", "storage", "storage.type", "storage.modifier"],
      settings: { foreground: "#fafafa" },
    },
    {
      scope: [
        "entity.name.function",
        "support.function",
        "entity.name.type",
        "support.class",
        "constant.numeric",
        "constant.language",
      ],
      settings: { foreground: "#fafafa" },
    },
    {
      scope: ["string", "string.quoted", "constant.other.symbol"],
      settings: { foreground: "#a3a3a3" },
    },
    {
      scope: ["punctuation", "keyword.operator", "meta.brace"],
      settings: { foreground: "#a3a3a3" },
    },
  ],
}

let highlighter: Promise<HighlighterCore> | undefined

function getHighlighter() {
  highlighter ??= createHighlighterCore({
    themes: [gdcsTheme],
    langs: [],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  })

  return highlighter
}

function getLanguage(language: string) {
  const name = language.toLowerCase()

  if (name === "ansi") {
    return name
  }

  if (name in languages) {
    return name as keyof typeof languages
  }

  return aliases[name] ?? null
}

// Loads a language and returns a highlighter for it, or null for a language
// that is not listed.
export async function loadHighlighter(language: string) {
  const lang = getLanguage(language)

  if (!lang) {
    return null
  }

  const shiki = await getHighlighter()

  if (lang !== "ansi" && !shiki.getLoadedLanguages().includes(lang)) {
    await shiki.loadLanguage(languages[lang])
  }

  return {
    // Returns one React node per line, and the grammar state after the last
    // line. Pass that state back to continue where the code left off.
    highlight(code: string, state?: GrammarState) {
      const tokenize = (text: string) =>
        shiki.codeToTokens(text, {
          lang,
          themes: { light: "gdcs", dark: "gdcs" },
          defaultColor: false,
          grammarState: state,
        }).tokens

      // ANSI has no grammar state, so each line is tokenized on its own and
      // gets the same colors whether it arrives in one piece or streams.
      const tokens =
        lang === "ansi"
          ? code.split("\n").flatMap((line) => tokenize(line))
          : tokenize(code)

      return {
        lines: tokens.map((line) =>
          line.map((token, index) => (
            <span
              key={index}
              style={token.htmlStyle as React.CSSProperties}
              className="text-(--shiki-light) dark:text-(--shiki-dark)"
            >
              {token.content}
            </span>
          ))
        ),
        state: shiki.getLastGrammarState(tokens),
      }
    },
  }
}

// Returns one React node per line, or null for a language that is not listed.
export async function highlightCode(code: string, language: string) {
  const highlighter = await loadHighlighter(language)

  return highlighter ? highlighter.highlight(code).lines : null
}
