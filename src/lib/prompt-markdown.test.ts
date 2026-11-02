import { describe, expect, it } from "vite-plus/test"

import { fullSheets } from "@/content/full"
import { promptMarkdown } from "@/lib/prompt-markdown"

describe("promptMarkdown", () => {
  it("makes a heading and one bullet per sentence", () => {
    expect(
      promptMarkdown("Lerp", "Write `lerp(a, b, t)`. Clamp t. Add a test.")
    ).toBe("# Lerp\n\n- Write `lerp(a, b, t)`.\n- Clamp t.\n- Add a test.")
  })

  it("does not split on abbreviations or numbers", () => {
    expect(
      promptMarkdown("X", "Use a cap, e.g. Three.js limits. Step 1. Then go.")
    ).toBe("# X\n\n- Use a cap, e.g. Three.js limits.\n- Step 1. Then go.")
  })

  it.each(fullSheets.map((s) => [s.slug, s] as const))(
    "%s keeps every word of its prompt",
    (_, sheet) => {
      const md = promptMarkdown(sheet.title, sheet.prompt)
      const body = md
        .split("\n")
        .slice(2)
        .map((line) => {
          expect(line.startsWith("- ")).toBe(true)
          // A fragment this short means a sentence was split in the wrong place.
          expect(line.length, line).toBeGreaterThan(14)
          return line.slice(2)
        })
        .join(" ")
      expect(body).toBe(sheet.prompt.trim().replace(/\s+/g, " "))
    }
  )
})
