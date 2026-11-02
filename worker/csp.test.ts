import { describe, expect, it } from "vite-plus/test"

import { withScriptNonce } from "./csp"

const CSP = "default-src 'self'; script-src 'self' https://x.test"
const page = (type: string, csp = CSP) =>
  new Response("<p>hi</p>", {
    status: 404,
    headers: { "Content-Type": type, "Content-Security-Policy": csp },
  })
const nonceOf = (r: Response) =>
  /'nonce-([^']+)'/.exec(r.headers.get("Content-Security-Policy") ?? "")?.[1]

describe("withScriptNonce", () => {
  it("adds a nonce to script-src of HTML and keeps the rest", async () => {
    const res = withScriptNonce(page("text/html; charset=utf-8"))
    expect(nonceOf(res)).toBeTruthy()
    expect(res.headers.get("Content-Security-Policy")).toContain(
      "default-src 'self'; script-src 'self' 'nonce-"
    )
    expect(res.headers.get("Content-Security-Policy")).toContain(
      "https://x.test"
    )
    expect(res.status).toBe(404)
    expect(await res.text()).toBe("<p>hi</p>")
  })
  it("uses a new nonce for every response", () => {
    const a = nonceOf(withScriptNonce(page("text/html")))
    const b = nonceOf(withScriptNonce(page("text/html")))
    expect(a).not.toBe(b)
  })
  it("leaves non-HTML untouched", () => {
    const original = page("text/markdown")
    expect(withScriptNonce(original)).toBe(original)
  })
})
