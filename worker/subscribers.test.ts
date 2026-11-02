import { describe, expect, it } from "vite-plus/test"

import { HttpError, token } from "./http"
import { cleanSource, isBot, isToken, parseEmail } from "./subscribers"

describe("parseEmail", () => {
  it("normalizes valid addresses", () => {
    expect(parseEmail("  Dev@Studio.IO ")).toBe("dev@studio.io")
    expect(parseEmail("a.b+tag@sub.example.co.uk")).toBe(
      "a.b+tag@sub.example.co.uk"
    )
  })
  it.each([
    "",
    "no-at",
    "a@b",
    "a@@b.com",
    "a b@c.com",
    "<x>@y.com",
    42,
    null,
    `${"a".repeat(250)}@b.com`,
  ])("rejects %s", (value) => {
    expect(() => parseEmail(value)).toThrow(HttpError)
  })
})

describe("helpers", () => {
  it("detects the honeypot", () => {
    expect(isBot({ website: "spam" })).toBe(true)
    expect(isBot({ website: "" })).toBe(false)
    expect(isBot({})).toBe(false)
  })
  it("keeps only same-site source paths", () => {
    expect(cleanSource("/physics")).toBe("/physics")
    expect(cleanSource("https://evil.com")).toBe("")
  })
  it("generates unique URL-safe tokens that validate", () => {
    const a = token()
    const b = token()
    expect(a).not.toBe(b)
    expect(isToken(a)).toBe(true)
    expect(isToken("short")).toBe(false)
    expect(isToken("bad token with spaces and more chars")).toBe(false)
  })
})
