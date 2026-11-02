import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vite-plus/test"

const root = path.resolve(import.meta.dirname, "..")
const read = (file: string) => readFileSync(path.join(root, file), "utf8")

describe("theme script", () => {
  it("is allowed by the CSP hash, or the page would flash and log errors", () => {
    const script = /<script>(.*?)<\/script>/s.exec(read("index.html"))?.[1]
    expect(script).toBeTruthy()
    const hash = createHash("sha256").update(script!).digest("base64")
    const policies = read("public/_headers")
      .split("\n")
      .filter((line) => line.includes("Content-Security-Policy: "))
    expect(policies).toHaveLength(2)
    for (const policy of policies) expect(policy).toContain(`'sha256-${hash}'`)
  })
})

describe("framing", () => {
  const blocks = read("public/_headers").split(/\n\n+/)
  const block = (start: string) => blocks.find((b) => b.includes(`${start}\n`))!

  it("is refused everywhere except embeds", () => {
    expect(block("/*")).toContain("frame-ancestors 'none'")
    expect(block("/embed/*")).toContain("! Content-Security-Policy")
    expect(block("/embed/*")).toContain("frame-ancestors *")
  })

  it("keeps embeds out of search results", () => {
    expect(block("/embed/*")).toContain("X-Robots-Tag: noindex")
  })

  it("points every page at the license", () => {
    expect(block("/*")).toContain('</license>; rel="license"')
    expect(read("index.html")).toContain('<link rel="license" href="/license"')
  })
})
