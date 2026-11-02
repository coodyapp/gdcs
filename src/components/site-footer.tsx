import { Link } from "react-router-dom"
import { ArrowUp } from "lucide-react"

import { PoweredByCoody } from "@/components/coody/powered-by"
import { SubscribeForm } from "@/components/subscribe-form"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { siteConfig } from "@/config/site"
import { categoryPath, liveCategories } from "@/content"

const quiet = "text-muted-foreground transition-colors hover:text-foreground"

function Column({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <nav aria-label={title}>
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      <ul className="space-y-2 text-sm">{children}</ul>
    </nav>
  )
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t md:mt-28">
      <div className="container grid gap-12 py-12 md:py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <section aria-labelledby="updates-title" className="max-w-md">
          <Link to="/" className="font-heading text-xl" aria-label="GDCS home">
            GDCS
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">
            {siteConfig.tagline}.
          </p>
          <h2 id="updates-title" className="mt-8 mb-3 text-sm font-medium">
            Get new sheets by email
          </h2>
          <SubscribeForm compact />
        </section>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          <Column title="Topics">
            {liveCategories().map((c) => (
              <li key={c.slug}>
                <Link to={categoryPath(c.slug)} className={quiet}>
                  {c.title}
                </Link>
              </li>
            ))}
          </Column>
          <Column title="Learn">
            <li>
              <Link to="/" className={quiet}>
                Home
              </Link>
            </li>
            <li>
              <Link to="/paths" className={quiet}>
                Learning paths
              </Link>
            </li>
            <li>
              <Link to="/about" className={quiet}>
                About
              </Link>
            </li>
            <li>
              <Link to="/privacy" className={quiet}>
                Privacy policy
              </Link>
            </li>
          </Column>
          <Column title="For AI agents">
            <li>
              <a href="/llms.txt" className={quiet}>
                llms.txt
              </a>
            </li>
            <li>
              <a href="/llms-full.txt" className={quiet}>
                llms-full.txt
              </a>
            </li>
            <li>
              <a href="/feed.json" className={quiet}>
                JSON feed
              </a>
            </li>
            <li>
              <a href="/sitemap.xml" className={quiet}>
                Sitemap
              </a>
            </li>
          </Column>
        </div>
      </div>
      <Separator />
      <div className="container flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-5 pr-16 text-sm text-muted-foreground lg:pr-8">
        <p className="flex items-center gap-3">
          <span>© 2026 Coody</span>
          <a
            href={siteConfig.changelog}
            className={`${quiet} tabular-nums`}
            rel="noopener"
            title="Changelog"
          >
            v{siteConfig.version}
          </a>
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <PoweredByCoody
            source="gdcs"
            className="[--coody-pb-muted:currentColor]"
          />
          <BackToTop />
        </div>
      </div>
    </footer>
  )
}

function BackToTop() {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground"
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
