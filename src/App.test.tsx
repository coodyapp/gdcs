import { renderToString } from "react-dom/server"
import { StaticRouter } from "react-router-dom"
import { describe, expect, it } from "vite-plus/test"

import { App } from "@/App"

const at = (url: string) =>
  renderToString(
    <StaticRouter location={url}>
      <App />
    </StaticRouter>
  )

describe("routes under /embed", () => {
  it("renders a simulation without the site layout", () => {
    const html = at("/embed/rollback-netcode")
    expect(html).toContain("Powered by GDCS")
    expect(html).not.toContain('type="email"')
  })

  it.each([
    "/embed/no-such-sheet",
    "/embed/a/b",
    "/embed/a/b/c",
    "/embed/rollback-netcode/extra",
  ])("%s shows only the not-found message", (url) => {
    const html = at(url)
    expect(html).toContain("This simulation does not exist")
    expect(html).not.toContain('type="email"')
    expect(html).not.toContain("Powered by GDCS")
  })

  it("still routes three-segment addresses to sheets elsewhere", () => {
    expect(at("/a/b/c")).toContain('type="email"')
  })
})
