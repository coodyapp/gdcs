import { describe, expect, it } from "vite-plus/test"

import { sheets } from "@/content"

import { searchSheets } from "./search"

const titles = (q: string) => searchSheets(sheets, q).map((s) => s.slug)

describe("searchSheets", () => {
  it("ranks title matches first", () => {
    expect(titles("raycast")[0]).toBe("raycasting")
    expect(titles("coyote")[0]).toBe("coyote-time")
  })
  it("matches tags/hook and multiple terms", () => {
    expect(titles("slerp")).toContain("quaternions")
    expect(titles("fixed step").length).toBeGreaterThan(0)
  })
  it("tolerates accents, case and abbreviations", () => {
    expect(titles("SCHRÖDINGER")).toContain("schrodinger-2d")
    expect(titles("fxtmstp")).toContain("fixed-timestep")
  })
  it("returns nothing for empty or nonsense queries", () => {
    expect(titles("")).toEqual([])
    expect(titles("zzqqxx")).toEqual([])
  })
})
