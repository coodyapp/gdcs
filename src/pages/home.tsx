import { useDeferredValue, useMemo, type CSSProperties } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, FileText, SearchX } from "lucide-react"

import {
  categoryPath,
  liveCategories,
  sheets,
  sheetsIn,
  type SheetMeta,
} from "@/content"
import { paths } from "@/content/paths"
import { searchFiltered, SORTS, type SortKey } from "@/lib/search"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Kbd } from "@/components/ui/kbd"
import { NativeSelect } from "@/components/ui/native-select"
import { HeroFibers } from "@/components/backgrounds"
import { SheetGrid } from "@/components/sheet-card"
import { SheetSearch } from "@/components/sheet-search"
import { SEARCH_SUGGESTIONS } from "@/components/sheet-search-data"
import { SubscribeForm } from "@/components/subscribe-form"
import { ThemeToggle } from "@/components/theme-toggle"
import { PathCard } from "@/pages/paths"
import { siteConfig } from "@/config/site"
import {
  isFiltering,
  NO_FILTERS,
  useSheetFilters,
} from "@/hooks/use-sheet-filters"

type Level = SheetMeta["level"]
const LEVELS: Level[] = ["core", "common", "advanced"]

/** Home shows a taste of each category: fundamentals first, the rest one click away. */
const PREVIEW = 3
const preview = (category: string) =>
  [...sheetsIn(category)]
    .sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level))
    .slice(0, PREVIEW)

const titleWords = siteConfig.longName.split(" ")
const titleEnd = titleWords.pop()
const titleStart = titleWords.join(" ")

/**
 * Counts up from zero in CSS (see .count-up), so it starts with the first paint
 * and needs no JavaScript. The real number stays in the HTML for readers and
 * crawlers; the box is sized up front so the sentence never reflows.
 */
function CountUp({ value }: { value: number }) {
  return (
    <span
      className="count-up font-heading text-[1.75em] leading-none text-foreground"
      style={
        {
          "--count-to": value,
          width: `${String(value).length}ch`,
        } as CSSProperties
      }
    >
      <span className="sr-only">{value}</span>
    </span>
  )
}

