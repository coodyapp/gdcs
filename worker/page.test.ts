import { describe, expect, it } from "vite-plus/test"

import { preparePage } from "./page"

const req = (encoding = "br, gzip") =>
  new Request("https://x.test/", { headers: { "Accept-Encoding": encoding } })
const page = (headers: Record<string, string> = {}, status = 200) =>
  new Response(status === 304 ? null : "<p>hi</p>", {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0",
      "Content-Length": "9",
      ...headers,
    },
  })

describe("preparePage", () => {
  it("opts HTML out of edge transforms and keeps the cache policy", () => {
    const res = preparePage(req(), page())
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=0, no-transform"
    )
  })
  it("asks for brotli, then gzip, then nothing", () => {
    expect(preparePage(req(), page()).headers.get("Content-Encoding")).toBe(
      "br"
    )
    expect(
      preparePage(req("gzip"), page()).headers.get("Content-Encoding")
    ).toBe("gzip")
    const plain = preparePage(req("identity"), page())
    expect(plain.headers.has("Content-Encoding")).toBe(false)
    expect(plain.headers.get("Content-Length")).toBe("9")
  })
  it("drops the stale length and varies on encoding when compressing", () => {
    const res = preparePage(req(), page())
    expect(res.headers.has("Content-Length")).toBe(false)
    expect(res.headers.get("Vary")).toContain("Accept-Encoding")
  })
  it("keeps an encoding the asset already has", () => {
    const res = preparePage(req(), page({ "Content-Encoding": "gzip" }))
    expect(res.headers.get("Content-Encoding")).toBe("gzip")
  })
  it("keeps status, and does not claim an encoding on an empty 304", () => {
    const res = preparePage(req(), page({}, 304))
    expect(res.status).toBe(304)
    expect(res.headers.has("Content-Encoding")).toBe(false)
  })
  it("leaves non-HTML untouched", () => {
    const original = new Response("# hi", {
      headers: { "Content-Type": "text/markdown" },
    })
    expect(preparePage(req(), original)).toBe(original)
  })
})

describe("framing under /embed", () => {
  const CSP = "default-src 'self'; frame-ancestors *; object-src 'none'"
  const at = (path: string, status = 200) =>
    preparePage(
      new Request(`https://x.test${path}`),
      page({ "Content-Security-Policy": CSP }, status)
    ).headers.get("Content-Security-Policy")

  it("stays open for a real embed page", () => {
    expect(at("/embed/rollback-netcode")).toBe(CSP)
    expect(at("/embed/rollback-netcode", 304)).toBe(CSP)
  })
  it.each([
    ["an unknown embed", "/embed/no-such-sheet", 404],
    ["a deeper path", "/embed/a/b", 404],
    ["a deeper path that somehow exists", "/embed/a/b", 200],
    ["an unexpected file name", "/embed/Rollback.html", 200],
  ])("is refused for %s", (_, path, status) => {
    expect(at(path, status)).toBe(
      "default-src 'self'; frame-ancestors 'none'; object-src 'none'"
    )
  })
  it("leaves other pages alone", () => {
    expect(at("/about")).toBe(CSP)
  })
})
