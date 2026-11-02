import { Link } from "react-router-dom"

import { PoweredByCoody } from "@/components/coody/powered-by"
import { SiteCredits } from "@/components/coody/site-credits"
import { FooterFibers } from "@/components/backgrounds"
import { SubscribeForm } from "@/components/subscribe-form"
import { Tagline } from "@/components/tagline"
import { ThemeToggle } from "@/components/theme-toggle"
import { categoryPath, liveCategories } from "@/content"

const quiet =
  "inline-flex min-h-6 items-center text-muted-foreground transition-colors hover:text-foreground"

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
      <ul className="space-y-1 text-sm">{children}</ul>
    </nav>
  )
}

export function SiteFooter() {
  return (
    <>
      <FooterFibers className="mt-8 md:mt-10" />
      <footer className="border-t">
        <div className="container grid gap-12 pt-12 pb-10 md:pt-16 md:pb-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <section aria-labelledby="updates-title" className="max-w-md">
            <div className="flex items-center justify-between gap-4">
              <Link
                to="/"
                className="font-heading text-xl"
                aria-label="GDCS home"
              >
                GDCS
              </Link>
              <ThemeToggle />
            </div>
            <Tagline className="mt-2" />
            <h2 id="updates-title" className="mt-8 mb-3 text-sm font-medium">
              Get new sheets by email
            </h2>
            <SubscribeForm compact />
          </section>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
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
            <SiteCredits className="col-span-2 text-sm text-muted-foreground sm:col-span-1" />
          </div>
        </div>
        <div className="container flex flex-col items-center gap-3 pb-20 text-center lg:pb-10">
          <PoweredByCoody
            source="gdcs"
            className="text-muted-foreground [--coody-pb-align:center]! [--coody-pb-muted:currentColor]!"
          />
        </div>
      </footer>
    </>
  )
}
