import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, ChevronDown, FileText, SearchX, X } from "lucide-react"

import {
  categoryPath,
  liveCategories,
  getSheet,
  sheetPath,
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
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
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
  "h-8 shrink-0 rounded-lg border-0 px-2.5 text-[13px] font-normal"

/** One sheet per topic: the wall behind the hero. */
const WALL = [
  "quaternions",
  "particle-system",
  "a-star-pathfinding",
  "bezier-curves",
  "frustum-culling",
  "field-of-view-visualization",
  "inverse-kinematics",
  "em-wave-propagation",
  "pbr-materials",
]

/** Home shows a taste of each category: fundamentals first, the rest one click away. */
const PREVIEW = 3
const preview = (category: string) =>
  [...sheetsIn(category)]
    .sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level))
    .slice(0, PREVIEW)

/** Most used tags first, so the collapsed row always shows the useful ones. */
function tagCloud(limit = 40) {
  const counts = new Map<string, number>()
  for (const s of sheets)
    for (const t of s.tags)
      counts.set(t.toLowerCase(), (counts.get(t.toLowerCase()) ?? 0) + 1)
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }))
}

interface Filters {
  categories: string[]
  level: Level | "all"
  tags: string[]
}
const EMPTY: Filters = { categories: [], level: "all", tags: [] }

/** Filters mirrored in the URL (?cat=a,b&level=core&tag=x,y), read after hydration. */
function useFilters() {
  const [filters, setFilters] = useState<Filters>(EMPTY)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const list = (k: string) => (q.get(k) ?? "").split(",").filter(Boolean)
    const level = q.get("level") as Level | null
    setFilters({
      categories: list("cat"),
      level: level && LEVELS.includes(level) ? level : "all",
      tags: list("tag"),
    })
  }, [])
  const update = (next: Filters) => {
    setFilters(next)
    const url = new URL(window.location.href)
    const set = (k: string, v: string) =>
      v ? url.searchParams.set(k, v) : url.searchParams.delete(k)
    set("cat", next.categories.join(","))
    set("level", next.level === "all" ? "" : next.level)
    set("tag", next.tags.join(","))
    window.history.replaceState(window.history.state, "", url)
  }
  return [filters, update] as const
}

function HeroWall() {
  const tiles = WALL.map(getSheet).filter((s) => s !== undefined)
  return (
    <div
      className="grid grid-cols-3 gap-2 lg:gap-3"
      aria-label="Featured simulations"
    >
      {tiles.map((s, i) => (
        <Link
          key={s.slug}
          to={sheetPath(s)}
          title={s.title}
          aria-label={s.title}
          className={cn(
            "wall-tile overflow-hidden rounded-lg ring-1 ring-foreground/10 hover:ring-foreground/30",
            // Phones get one row; the full wall needs the two-column hero.
            i > 2 && "hidden lg:block"
          )}
        >
          <img
            src={`/posters/${s.slug}.webp`}
            alt=""
            width={960}
            height={600}
            loading="lazy"
            decoding="async"
            className="aspect-[16/10] w-full object-cover"
          />
        </Link>
      ))}
    </div>
  )
}

function Topics({
  selected,
  toggle,
}: {
  selected: string[]
  toggle: (tag: string) => void
}) {
  const cloud = useMemo(() => tagCloud(), [])
  const [open, setOpen] = useState(false)
  const ordered = useMemo(
    () => [
      ...cloud.filter((t) => selected.includes(t.tag)),
      ...cloud.filter((t) => !selected.includes(t.tag)),
    ],
    [cloud, selected]
  )
  return (
    <div className="flex items-start gap-2">
      <h2
        id="tags-title"
        className="eyebrow hidden h-7 shrink-0 content-center pr-1 sm:block"
      >
        Topics
      </h2>
      {/* Collapsed: exactly one row at any width, whatever fits. */}
      <ul
        aria-labelledby="tags-title"
        onFocusCapture={() => setOpen(true)}
        className={cn(
          "flex min-w-0 flex-1 flex-wrap gap-1",
          !open && "h-7 overflow-hidden"
        )}
      >
        {ordered.map(({ tag, count }) => (
          <li key={tag}>
            <Toggle
              size="sm"
              pressed={selected.includes(tag)}
              onPressedChange={() => toggle(tag)}
              className={cn(
                "h-7 min-w-0 rounded-md px-2 text-xs font-normal text-muted-foreground",
                PRESSED
              )}
              aria-label={`${tag}, ${count} sheets`}
            >
              {tag}
            </Toggle>
          </li>
        ))}
      </ul>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 shrink-0 text-xs text-muted-foreground"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "Fewer" : "More"}
        <ChevronDown
          aria-hidden
          className={cn("transition-transform", open && "rotate-180")}
        />
      </Button>
    </div>
  )
}

