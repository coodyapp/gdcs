import { existsSync, statSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vite-plus/test"

import { sheets } from "../src/content"

const dir = path.resolve(import.meta.dirname, "../public/posters")

describe("posters", () => {
  it.each(sheets.map((s) => s.slug))(
    "%s has a static poster (run `pnpm posters`)",
    (slug) => {
      const file = path.join(dir, `${slug}.webp`)
      expect(existsSync(file)).toBe(true)
      expect(statSync(file).size).toBeLessThan(150_000)
    }
  )
})
