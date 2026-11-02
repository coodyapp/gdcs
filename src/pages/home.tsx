import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, FileText, SearchX, X } from "lucide-react"

import {
  categoryPath,
  liveCategories,
  sheets,
  sheetsIn,
  type SheetMeta,
} from "@/content"
import { paths } from "@/content/paths"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { HeroFibers } from "@/components/backgrounds"
import { SearchTrigger } from "@/components/command-palette"
import { SheetGrid } from "@/components/sheet-card"
import { GetUpdatesButton } from "@/components/updates"
import { PathCard } from "@/pages/paths"
import { siteConfig } from "@/config/site"

type Level = SheetMeta["level"]
const LEVELS: Level[] = ["core", "common", "advanced"]
const PRESSED =
  "aria-pressed:bg-foreground aria-pressed:text-background data-[pressed]:bg-foreground data-[pressed]:text-background"
/** Quiet segment inside the filter bar. */
const SEGMENT =
  "h-9 shrink-0 rounded-lg border-0 px-2 text-[13px] font-normal sm:h-10 sm:px-3.5 sm:text-sm"

/** Home shows a taste of each category: fundamentals first, the rest one click away. */
const PREVIEW = 3
const preview = (category: string) =>
  [...sheetsIn(category)]
    .sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level))
    .slice(0, PREVIEW)

interface Filters {
  categories: string[]
  level: Level | "all"
}
const EMPTY: Filters = { categories: [], level: "all" }

/** Filters mirrored in the URL (?cat=a,b&level=core), read after hydration. */
function useFilters() {
  const [filters, setFilters] = useState<Filters>(EMPTY)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const list = (k: string) => (q.get(k) ?? "").split(",").filter(Boolean)
    const level = q.get("level") as Level | null
    setFilters({
      categories: list("cat"),
      level: level && LEVELS.includes(level) ? level : "all",
    })
  }, [])
  const update = (next: Filters) => {
    setFilters(next)
    const url = new URL(window.location.href)
    const set = (k: string, v: string) =>
      v ? url.searchParams.set(k, v) : url.searchParams.delete(k)
    set("cat", next.categories.join(","))
    set("level", next.level === "all" ? "" : next.level)
    window.history.replaceState(window.history.state, "", url)
  }
  return [filters, update] as const
}

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
  const [filters, setFilters] = useFilters()
  const active = filters.categories.length > 0 || filters.level !== "all"
  const results = useMemo(
    () =>
      sheets.filter(
        (s) =>
          (!filters.categories.length ||
            filters.categories.includes(s.category)) &&
          (filters.level === "all" || s.level === filters.level)
      ),
    [filters]
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
        <div className="mt-7 flex max-w-xl flex-col gap-2.5 sm:flex-row">
          <SearchTrigger wide className="sm:flex-1" />
          <GetUpdatesButton className="shrink-0" />
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

      <section
        aria-label="Filters"
        className="mb-12 flex flex-col gap-2 rounded-2xl bg-card p-2 ring-1 ring-foreground/10 md:mb-16"
      >
        {/* Rows wrap instead of scrolling: every filter stays visible at any width. */}
        <ToggleGroup
          multiple
          aria-label="Filter by category"
          spacing={1}
          className="w-full flex-wrap"
          value={filters.categories}
          onValueChange={(categories) => setFilters({ ...filters, categories })}
        >
          {live.map((c) => (
            <ToggleGroupItem
              key={c.slug}
              value={c.slug}
              className={cn(SEGMENT, PRESSED)}
            >
              {c.short ?? c.title}
              <span className="text-xs tabular-nums opacity-60">
                {sheetsIn(c.slug).length}
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Separator />
        <div className="flex items-center justify-between gap-2">
          <ToggleGroup
            aria-label="Filter by level"
            spacing={1}
            className="min-w-0 flex-wrap"
            value={[filters.level]}
            onValueChange={(next) =>
              setFilters({
                ...filters,
                level: (next[0] as Level | "all") ?? "all",
              })
            }
          >
            {(["all", ...LEVELS] as const).map((l) => (
              <ToggleGroupItem
                key={l}
                value={l}
                className={cn(SEGMENT, PRESSED)}
              >
                {l === "all" ? "All levels" : l[0].toUpperCase() + l.slice(1)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button
            variant="outline"
            className="h-9 shrink-0 px-2.5 font-normal sm:h-10 sm:px-3.5"
            aria-label="Clear filters"
            title="Clear filters"
            disabled={!active}
            onClick={() => setFilters(EMPTY)}
          >
            <X aria-hidden />
            <span className="hidden sm:inline">Clear filters</span>
          </Button>
        </div>
      </section>

      {active ? (
        <section aria-labelledby="results-title" className="space-y-5">
          <h2
            id="results-title"
            className="font-heading text-title"
            aria-live="polite"
          >
            {results.length} sheet{results.length === 1 ? "" : "s"}
          </h2>
          {results.length ? (
            <SheetGrid list={results} showCategory />
          ) : (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchX aria-hidden />
                </EmptyMedia>
                <EmptyTitle>No sheets match these filters</EmptyTitle>
                <EmptyDescription>
                  Choose another category or level.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" onClick={() => setFilters(EMPTY)}>
                  Clear filters
                </Button>
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