export function HomePage() {
  const live = liveCategories()
  const [filters, setFilters] = useSheetFilters()
  const query = useDeferredValue(filters.query)
  const active = isFiltering(filters)
  const results = useMemo(
    () => searchFiltered(sheets, { ...filters, query }),
    [query, filters]
  )
  // Zero results because of the filters: say how many the search has without them.
  const withoutFilters = useMemo(
    () =>
      results.length || !query.trim()
        ? 0
        : searchFiltered(sheets, { ...NO_FILTERS, query }).length,
    [results.length, query]
  )

  return (
    <>
      <section className="relative isolate flex min-h-[min(70svh,640px)] flex-col justify-center pb-12 md:pb-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-6 bottom-0 left-1/2 -z-10 w-screen -translate-x-1/2 md:-top-10"
        >
          <HeroFibers />
          {/* Keeps the text readable and melts the fibers into the page. */}
          <div className="absolute inset-0 bg-background/60 lg:bg-transparent lg:bg-gradient-to-r lg:from-background lg:from-15% lg:via-background/70 lg:via-50% lg:to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
        </div>
        <ThemeToggle className="absolute top-0 right-0" />
        <h1 className="max-w-4xl font-heading text-display text-balance">
          {titleStart}{" "}
          <span className="whitespace-nowrap">
            {titleEnd}
            <a
              href={siteConfig.changelog}
              rel="noopener"
              title="Changelog"
              className="ml-2.5 align-baseline font-sans text-sm font-normal tracking-normal text-muted-foreground tabular-nums transition-colors hover:text-foreground"
            >
              v{siteConfig.version}
            </a>
          </span>
        </h1>
        <p className="mt-5 max-w-xl text-lead text-muted-foreground">
          <CountUp value={sheets.length} /> game development and physics
          concepts. Each one has a simulation you can play with, the formulas,
          working code and a prompt for your AI assistant.
        </p>
        <div className="mt-7 max-w-xl">
          <SubscribeForm compact />
        </div>
        <Button
          variant="link"
          size="sm"
          className="mt-3 h-auto self-start px-0 text-muted-foreground"
          nativeButton={false}
          render={<a href="/llms.txt" />}
        >
          <FileText aria-hidden /> Every page is also Markdown for LLMs
        </Button>
      </section>

      <SheetSearch
        filters={filters}
        setFilters={setFilters}
        deferredQuery={query}
      />

      {active ? (
        <section
          id="search-results"
          aria-labelledby="results-title"
          className="space-y-5"
        >
          <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2
                id="results-title"
                className="font-heading text-title"
                aria-live="polite"
              >
                {results.length} sheet{results.length === 1 ? "" : "s"}
              </h2>
              {query.trim() !== "" && results.length > 0 && (
                <p className="hidden items-center gap-1.5 text-sm text-muted-foreground md:flex">
                  <Kbd>↵</Kbd> opens the first, <Kbd>↓</Kbd> moves into the
                  results
                </p>
              )}
            </div>
            {results.length > 1 && (
              <NativeSelect
                aria-label="Sort results"
                value={filters.sort}
                onChange={(e) =>
                  setFilters({ ...filters, sort: e.target.value as SortKey })
                }
              >
                {Object.entries(SORTS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </header>
          {results.length ? (
            <SheetGrid list={results} showCategory highlight={query} />
          ) : (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchX aria-hidden />
                </EmptyMedia>
                <EmptyTitle>
                  {query.trim()
                    ? `No sheets match “${query.trim()}”`
                    : "No sheets match these filters"}
                </EmptyTitle>
                <EmptyDescription>
                  {withoutFilters > 0
                    ? `Your filters hide ${withoutFilters} sheet${withoutFilters === 1 ? "" : "s"} for this search.`
                    : "Try one of these:"}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                {withoutFilters > 0 ? (
                  <Button
                    variant="outline"
                    onClick={() => setFilters({ ...NO_FILTERS, query })}
                  >
                    Search all topics and levels
                  </Button>
                ) : (
                  <div className="flex flex-wrap justify-center gap-2">
                    {SEARCH_SUGGESTIONS.map((term) => (
                      <Button
                        key={term}
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setFilters({ ...NO_FILTERS, query: term })
                        }
                      >
                        {term}
                      </Button>
                    ))}
                  </div>
                )}
              </EmptyContent>
            </Empty>
          )}
        </section>
      ) : (
        <div className="space-y-16 md:space-y-20">
          <section aria-labelledby="paths-title" className="space-y-5">
            <SectionHeader
              id="paths-title"
              title="Learning paths"
              description="Not sure where to start? Follow a route through the sheets."
              to="/paths"
              linkLabel={`All ${paths.length} paths`}
            />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {paths.slice(0, 3).map((p) => (
                <PathCard key={p.slug} path={p} />
              ))}
            </div>
          </section>

          {live.map((c) => (
            <section
              key={c.slug}
              id={`cat-${c.slug}`}
              aria-labelledby={`cat-title-${c.slug}`}
              className="cv-auto scroll-mt-6 space-y-5"
            >
              <SectionHeader
                id={`cat-title-${c.slug}`}
                title={c.title}
                description={c.description}
                to={categoryPath(c.slug)}
                linkLabel={`All ${sheetsIn(c.slug).length} sheets`}
              />
              <SheetGrid list={preview(c.slug)} />
            </section>
          ))}
        </div>
      )}
    </>
  )
}

function SectionHeader({
  id,
  title,
  description,
  to,
  linkLabel,
}: {
  id: string
  title: string
  description: string
  to: string
  linkLabel: string
}) {
  return (
    <header className="flex items-end justify-between gap-4 border-b pb-4">
      <div className="max-w-2xl min-w-0">
        <h2 id={id} className="font-heading text-title">
          <Link to={to}>{title}</Link>
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 text-muted-foreground"
        nativeButton={false}
        render={<Link to={to} />}
      >
        {linkLabel} <ArrowRight aria-hidden />
      </Button>
    </header>
  )
}
