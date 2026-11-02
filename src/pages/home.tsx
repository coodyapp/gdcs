import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowRight, FileText, Search, SearchX, X } from "lucide-react"

import {
  categoryPath,
  liveCategories,
  sheets,
  sheetsIn,
  sheetPath,
  type SheetMeta,
} from "@/content"
import { paths } from "@/content/paths"
import { searchFiltered, type SheetFilters } from "@/lib/search"
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { HeroFibers } from "@/components/backgrounds"
import { SearchKbd, useSearchTarget } from "@/components/command-palette"
import { SheetGrid } from "@/components/sheet-card"
import { SubscribeForm } from "@/components/subscribe-form"
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

type Filters = SheetFilters<Level>
const EMPTY: Filters = { query: "", categories: [], level: "all" }

/** Search and filters mirrored in the URL (?q=lerp&cat=a,b&level=core), read after hydration. */
function useFilters() {
  const [filters, setFilters] = useState<Filters>(EMPTY)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const list = (k: string) => (q.get(k) ?? "").split(",").filter(Boolean)
    const level = q.get("level") as Level | null
    setFilters({
      query: q.get("q") ?? "",
      categories: list("cat"),
      level: level && LEVELS.includes(level) ? level : "all",
    })
  }, [])
  const update = (next: Filters) => {
    setFilters(next)
    const url = new URL(window.location.href)
    const set = (k: string, v: string) =>
      v ? url.searchParams.set(k, v) : url.searchParams.delete(k)
    set("q", next.query)
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
  const navigate = useNavigate()
  const searchInput = useRef<HTMLInputElement>(null)
  const query = useDeferredValue(filters.query)
  const active =
    filters.query.trim() !== "" ||
    filters.categories.length > 0 ||
    filters.level !== "all"
  const results = useMemo(
    () => searchFiltered(sheets, { ...filters, query }),
    [query, filters]
  )

  // Results replace what is below the card: bring them into view when they appear.
  const searchCard = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!active) return
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
    searchCard.current?.scrollIntoView?.({
      block: "start",
      behavior: smooth ? "smooth" : "auto",
    })
  }, [active])

  // Start typing anywhere on this page and it lands in the search field.
  useSearchTarget((typed) => {
    if (typed) setFilters({ ...filters, query: filters.query + typed })
    searchInput.current?.focus()
  })

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

      <section
        ref={searchCard}
        role="search"
        aria-label="Search and filter sheets"
        className="mb-12 flex scroll-mt-4 flex-col gap-2 rounded-2xl bg-card p-2 ring-1 ring-foreground/10 md:mb-16"
      >
        <InputGroup className="h-14 rounded-xl border-0 bg-transparent! has-[[data-slot=input-group-control]:focus-visible]:ring-2 md:h-16">
          <InputGroupAddon className="pl-3 md:pl-4">
            <Search className="size-5" aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            ref={searchInput}
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search sheets"
            aria-keyshortcuts="Meta+K Control+K /"
            placeholder={`Search ${sheets.length} sheets: lerp, tunneling`}
            className="h-full text-base md:text-lg md:placeholder:text-lg"
            value={filters.query}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            onKeyDown={(e) => {
              // Not `results`: it is deferred and can lag behind the last keystroke.
              const first = filters.query.trim()
                ? searchFiltered(sheets, filters)[0]
                : undefined
              if (e.key === "Enter" && first) navigate(sheetPath(first))
              if (e.key === "Escape") setFilters({ ...filters, query: "" })
            }}
          />
          <InputGroupAddon align="inline-end" className="pr-2 md:pr-3">
            {filters.query ? (
              <InputGroupButton
                size="icon-sm"
                aria-label="Clear search"
                onClick={() => {
                  setFilters({ ...filters, query: "" })
                  searchInput.current?.focus()
                }}
              >
                <X aria-hidden />
              </InputGroupButton>
            ) : (
              <SearchKbd />
            )}
          </InputGroupAddon>
        </InputGroup>
        <Separator />
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
                <EmptyTitle>No sheets match</EmptyTitle>
                <EmptyDescription>
                  Try another word, category or level.
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
