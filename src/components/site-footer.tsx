import { Link } from "react-router-dom"
import { ArrowUp } from "lucide-react"

import { PoweredByCoody } from "@/components/coody/powered-by"
import { SubscribeForm } from "@/components/subscribe-form"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { siteConfig } from "@/config/site"

export function SiteFooter() {
  return (
    <footer className="mt-24">
      <Separator />
      <section
        aria-labelledby="updates-title"
        className="container grid gap-6 py-12 md:grid-cols-[1fr_minmax(0,28rem)] md:items-center"
      >
        <div>
          <p className="eyebrow mb-2">Get updates</p>
          <h2 id="updates-title" className="font-heading text-2xl">
            New cheat sheets, in your inbox
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            An occasional digest when new visual sheets are published. Double
            opt-in, one-click unsubscribe, no tracking.
          </p>
        </div>
        <SubscribeForm compact />
      </section>
      <div className="container grid gap-10 py-12 md:grid-cols-[1fr_auto]">
        <div className="max-w-md space-y-3">
          <Link to="/" className="font-heading text-lg" aria-label="GDCS home">
            GDCS · {siteConfig.longName}
          </Link>
          <p className="text-sm text-muted-foreground">
            {siteConfig.tagline}.{" "}
            <a
              href={siteConfig.changelog}
              className="link-quiet font-hud text-xs"
              rel="noopener"
              title="Changelog"
            >
              v{siteConfig.version}
            </a>
          </p>
          <nav
            aria-label="Footer"
            className="flex flex-wrap gap-x-5 gap-y-2 text-sm"
          >
            <Link to="/" className="link-quiet">
              All sheets
            </Link>
            <Link to="/paths" className="link-quiet">
              Learning paths
            </Link>
            <Link to="/about" className="link-quiet">
              About
            </Link>
            <a href="/llms.txt" className="link-quiet">
              llms.txt
            </a>
            <a href="/llms-full.txt" className="link-quiet">
              llms-full.txt
            </a>
            <a href="/sitemap.xml" className="link-quiet">
              Sitemap
            </a>
            <Link to="/privacy" className="link-quiet">
              Privacy policy
            </Link>
            <a
              href="https://x.com/augustobr1to"
              className="link-quiet"
              rel="noopener me"
            >
              X · @augustobr1to
            </a>
          </nav>
        </div>
        <div className="flex flex-col items-start gap-6 md:items-end">
          <BackToTop />
          <PoweredByCoody
            source="gdcs"
            className="md:[--coody-pb-align:flex-end]"
          />
        </div>
      </div>
    </footer>
  )
}

function BackToTop() {
  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-full"
      nativeButton={false}
      render={<a href="#main" />}
      onClick={(e) => {
        e.preventDefault()
        const reduce = window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })
        document.getElementById("main")?.focus({ preventScroll: true })
      }}
    >
      <ArrowUp aria-hidden /> Back to top
    </Button>
  )
}
