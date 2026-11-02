import { Link, useLocation } from "react-router-dom"

import { PoweredByCoody } from "@/components/coody/powered-by"
import { SubscribeForm } from "@/components/subscribe-form"
import { siteConfig } from "@/config/site"

export function SiteFooter() {
  const { pathname } = useLocation()
  return (
    <footer className="mt-24 border-t border-white/[0.08]">
      {pathname !== "/updates" && (
        <section
          aria-labelledby="updates-title"
          className="container grid gap-6 border-b border-white/[0.08] py-12 md:grid-cols-[1fr_minmax(0,28rem)] md:items-center"
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
      )}
      <div className="container grid gap-10 pt-12 pb-28 md:grid-cols-[1fr_auto]">
        <div className="max-w-md space-y-3">
          <Link to="/" className="font-heading text-lg" aria-label="GDCS home">
            GDCS · {siteConfig.longName}
          </Link>
          <p className="text-sm text-muted-foreground">{siteConfig.tagline}.</p>
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
            <a href={siteConfig.repo} className="link-quiet" rel="noopener">
              Source
            </a>
          </nav>
        </div>
        <PoweredByCoody
          source="gdcs"
          className="md:[--coody-pb-align:flex-end]"
        />
      </div>
    </footer>
  )
}
