import { describe, expect, it } from "vite-plus/test"

import { sheetPath, sheets, type SheetMeta } from "@/content"
import { sheetMarkdown } from "@/content/markdown"
import { fullSheets } from "@/content/full"
import { attributionText, embedCode, embedPath } from "@/lib/embed"
import { allPaths, embedPaths, headFor } from "@/lib/seo"

const sheet = sheets[0]

describe("embedCode", () => {
  it("frames the embed page and links to the sheet on the host page", () => {
    const code = embedCode(sheet)
    expect(code).toContain(`src="https://gdcs.coody.app/embed/${sheet.slug}"`)
    expect(code).toContain(
      `<a href="https://gdcs.coody.app${sheetPath(sheet)}">`
    )
    expect(code).toContain(`<a href="https://gdcs.coody.app/license">`)
    expect(code).toContain('loading="lazy"')
  })

  it("escapes titles so they cannot break the host page", () => {
    const code = embedCode({ ...sheet, title: 'A & "B" <c>' } as SheetMeta)
    expect(code).toContain(
      'title="A &amp; &quot;B&quot; &lt;c&gt;: interactive'
    )
    expect(code).not.toContain("<c>")
  })
})

describe("attributionText", () => {
  it("names the source, links it and states the license", () => {
    const text = attributionText(sheet)
    expect(text).toContain("GDCS")
    expect(text).toContain(`https://gdcs.coody.app${sheetPath(sheet)}`)
    expect(text).toContain("CC BY 4.0")
  })
})

describe("routes", () => {
  it("has an unindexed embed page for every sheet", () => {
    expect(embedPaths()).toHaveLength(sheets.length)
    for (const path of embedPaths()) {
      const head = headFor(path)
      expect(head.noindex).toBe(true)
      expect(head.canonical).toBe(false)
    }
  })

  it("resolves unknown embeds to not found", () => {
    expect(headFor(embedPath("no-such-sheet")).canonical).toBeUndefined()
    expect(headFor(embedPath("no-such-sheet")).noindex).toBe(true)
  })

  it("lists the license page and no embeds for search engines", () => {
    expect(allPaths()).toContain("/license")
    expect(allPaths().some((p) => p.startsWith("/embed"))).toBe(false)
    expect(headFor("/license").noindex).toBeFalsy()
  })
})

describe("license signals", () => {
  it("states the license in sheet Markdown", () => {
    const md = sheetMarkdown(fullSheets[0])
    expect(md).toContain("CC BY 4.0")
    expect(md).toContain("https://gdcs.coody.app/license")
  })

  it("states the license in sheet JSON-LD", () => {
    const article = headFor(sheetPath(sheet)).jsonLd.find(
      (o) => "headline" in o
    ) as unknown as { license: string; usageInfo: string }
    expect(article.license).toBe("https://creativecommons.org/licenses/by/4.0/")
    expect(article.usageInfo).toBe("https://gdcs.coody.app/license")
  })
})
