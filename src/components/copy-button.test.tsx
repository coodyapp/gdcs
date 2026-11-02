import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vite-plus/test"

import { CopyButton } from "./copy-button"

describe("CopyButton", () => {
  it("starts disabled, because a click before hydration would do nothing", () => {
    const html = renderToStaticMarkup(<CopyButton label="Copy" text="x" />)
    expect(html).toMatch(/<button[^>]*\bdisabled/)
  })
})
