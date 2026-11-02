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
