import { describe, expect, it } from "vite-plus/test"

import source from "../../CHANGELOG.md?raw"
import { parseChangelog, renderChangelogPage } from "./changelog"

const SAMPLE = `# Changelog

Intro with \`code\`.

## [Unreleased]

## [1.2.0] - 2026-11-02

### Added

- One
- Two

### Fixed

- Three

## [1.1.0] - 2026-11-01

- Four
`

describe("parseChangelog", () => {
  const blocks = parseChangelog(SAMPLE)

  it("drops the title and empty versions", () => {
    expect(blocks[0]).toEqual({ type: "text", text: "Intro with `code`." })
    expect(JSON.stringify(blocks)).not.toContain("Unreleased")
  })

  it("reads versions, dates, sections and lists", () => {
    expect(blocks[1]).toEqual({
      type: "version",
      name: "1.2.0",
      date: "2026-11-02",
    })
    expect(blocks[2]).toEqual({ type: "section", name: "Added" })
    expect(blocks[3]).toEqual({ type: "list", items: ["One", "Two"] })
    expect(blocks.at(-1)).toEqual({ type: "list", items: ["Four"] })
  })
})

describe("renderChangelogPage", () => {
  it("renders the real changelog with every released version", () => {
    const html = renderChangelogPage(source)
    const versions = [...source.matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm)]
    expect(versions.length).toBeGreaterThan(10)
    for (const [, version] of versions) expect(html).toContain(version)
    expect(html).toContain("<h1")
  })
})