export function HomePage() {
  const live = liveCategories()
  const [filters, setFilters] = useFilters()
  const active =
    filters.categories.length > 0 ||
    filters.level !== "all" ||
    filters.tags.length > 0
  const results = useMemo(
    () =>
      sheets.filter(
        (s) =>
          (!filters.categories.length ||
            filters.categories.includes(s.category)) &&
          (filters.level === "all" || s.level === filters.level) &&
          (!filters.tags.length ||
            s.tags.some((t) => filters.tags.includes(t.toLowerCase())))
      ),
    [filters]
  )
  const toggleTag = (tag: string) =>
    setFilters({
      ...filters,
      tags: filters.tags.includes(tag)
        ? filters.tags.filter((t) => t !== tag)
        : [...filters.tags, tag],
    })

  return (
    <>
      <section className="relative pb-10 md:pb-14 lg:pt-6">
        <div
          aria-hidden
          className="scene-grid pointer-events-none absolute -inset-x-4 -top-6 -bottom-4 -z-10 sm:-inset-x-6 md:-top-10 lg:-inset-x-8"
        />
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-14">
          <div>
            <h1 className="font-heading text-display text-balance">
              {siteConfig.longName}
            </h1>
            <p className="mt-5 max-w-xl text-lead text-muted-foreground">
              {sheets.length} game development and physics concepts. Each one
              has a simulation you can play with, the formulas, working code and
              a prompt for your AI assistant.
            </p>
            <div className="mt-7 flex max-w-xl flex-col gap-2.5 sm:flex-row">
              <SearchTrigger wide className="sm:flex-1" />
              <GetUpdatesButton className="shrink-0" />
            </div>
            <Button
              variant="link"
              size="sm"
              className="mt-3 h-auto px-0 text-muted-foreground"
              nativeButton={false}
              render={<a href="/llms.txt" />}
            >
              <FileText aria-hidden /> Every page is also Markdown for LLMs
            </Button>
          </div>
          <HeroWall />
        </div>
      </section>

      <section
        aria-label="Filters"
        className="sticky top-2 z-30 -mx-1 mb-3 rounded-xl bg-background/85 p-1 ring-1 ring-foreground/10 backdrop-blur-md"
      >
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto">
          <ToggleGroup
            multiple
            aria-label="Filter by category"
            spacing={1}
            className="shrink-0 flex-nowrap"
            value={filters.categories}
            onValueChange={(categories) =>
              setFilters({ ...filters, categories })
            }
          >
            {live.map((c) => (
              <ToggleGroupItem
                key={c.slug}
                value={c.slug}
                className={cn(SEGMENT, PRESSED)}
              >
                {c.short ?? c.title}
                <span className="text-[11px] tabular-nums opacity-60">
                  {sheetsIn(c.slug).length}
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Separator
            orientation="vertical"
            className="mx-1 ml-auto h-5 self-center"
          />
          <ToggleGroup
            aria-label="Filter by level"
            spacing={1}
            className="shrink-0 flex-nowrap"
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
        </div>
      </section>

      <section aria-label="Browse by topic" className="mb-10 md:mb-14">
        <Topics selected={filters.tags} toggle={toggleTag} />
        {active && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 -ml-2 text-muted-foreground"
            onClick={() => setFilters(EMPTY)}
          >
            <X aria-hidden /> Clear filters
          </Button>
        )}
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
                  Remove a topic or choose another level.
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
              className="cv-auto scroll-mt-20 space-y-5"
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
