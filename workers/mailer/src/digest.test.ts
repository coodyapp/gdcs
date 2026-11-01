import { describe, expect, it } from "vite-plus/test"

import {
  confirmationEmail,
  digestEmail,
  newSince,
  type FeedItem,
} from "./digest"

const item = (id: string, date: string, title = id): FeedItem => ({
  id,
  url: `https://gdcs.coody.app/x/y/${id}`,
  title,
  summary: `${title} summary`,
  date_modified: date,
  tags: [],
})

describe("newSince", () => {
  const items = [
    item("a", "2026-10-01T00:00:00Z"),
    item("b", "2026-11-01T00:00:00Z"),
    item("c", "2026-11-03T00:00:00Z"),
  ]
  it("returns only items strictly newer than the cursor, newest first", () => {
    expect(newSince(items, "2026-11-01T00:00:00Z").map((i) => i.id)).toEqual([
      "c",
    ])
    expect(newSince(items, "2026-09-01T00:00:00Z").map((i) => i.id)).toEqual([
      "c",
      "b",
      "a",
    ])
  })
  it("caps the list", () => {
    expect(newSince(items, "2000-01-01", 2)).toHaveLength(2)
  })
  it("is empty when nothing changed", () => {
    expect(newSince(items, "2026-12-01")).toEqual([])
  })
})

describe("emails", () => {
  it("escapes titles and includes the unsubscribe link", () => {
    const mail = digestEmail(
      [item("x", "2026-11-01", "<b>A&B</b>")],
      "https://gdcs.coody.app/api/unsubscribe?token=t",
      "https://gdcs.coody.app"
    )
    expect(mail.html).toContain("&lt;b&gt;A&amp;B&lt;/b&gt;")
    expect(mail.html).not.toContain("<b>A&B</b>")
    expect(mail.text).toContain(
      "Unsubscribe: https://gdcs.coody.app/api/unsubscribe?token=t"
    )
    expect(mail.subject).toBe("New on GDCS: <b>A&B</b>")
  })
  it("pluralizes the subject", () => {
    expect(
      digestEmail([item("a", "1"), item("b", "2")], "u", "s").subject
    ).toBe("2 new cheat sheets on GDCS")
  })
  it("builds a confirmation email with the link", () => {
    const mail = confirmationEmail(
      "https://gdcs.coody.app/api/confirm?token=abc"
    )
    expect(mail.html).toContain("https://gdcs.coody.app/api/confirm?token=abc")
    expect(mail.text).toContain("https://gdcs.coody.app/api/confirm?token=abc")
  })
})
