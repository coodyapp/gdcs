import { describe, expect, it } from "vite-plus/test"

import { sheets } from "@/content"
import {
  facetCounts,
  highlightParts,
  searchFiltered,
  searchSheets,
  type SheetFilters,
} from "@/lib/search"
import { SEARCH_SUGGESTIONS } from "@/components/sheet-search-data"

const none: SheetFilters = {
  query: "",
  categories: [],
  subcategory: "",
  level: "all",
  sort: "relevance",
}

describe("searchFiltered", () => {
  it("returns everything with no filters", () => {
    expect(searchFiltered(sheets, none)).toEqual(sheets)
  })

  it("keeps only the chosen category, subcategory and level", () => {
    const found = searchFiltered(sheets, {
      ...none,
      categories: ["physics"],
      subcategory: "mechanics",
      level: "core",
    })
    expect(found.length).toBeGreaterThan(0)
    for (const s of found) {
      expect(s.category).toBe("physics")
      expect(s.subcategory).toBe("mechanics")
      expect(s.level).toBe("core")
    }
  })

  it("combines a query with filters", () => {
    const physics = searchFiltered(sheets, {
      ...none,
      query: "force",
      categories: ["physics"],
    })
    expect(physics.length).toBeGreaterThan(0)
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

  it("sorts on request and leaves relevance order alone otherwise", () => {
    const az = searchFiltered(sheets, { ...none, sort: "az" }).map(
      (s) => s.title
    )
    expect(az).toEqual([...az].sort((a, b) => a.localeCompare(b)))
    const easiest = searchFiltered(sheets, { ...none, sort: "easiest" })
    expect(easiest[0].level).toBe("core")
    expect(easiest.at(-1)?.level).toBe("advanced")
    expect(searchFiltered(sheets, { ...none, query: "lerp" })).toEqual(
      searchSheets(sheets, "lerp", sheets.length)
    )
  })
})

describe("facetCounts", () => {
  const cases: SheetFilters[] = [
    none,
    { ...none, query: "force" },
    { ...none, level: "core" },
    { ...none, categories: ["physics"] },
    { ...none, categories: ["physics"], subcategory: "mechanics" },
    { ...none, query: "a", categories: ["ai"], level: "common" },
  ]

  it.each(cases)("every count equals what clicking it shows: %j", (f) => {
    const counts = facetCounts(sheets, f)
    for (const [category, n] of Object.entries(counts.categories))
      expect(
        searchFiltered(sheets, {
          ...f,
          categories: [category],
          subcategory: "",
        }).filter((s) => s.category === category).length
      ).toBe(
        f.subcategory
          ? searchFiltered(sheets, {
              ...f,
              categories: [category],
              subcategory: "",
            }).length
          : n
      )
    for (const [level, n] of Object.entries(counts.levels))
      expect(
        searchFiltered(sheets, { ...f, level: level as SheetFilters["level"] })
          .length
      ).toBe(n)
    for (const [subcategory, n] of Object.entries(counts.subcategories))
      expect(searchFiltered(sheets, { ...f, subcategory }).length).toBe(n)
  })
})

describe("highlightParts", () => {
  it("marks matching words, any case, and keeps the title intact", () => {
    const parts = highlightParts("Lerp and Smoothstep", "lerp smooth")
    expect(parts.map((p) => p.text).join("")).toBe("Lerp and Smoothstep")
    expect(parts.filter((p) => p.match).map((p) => p.text)).toEqual([
      "Lerp",
      "Smooth",
    ])
  })

  it("is safe with regex characters and empty text", () => {
    expect(highlightParts("A* Pathfinding", "a*")[0]).toEqual({
      text: "A*",
      match: true,
    })
    expect(highlightParts("Vectors", "  ")).toEqual([
      { text: "Vectors", match: false },
    ])
  })
})

describe("search suggestions", () => {
  it.each(SEARCH_SUGGESTIONS)("%s finds a sheet", (term) => {
    expect(searchSheets(sheets, term).length).toBeGreaterThan(0)
  })
})
