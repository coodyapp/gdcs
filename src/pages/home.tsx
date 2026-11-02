import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { X } from "lucide-react"

import {
  categoryPath,
  liveCategories,
  sheets,
  sheetsIn,
  subcategoryPath,
  type SheetMeta,
} from "@/content"
import { paths } from "@/content/paths"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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

/** Most used tags, weighted 1–3 for the cloud. */
function tagCloud(limit = 28) {
  const counts = new Map<string, number>()
  for (const s of sheets)
    for (const t of s.tags)
      counts.set(t.toLowerCase(), (counts.get(t.toLowerCase()) ?? 0) + 1)
  const top = [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
  const max = top[0]?.[1] ?? 1
  return top
    .map(([tag, count]) => ({
      tag,
      count,
      weight: count >= max * 0.66 ? 3 : count >= max * 0.33 ? 2 : 1,
    }))
    .sort((a, b) => a.tag.localeCompare(b.tag))
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

export function HomePage() {
  const live = liveCategories()
  const cloud = useMemo(() => tagCloud(), [])
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
      <section className="pt-6 pb-12 sm:pt-10 md:pb-16">
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
        <div className="mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row">
          <SearchTrigger wide className="flex-1" />
          <GetUpdatesButton className="shrink-0" />
        </div>
      </section>

      <section
        aria-label="Filters"
        className="sticky top-0 z-30 -mx-4 mb-6 border-y border-white/[0.06] bg-background/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup
            multiple
            aria-label="Filter by category"
            variant="outline"
            size="sm"
            spacing={1}
            className="no-scrollbar -mx-1 min-w-0 basis-full flex-nowrap overflow-x-auto px-1 md:flex-1 md:basis-0"
            value={filters.categories}
            onValueChange={(categories) =>
              setFilters({ ...filters, categories })
            }
          >
            {live.map((c) => (
              <ToggleGroupItem
                key={c.slug}
                value={c.slug}
                className={cn("shrink-0 rounded-full px-3 text-xs", PRESSED)}
              >
                {c.short ?? c.title}
                <span className="font-hud text-[10px] opacity-60">
                  {sheetsIn(c.slug).length}
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <ToggleGroup
            aria-label="Filter by level"
            variant="outline"
            size="sm"
            spacing={0}
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
                className={cn("px-3 text-xs capitalize", PRESSED)}
              >
                {l === "all" ? "All levels" : l}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </section>

      <section aria-labelledby="tags-title" className="mb-14">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="tags-title" className="eyebrow">
            Browse by topic
          </h2>
          {active && (
            <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY)}>
              <X aria-hidden /> Clear filters
            </Button>
          )}
        </div>
        <ul className="flex flex-wrap gap-1.5" aria-label="Topics">
          {cloud.map(({ tag, count, weight }) => (
            <li key={tag}>
              <Toggle
                size="sm"
                variant="outline"
                pressed={filters.tags.includes(tag)}
                onPressedChange={() => toggleTag(tag)}
                className={cn(
                  "h-auto rounded-full px-3 py-1",
                  weight === 3
                    ? "text-[0.95rem] text-foreground"
                    : weight === 2
                      ? "text-sm text-foreground/85"
                      : "text-xs text-muted-foreground",
                  PRESSED
                )}
                aria-label={`${tag}, ${count} sheets`}
              >
                {tag}
              </Toggle>
            </li>
          ))}
        </ul>
      </section>

      {active ? (
        <section aria-labelledby="results-title" className="space-y-6">
          <h2
            id="results-title"
            className="font-heading text-2xl"
            aria-live="polite"
          >
            {results.length} sheet{results.length === 1 ? "" : "s"}
          </h2>
          {results.length ? (
            <SheetGrid list={results} showCategory />
          ) : (
            <p className="text-muted-foreground">
              Nothing matches these filters.{" "}
              <button
                type="button"
                className="link-quiet"
                onClick={() => setFilters(EMPTY)}
              >
                Clear filters
              </button>
            </p>
          )}
        </section>
      ) : (
        <>
          <section aria-labelledby="paths-title" className="mb-20">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow mb-2">Not sure where to start?</p>
                <h2 id="paths-title" className="font-heading text-title">
                  Learning paths
                </h2>
              </div>
              <Link to="/paths" className="link-quiet text-sm">
                All {paths.length} paths →
              </Link>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {paths.slice(0, 3).map((p) => (
                <PathCard key={p.slug} path={p} />
              ))}
            </div>
          </section>

          <div className="space-y-24">
            {live.map((c) => (
              <section
                key={c.slug}
                id={`cat-${c.slug}`}
                aria-labelledby={`cat-title-${c.slug}`}
                className="cv-auto scroll-mt-24 space-y-10"
              >
                <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
                  <div className="max-w-2xl">
                    <p className="eyebrow mb-2">
                      {sheetsIn(c.slug).length} sheets
                    </p>
                    <h2
                      id={`cat-title-${c.slug}`}
                      className="font-heading text-title"
                    >
                      <Link to={categoryPath(c.slug)}>{c.title}</Link>
                    </h2>
                    <p className="mt-2 text-muted-foreground">
                      {c.description}
                    </p>
                  </div>
                  <Link
                    to={categoryPath(c.slug)}
                    className="link-quiet text-sm"
                  >
                    All {c.title} →
                  </Link>
                </header>
                {c.subcategories.map((s) => (
                  <div key={s.slug} className="space-y-5">
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
        </>
      )}
    </>
  )
}
