import { describe, expect, it } from "vite-plus/test"

import { applyHead, inlineHeroPoster, robots, sitemap } from "./prerender"

const shell = `<html><head>
<title>x</title>
<meta name="description" content="x" />
<meta name="robots" content="index,follow" />
<link rel="canonical" href="https://gdcs.coody.app" />
<meta property="og:type" content="website" />
<meta property="og:url" content="x" />
<meta property="og:title" content="x" />
<meta property="og:description" content="x" />
<meta name="twitter:title" content="x" />
<meta name="twitter:description" content="x" />
</head><body><div id="root"></div></body></html>`

describe("inlineHeroPoster", () => {
  it("moves only the phone hero poster into the page", () => {
    const html = inlineHeroPoster(
      `<source media="(max-width: 639px)" srcSet="/posters/fibers-hero-phone.webp"/><img src="/posters/fibers-hero.webp"/>`,
      Buffer.from("x")
    )
    expect(html).toContain('srcSet="data:image/webp;base64,eA=="')
    expect(html).toContain('src="/posters/fibers-hero.webp"')
  })
})

describe("embed pages", () => {
  const html = applyHead(shell, {
    title: "x",
    description: "d",
    path: "/embed/x",
    type: "website",
    jsonLd: [],
    noindex: true,
    canonical: false,
    updated: "2026-11-02",
  })
  it("have noindex and no canonical", () => {
    expect(html).toContain('content="noindex,follow"')
    expect(html).not.toContain('rel="canonical"')
  })
})

describe("robots", () => {
  it("welcomes crawlers, embeds included, and points at the license", () => {
    expect(robots()).toContain("/license")
    expect(robots()).not.toContain("Disallow: /embed")
  })
})

describe("applyHead", () => {
  const html = applyHead(shell, {
    title: 'A "quoted" <title>',
    description: "desc & more",
    path: "/physics/mechanics/projectile-motion",
    type: "article",
    jsonLd: [{ "@type": "Thing", name: "</script><script>alert(1)</script>" }],
    markdown: "/physics/mechanics/projectile-motion.md",
    updated: "2026-11-01",
  })
  it("escapes and sets per-route tags", () => {
    expect(html).toContain("<title>A &quot;quoted&quot; &lt;title&gt;</title>")
    expect(html).toContain(
      '<link rel="canonical" href="https://gdcs.coody.app/physics/mechanics/projectile-motion" />'
    )
    expect(html).toContain('content="desc &amp; more"')
    expect(html).toContain('type="text/markdown"')
  })
  it("cannot break out of JSON-LD", () => {
    expect(html).not.toContain("</script><script>alert(1)")
    expect(html).toContain("\\u003c/script>")
  })
  it("fails loudly when the shell changes", () => {
    expect(() =>
      applyHead("<html></html>", {
        title: "",
        description: "",
        path: "/",
        type: "website",
        jsonLd: [],
        updated: "",
      })
    ).toThrow()
  })
})

describe("sitemap/robots", () => {
  it("emits absolute URLs and lastmod", () => {
    const xml = sitemap([
      { path: "/", updated: "2026-11-01" },
      { path: "/physics", updated: "2026-11-01" },
    ])
    expect(xml).toContain("<loc>https://gdcs.coody.app</loc>")
    expect(xml).toContain(
      "<loc>https://gdcs.coody.app/physics</loc><lastmod>2026-11-01</lastmod>"
    )
  })
  it("welcomes AI crawlers and points at the sitemap", () => {
    const txt = robots()
    expect(txt).toContain("User-agent: GPTBot")
    expect(txt).toContain("User-agent: ClaudeBot")
    expect(txt).toContain("Sitemap: https://gdcs.coody.app/sitemap.xml")
  })
})
