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
    expect(read("public/_headers")).toContain(`'sha256-${hash}'`)
  })
})
