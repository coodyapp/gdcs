import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Atom,
  Box,
  Brain,
  Gamepad2,
  Gauge,
  Network,
  PersonStanding,
  Search,
  Sigma,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react"

import { getCategory, liveCategories, sheetPath, sheets } from "@/content"
import { cn } from "@/lib/utils"
import {
  facetCounts,
  searchFiltered,
  SORTS,
  type SheetFilters,
  type SortKey,
} from "@/lib/search"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { SearchKbd, useSearchTarget } from "@/components/command-palette"

const LEVELS = ["core", "common", "advanced"] as const

const ICONS: Record<string, LucideIcon> = {
  threejs: Box,
  mathematics: Sigma,
  "game-feel": Gamepad2,
  systems: Workflow,
  ai: Brain,
  performance: Gauge,
  animation: PersonStanding,
  networking: Network,
  physics: Atom,
}

const PRESSED =
  "aria-pressed:bg-foreground aria-pressed:text-background data-[pressed]:bg-foreground data-[pressed]:text-background"
const CHIP =
  "h-9 shrink-0 gap-1.5 rounded-lg border-0 px-2.5 text-[13px] font-normal sm:px-3 sm:text-sm disabled:opacity-40"

export const NO_FILTERS: SheetFilters = {
  query: "",
  categories: [],
  subcategory: "",
  level: "all",
  sort: "relevance",
}

/** Whether anything narrows the list. Sorting alone does not. */
export const isFiltering = (f: SheetFilters) =>
  f.query.trim() !== "" ||
  f.categories.length > 0 ||
  f.subcategory !== "" ||
  f.level !== "all"

/** Search and filters mirrored in the URL (?q=&cat=&sub=&level=&sort=), read after hydration. */
export function useSheetFilters() {
  const [filters, setFilters] = useState<SheetFilters>(NO_FILTERS)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const level = q.get("level") as SheetFilters["level"] | null
    const sort = q.get("sort") as SortKey | null
    setFilters({
      query: q.get("q") ?? "",
      categories: (q.get("cat") ?? "").split(",").filter(Boolean),
      subcategory: q.get("sub") ?? "",
      level: level && LEVELS.includes(level as never) ? level : "all",
      sort: sort && sort in SORTS ? sort : "relevance",
    })
  }, [])
  const update = (next: SheetFilters) => {
    setFilters(next)
    const url = new URL(window.location.href)
    const set = (k: string, v: string) =>
      v ? url.searchParams.set(k, v) : url.searchParams.delete(k)
    set("q", next.query)
    set("cat", next.categories.join(","))
    set("sub", next.subcategory)
    set("level", next.level === "all" ? "" : next.level)
    set("sort", next.sort === "relevance" ? "" : next.sort)
    window.history.replaceState(window.history.state, "", url)
  }
  return [filters, update] as const
}

const Count = ({ n }: { n: number }) => (
  <span className="text-xs tabular-nums opacity-60">{n}</span>
)

