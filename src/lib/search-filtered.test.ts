import { describe, expect, it } from "vite-plus/test"

import { sheets } from "@/content"
import { searchFiltered } from "@/lib/search"

const none = { query: "", categories: [], level: "all" as const }

describe("searchFiltered", () => {
  it("returns everything with no filters", () => {
    expect(searchFiltered(sheets, none)).toEqual(sheets)
  })

  it("keeps only the chosen categories and level", () => {
    const found = searchFiltered(sheets, {
      ...none,
      categories: ["physics"],
      level: "core",
    })
    expect(found.length).toBeGreaterThan(0)
    for (const s of found) {
      expect(s.category).toBe("physics")
      expect(s.level).toBe("core")
    }
  })

  it("combines a query with filters", () => {
    const all = searchFiltered(sheets, { ...none, query: "force" })
    const physics = searchFiltered(sheets, {
      ...none,
      query: "force",
      categories: ["physics"],
    })
    expect(physics.length).toBeGreaterThan(0)
    expect(physics.length).toBeLessThanOrEqual(all.length)
    expect(physics.every((s) => s.category === "physics")).toBe(true)
  })

  it("does not cut off long result lists", () => {
    // "a" matches nearly every sheet, far above the palette's limit of 12.
    expect(
      searchFiltered(sheets, { ...none, query: "a" }).length
    ).toBeGreaterThan(12)
  })

  it("finds nothing for nonsense", () => {
    expect(searchFiltered(sheets, { ...none, query: "zzzzqqq" })).toEqual([])
  })
})
