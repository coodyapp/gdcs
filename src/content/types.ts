/**
 * Content model. Everything the site publishes (HTML, Markdown, llms.txt,
 * JSON-LD, sitemap, email digest) is generated from these plain objects, so
 * they must stay free of React and browser APIs.
 */

export type Level = "core" | "common" | "advanced"

/** A formula whose TeX is rendered to HTML at build time (see `tex`). */
export interface Tex {
  tex: string
  /** KaTeX HTML, filled in by the build plugin; empty in raw contexts. */
  html: string
}

export interface Formula {
  label: string
  math: Tex
  /** Optional one-line note shown under the formula. */
  note?: string
}

export interface CodeBlock {
  lang: "ts" | "glsl" | "pseudo"
  code: string
  caption?: string
}

export interface Reference {
  title: string
  url: string
}

export interface Sheet {
  /** Globally unique, lowercase kebab-case. Part of the public URL. */
  slug: string
  category: string
  subcategory: string
  title: string
  /** Short imperative hook, e.g. "ask a line what it hits". */
  hook: string
  /** One or two sentences, 70–160 characters: meta description and card text. */
  summary: string
  level: Level
  tags: string[]
  /** ISO date (YYYY-MM-DD) of the last meaningful content change. */
  updated: string
  /** 2–4 short paragraphs. Inline `code`, **bold** and [links](/path) allowed. */
  what: string[]
  formulas?: Formula[]
  /** Rules of thumb / typical numbers. */
  rules?: string[]
  code: CodeBlock[]
  mistakes: string[]
  /** Ready-to-paste prompt for an AI coding assistant. */
  prompt: string
  /** Slugs of related sheets. */
  related: string[]
  reading: Reference[]
  /** What the interactive visual shows and how to use it. */
  visual: string
}

/** The light part of a sheet, shipped in the main bundle (cards, search, SEO). */
export type SheetMeta = Pick<
  Sheet,
  | "slug"
  | "category"
  | "subcategory"
  | "title"
  | "hook"
  | "summary"
  | "level"
  | "tags"
  | "updated"
  | "related"
  | "prompt"
>

export interface Subcategory {
  slug: string
  title: string
  description: string
}

export interface Category {
  slug: string
  title: string
  description: string
  subcategories: Subcategory[]
}
