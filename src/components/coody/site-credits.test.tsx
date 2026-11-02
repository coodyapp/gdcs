import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vite-plus/test"

import { SiteCredits } from "./site-credits"

describe("SiteCredits", () => {
  it("shows the built-in line, quote, year and owner, then Back to top", () => {
    const html = renderToStaticMarkup(<SiteCredits />)
    expect(html).toContain('aria-label="Brazil"')
    expect(html).toContain("standing on the shoulders of giants”, Newton.")
    expect(html).toContain(String(new Date().getFullYear()))
    expect(html).toContain('href="https://coody.app"')
    expect(html).toContain('href="#main"')
    const order = ["Built in", "Newton", "coody.app", "Back to top"].map((t) =>
      html.indexOf(t)
    )
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it("supports a hidden quote and a custom owner and target", () => {
    const html = renderToStaticMarkup(
      <SiteCredits
        quote=""
        owner="x.test"
        ownerHref="https://x.test"
        topTarget="top"
      />
    )
    expect(html).not.toContain("coody-credits__quote")
    expect(html).toContain('href="https://x.test"')
    expect(html).toContain('href="#top"')
  })
})
