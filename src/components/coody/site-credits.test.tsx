import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vite-plus/test"

import { SiteCredits } from "./site-credits"

describe("SiteCredits", () => {
  it("shows the quote, tagline, year and owner, then Back to top", () => {
    const html = renderToStaticMarkup(<SiteCredits />)
    expect(html).not.toContain("Brazil")
    expect(html).toContain("standing on the shoulders of giants.”</blockquote>")
    expect(html).toContain("<figcaption>— Newton</figcaption>")
    expect(html).toContain(
      "Built on the shoulders of those who came before us."
    )
    expect(html).toContain(String(new Date().getFullYear()))
    expect(html).toContain('href="https://coody.app"')
    expect(html).toContain('href="#main"')
    const order = [
      "giants",
      "Newton",
      "came before us",
      "coody.app",
      "Back to top",
    ].map((t) => html.indexOf(t))
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
