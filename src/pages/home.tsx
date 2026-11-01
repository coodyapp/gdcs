import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Search } from "lucide-react"

import {
  categoryPath,
  liveCategories,
  sheets,
  sheetsIn,
  subcategoryPath,
} from "@/content"
import { SheetGrid } from "@/components/sheet-card"
import { siteConfig } from "@/config/site"

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")

export function HomePage() {
  const [query, setQuery] = useState("")
  const results = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return null
    return sheets.filter((s) =>
      normalize(
        [
          s.title,
          s.hook,
          s.summary,
          s.tags.join(" "),
          s.category,
          s.subcategory,
        ].join(" ")
      ).includes(q)
    )
  }, [query])
  const live = liveCategories()

  return (
    <>
      <section className="py-10 md:py-16">
        <p className="eyebrow mb-4">
          {sheets.length} visual cheat sheets · AI-ready
        </p>
        <h1 className="max-w-4xl font-heading text-display text-balance">
          {siteConfig.longName}
        </h1>
        <p className="mt-5 max-w-2xl text-lead text-muted-foreground">
          Game development and physics concepts, each with an interactive
          Three.js visual, formulas, code and a prompt you can paste into your
          AI assistant. Every page is also available as{" "}
          <a href="/llms.txt" className="link-quiet">
            Markdown for LLMs
          </a>
          .
        </p>
        <div className="relative mt-8 max-w-xl">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <label htmlFor="search" className="sr-only">
            Search cheat sheets
          </label>
          <input
            id="search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search: quaternions, coyote time, tunneling…"
            className="h-11 w-full rounded-lg border bg-background pr-3 pl-9 text-sm outline-none focus-visible:border-foreground/50"
          />
        </div>
        <nav
          aria-label="Jump to category"
          className="mt-6 flex flex-wrap gap-2"
        >
          {live.map((c) => (
            <Link key={c.slug} to={categoryPath(c.slug)} className="chip">
              {c.title}{" "}
              <span className="text-muted-foreground">
                {sheetsIn(c.slug).length}
              </span>
            </Link>
          ))}
        </nav>
      </section>

      {results ? (
        <section aria-labelledby="results-title" className="space-y-6">
          <h2 id="results-title" className="eyebrow">
            {results.length} result{results.length === 1 ? "" : "s"} for “
            {query}”
          </h2>
          <SheetGrid list={results} />
        </section>
      ) : (
        <div className="space-y-20">
          {live.map((c) => (
            <section
              key={c.slug}
              aria-labelledby={`cat-${c.slug}`}
              className="space-y-8"
            >
              <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
                <div className="max-w-2xl">
                  <h2 id={`cat-${c.slug}`} className="font-heading text-title">
                    <Link to={categoryPath(c.slug)}>{c.title}</Link>
                  </h2>
                  <p className="mt-2 text-muted-foreground">{c.description}</p>
                </div>
                <Link to={categoryPath(c.slug)} className="link-quiet text-sm">
                  All {c.title} →
                </Link>
              </header>
              {c.subcategories.map((s) => (
                <div key={s.slug} className="space-y-4">
                  <h3 className="eyebrow">
                    <Link
                      to={subcategoryPath(c.slug, s.slug)}
                      className="hover:text-foreground"
                    >
                      {s.title}
                    </Link>
                  </h3>
                  <SheetGrid list={sheetsIn(c.slug, s.slug)} />
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </>
  )
}