/** The search field and its filters. Results render below, on the page. */
export function SheetSearch({
  filters,
  setFilters,
  deferredQuery,
}: {
  filters: SheetFilters
  setFilters: (next: SheetFilters) => void
  deferredQuery: string
}) {
  const navigate = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  const card = useRef<HTMLElement>(null)
  const active = isFiltering(filters)
  const counts = useMemo(
    () => facetCounts(sheets, { ...filters, query: deferredQuery }),
    [filters, deferredQuery]
  )
  const onlyCategory =
    filters.categories.length === 1 ? getCategory(filters.categories[0]) : null

  // Results replace what is below the card: bring them into view when they appear.
  useEffect(() => {
    if (!active) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    card.current?.scrollIntoView?.({
      block: "start",
      behavior: reduce ? "auto" : "smooth",
    })
  }, [active])

  // Start typing anywhere on this page and it lands in the search field.
  useSearchTarget((typed) => {
    if (typed) setFilters({ ...filters, query: filters.query + typed })
    input.current?.focus()
  })

  return (
    <section
      ref={card}
      role="search"
      aria-label="Search and filter sheets"
      className="mb-12 flex scroll-mt-4 flex-col gap-2 rounded-2xl bg-card p-2 ring-1 ring-foreground/10 md:mb-16"
    >
      <InputGroup className="h-14 rounded-xl border-0 bg-transparent! has-[[data-slot=input-group-control]:focus-visible]:ring-2 md:h-16">
        <InputGroupAddon className="pl-3 md:pl-4">
          <Search className="size-5" aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          ref={input}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          aria-label="Search sheets"
          aria-keyshortcuts="Meta+K Control+K /"
          aria-controls={active ? "search-results" : undefined}
          placeholder={`Search ${sheets.length} sheets: lerp, tunneling`}
          className="h-full text-base md:text-lg md:placeholder:text-lg"
          value={filters.query}
          onChange={(e) => setFilters({ ...filters, query: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Escape") setFilters({ ...filters, query: "" })
            if (e.key === "ArrowDown" && active) {
              e.preventDefault()
              document
                .querySelector<HTMLElement>("#search-results h3 a")
                ?.focus()
            }
            if (e.key === "Enter" && filters.query.trim()) {
              // Not the rendered list: it is deferred and can lag the last keystroke.
              const first = searchFiltered(sheets, filters)[0]
              if (first) navigate(sheetPath(first))
            }
          }}
        />
        <InputGroupAddon align="inline-end" className="pr-2 md:pr-3">
          {filters.query ? (
            <InputGroupButton
              size="icon-sm"
              aria-label="Clear search"
              onClick={() => {
                setFilters({ ...filters, query: "" })
                input.current?.focus()
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
        aria-label="Filter by topic"
        spacing={1}
        className="w-full flex-wrap"
        value={filters.categories}
        onValueChange={(categories) =>
          setFilters({ ...filters, categories, subcategory: "" })
        }
      >
        {liveCategories().map((c) => {
          const Icon = ICONS[c.slug] ?? Box
          const n = counts.categories[c.slug] ?? 0
          return (
            <ToggleGroupItem
              key={c.slug}
              value={c.slug}
              disabled={n === 0 && !filters.categories.includes(c.slug)}
              className={cn(CHIP, PRESSED)}
            >
              <Icon aria-hidden className="size-3.5 opacity-70" />
              {c.short ?? c.title}
              <Count n={n} />
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>

      {onlyCategory && onlyCategory.subcategories.length > 1 && (
        <ToggleGroup
          aria-label={`Filter ${onlyCategory.title} by subtopic`}
          spacing={1}
          className="w-full flex-wrap rounded-lg bg-muted/60 p-1"
          value={filters.subcategory ? [filters.subcategory] : []}
          onValueChange={(next) =>
            setFilters({ ...filters, subcategory: next[0] ?? "" })
          }
        >
          {onlyCategory.subcategories.map((sub) => {
            const n = counts.subcategories[sub.slug] ?? 0
            return (
              <ToggleGroupItem
                key={sub.slug}
                value={sub.slug}
                disabled={n === 0 && filters.subcategory !== sub.slug}
                className={cn(CHIP, "h-8", PRESSED)}
              >
                {sub.title}
                <Count n={n} />
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
      )}

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
              level: (next[0] as SheetFilters["level"]) ?? "all",
            })
          }
        >
          {(["all", ...LEVELS] as const).map((l) => {
            const n = counts.levels[l] ?? 0
            return (
              <ToggleGroupItem
                key={l}
                value={l}
                disabled={n === 0 && filters.level !== l}
                className={cn(CHIP, PRESSED)}
              >
                {l === "all" ? "All levels" : l[0].toUpperCase() + l.slice(1)}
                <span className="hidden sm:inline">
                  <Count n={n} />
                </span>
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
        <Button
          variant="outline"
          className="h-9 shrink-0 px-2.5 font-normal sm:px-3.5"
          aria-label="Clear filters"
          title="Clear filters"
          disabled={!active}
          onClick={() => setFilters(NO_FILTERS)}
        >
          <X aria-hidden />
          <span className="hidden sm:inline">Clear filters</span>
        </Button>
      </div>
    </section>
  )
}
