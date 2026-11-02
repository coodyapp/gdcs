import { describe, expect, it } from "vite-plus/test"

import { allPaths, headFor } from "@/lib/seo"
import { hasVisual } from "@/visuals/registry"

import { fullSheets } from "./full"
import { categories, getSheet, sheetPath, sheets } from "./index"
import { llmsTxt, sheetMarkdown } from "./markdown"

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const RESERVED = new Set([
  "about",
  "privacy",
  "paths",
  "updates",
  "api",
  "assets",
  "llms",
  "feed",
  "sitemap",
])

describe("taxonomy", () => {
  it("has unique, valid, non-reserved slugs", () => {
    const cats = categories.map((c) => c.slug)
    expect(new Set(cats).size).toBe(cats.length)
    for (const c of categories) {
      expect(c.slug).toMatch(SLUG)
      expect(RESERVED.has(c.slug)).toBe(false)
      const subs = c.subcategories.map((s) => s.slug)
      expect(new Set(subs).size).toBe(subs.length)
      subs.forEach((s) => expect(s).toMatch(SLUG))
    }
  })
})

describe.each(fullSheets.map((s) => [s.slug, s] as const))(
  "sheet %s",
  (_, sheet) => {
    it("lives in a known category and subcategory", () => {
      const c = categories.find((x) => x.slug === sheet.category)
      expect(c, `category ${sheet.category}`).toBeDefined()
      expect(
        c!.subcategories.some((s) => s.slug === sheet.subcategory),
        `subcategory ${sheet.subcategory}`
      ).toBe(true)
    })

    it("has a valid slug and date", () => {
      expect(sheet.slug).toMatch(SLUG)
      expect(sheet.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it("has SEO-sized text", () => {
      expect(sheet.title.length).toBeLessThanOrEqual(60)
      expect(
        sheet.summary.length,
        "summary 70–160 chars"
      ).toBeGreaterThanOrEqual(70)
      expect(sheet.summary.length, "summary 70–160 chars").toBeLessThanOrEqual(
        160
      )
      expect(sheet.hook.length).toBeGreaterThan(5)
    })

    it("is complete", () => {
      expect(sheet.what.length).toBeGreaterThanOrEqual(2)
      expect(sheet.code.length).toBeGreaterThanOrEqual(1)
      expect(sheet.mistakes.length).toBeGreaterThanOrEqual(3)
      expect(sheet.prompt.length).toBeGreaterThan(120)
      expect(sheet.tags.length).toBeGreaterThanOrEqual(2)
      expect(sheet.visual.length).toBeGreaterThan(40)
      expect(
        (sheet.formulas?.length ?? 0) + (sheet.rules?.length ?? 0)
      ).toBeGreaterThan(0)
    })

    it("has an interactive visual", () => {
      expect(
        hasVisual(sheet.slug),
        `src/visuals/scenes/**/${sheet.slug}.tsx`
      ).toBe(true)
    })

    it("links only to existing sheets", () => {
      for (const slug of sheet.related)
        expect(getSheet(slug), `related ${slug}`).toBeDefined()
      for (const r of sheet.reading) expect(r.url).toMatch(/^https:\/\//)
    })

    it("renders formulas with KaTeX at build time", () => {
      for (const f of sheet.formulas ?? [])
        expect(f.math.html, f.label).toContain("katex")
    })

    it("internal links in text point at real pages", () => {
      const paths = new Set(allPaths())
      const text = [
        ...sheet.what,
        ...(sheet.rules ?? []),
        ...sheet.mistakes,
        sheet.visual,
      ].join(" ")
      for (const [, href] of text.matchAll(/\]\((\/[^)]*)\)/g))
        expect(paths.has(href), href).toBe(true)
    })

    it("produces Markdown and an indexable head", () => {
      const md = sheetMarkdown(sheet)
      expect(md.startsWith(`# ${sheet.title}`)).toBe(true)
      const head = headFor(sheetPath(sheet))
      expect(head.noindex).toBeFalsy()
      expect(head.markdown).toBe(`${sheetPath(sheet)}.md`)
    })
  }
)

describe("site", () => {
  it("loads a full body for every sheet's metadata", () => {
    expect(fullSheets).toHaveLength(sheets.length)
    for (const s of sheets)
      expect(
        fullSheets.find((f) => f.slug === s.slug),
        s.slug
      ).toBeDefined()
  })

  it("has unique sheet slugs and titles", () => {
    expect(new Set(sheets.map((s) => s.slug)).size).toBe(sheets.length)
    expect(new Set(sheets.map((s) => s.title)).size).toBe(sheets.length)
  })

  it("lists every sheet in llms.txt", () => {
    const txt = llmsTxt()
    for (const s of sheets) expect(txt).toContain(`${sheetPath(s)}.md`)
  })

  it("never names the external topic reference", () => {
    const corpus = JSON.stringify(fullSheets).toLowerCase()
    expect(corpus).not.toMatch(/gamedev-cheatsheet|zullo/)
  })

  it("returns 404 heads for unknown paths", () => {
    expect(headFor("/nope").noindex).toBe(true)
    expect(headFor("/physics/nope").noindex).toBe(true)
    expect(headFor("/physics/mechanics/nope").noindex).toBe(true)
  })
})

describe("brand colours", () => {
  const allowed = new Set([
    "#fafafa",
    "#a3a3a3",
    "#d4d4d4",
    "#fdc700",
    "#05df72",
    "#ff6467",
  ])
  it.each(fullSheets.map((s) => [s.slug, s] as const))(
    "%s formulas use only brand simulation colours",
    (_, sheet) => {
      for (const f of sheet.formulas ?? []) {
        for (const [, hex] of f.math.tex.matchAll(
          /\\textcolor\{(#[0-9a-fA-F]{6})\}/g
        )) {
          expect(allowed.has(hex.toLowerCase()), `${f.label}: ${hex}`).toBe(
            true
          )
        }
      }
    }
  )
})
