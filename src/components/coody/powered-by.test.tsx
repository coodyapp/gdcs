import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vite-plus/test"

import { PoweredByCoody } from "./powered-by"

describe("PoweredByCoody", () => {
  it("is one accessible link with decorative images", () => {
    const html = renderToStaticMarkup(<PoweredByCoody source="gdcs" />)
    expect(html).toContain('aria-label="Powered by Coody (opens in a new tab)"')
    expect(html).toContain(
      'href="https://coody.app/?utm_source=gdcs&amp;utm_medium=powered_by"'
    )
    expect(html.match(/<img/g)).toHaveLength(3)
    expect(html.match(/alt=""/g)).toHaveLength(3)
  })

  it("opens in a new tab", () => {
    const html = renderToStaticMarkup(<PoweredByCoody />)
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener"')
    expect(html).toContain("opens in a new tab")
  })

  it("supports a hidden caption, custom href and size", () => {
    const html = renderToStaticMarkup(
      <PoweredByCoody label="" href="https://x.test" height={20} align="end" />
    )
    expect(html).not.toContain("coody-powered-by__label")
    expect(html).toContain('href="https://x.test"')
    expect(html).toContain("--coody-pb-height:20px")
    expect(html).toContain("--coody-pb-align:flex-end")
  })
})
