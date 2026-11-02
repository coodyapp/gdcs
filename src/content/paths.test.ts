import { describe, expect, it } from "vite-plus/test"

import { categories, getSheet } from "./index"
import { paths } from "./paths"

describe("learning paths", () => {
  it.each(paths.map((p) => [p.slug, p] as const))("%s is valid", (_, path) => {
    expect(path.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    expect(path.summary.length).toBeGreaterThanOrEqual(70)
    expect(path.summary.length).toBeLessThanOrEqual(160)
    expect(categories.some((c) => c.slug === path.accent)).toBe(true)
    expect(path.steps.length).toBeGreaterThanOrEqual(5)
    expect(new Set(path.steps.map((s) => s.slug)).size).toBe(path.steps.length)
    for (const step of path.steps)
      expect(getSheet(step.slug), step.slug).toBeDefined()
  })
  it("has unique slugs", () => {
    expect(new Set(paths.map((p) => p.slug)).size).toBe(paths.length)
  })
})
