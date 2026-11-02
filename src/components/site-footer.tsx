import { Link } from "react-router-dom"

import { PoweredByCoody } from "@/components/coody/powered-by"
import { siteConfig } from "@/config/site"

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t">
      <div className="container grid gap-10 py-12 md:grid-cols-[1fr_auto]">
        <div className="max-w-md space-y-3">
          <p className="font-heading text-lg">{siteConfig.longName}</p>
          <p className="text-sm text-muted-foreground">{siteConfig.tagline}.</p>
          <nav
            aria-label="Footer"
            className="flex flex-wrap gap-x-5 gap-y-2 text-sm"
          >
            <Link to="/about" className="link-quiet">
              About
            </Link>
            <Link to="/paths" className="link-quiet">
              Learning paths
            </Link>
            <Link to="/updates" className="link-quiet">
              Get updates
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
          className="md:items-end md:[--coody-pb-align:flex-end]"
        />
      </div>
    </footer>
  )
}
