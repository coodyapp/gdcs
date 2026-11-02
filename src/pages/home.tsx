import { useEffect, useState } from "react"
import { Link } from "react-router-dom"

import {
  categoryPath,
  liveCategories,
  sheets,
  sheetsIn,
  subcategoryPath,
  type SheetMeta,
} from "@/content"
import { catStyle } from "@/lib/accent"
import { cn } from "@/lib/utils"
import { SearchTrigger } from "@/components/command-palette"
import { SheetGrid } from "@/components/sheet-card"
import { siteConfig } from "@/config/site"

type Level = SheetMeta["level"] | "all"
const LEVELS: { value: Level; label: string }[] = [
  { value: "all", label: "All levels" },
  { value: "core", label: "Core" },
  { value: "common", label: "Common" },
  { value: "advanced", label: "Advanced" },
]

/** Level filter mirrored in ?level= (read after hydration: prerendered HTML has no query). */
function useLevelFilter() {
  const [level, setLevel] = useState<Level>("all")
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("level")
    if (v && LEVELS.some((l) => l.value === v)) setLevel(v as Level)
  }, [])
  const update = (next: Level) => {
    setLevel(next)
    const url = new URL(window.location.href)
    if (next === "all") url.searchParams.delete("level")
    else url.searchParams.set("level", next)
    window.history.replaceState(window.history.state, "", url)
  }
  return [level, update] as const
}

/** Which category section is under the sticky bar. */
function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState<string>()
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
          )[0]
        if (hit) setActive(hit.target.id.replace(/^cat-/, ""))
      },
      { rootMargin: "-120px 0px -60% 0px" }
    )
    ids.forEach((id) => {
      const el = document.getElementById(`cat-${id}`)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  }, [ids])
  return active
}

export function HomePage() {
  const live = liveCategories()
  const [level, setLevel] = useLevelFilter()
  const active = useScrollSpy(live.map((c) => c.slug))
  const visible = (list: SheetMeta[]) =>
    level === "all" ? list : list.filter((s) => s.level === level)

  return (
    <>
      <section className="py-10 md:py-14">
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
        <SearchTrigger wide className="mt-8" />
      </section>

      <div className="sticky top-14 z-30 -mx-8 mb-10 border-y border-white/[0.06] bg-background/90 px-8 py-3 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3">
          <nav
            aria-label="Jump to category"
            className="no-scrollbar -mx-1 flex min-w-0 basis-full gap-2 overflow-x-auto px-1 md:flex-1 md:basis-0"
          >
            {live.map((c) => (
              <a
                key={c.slug}
                href={`#cat-${c.slug}`}
                style={catStyle(c.slug)}
                aria-current={active === c.slug ? "location" : undefined}
                className={cn(
                  "chip shrink-0 !min-h-8",
                  active === c.slug &&
                    "!border-[var(--cat)] bg-[color-mix(in_oklch,var(--cat)_12%,transparent)]"
                )}
              >
                <span className="cat-dot" aria-hidden />
                {c.title}
                <span className="text-text-3">{sheetsIn(c.slug).length}</span>
              </a>
            ))}
          </nav>
          <div
            role="radiogroup"
            aria-label="Filter by level"
            className="flex gap-1 rounded-full border border-white/10 p-0.5"
          >
            {LEVELS.map((l) => (
              <button
                key={l.value}
                type="button"
                role="radio"
                aria-checked={level === l.value}
                onClick={() => setLevel(l.value)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs transition-colors",
                  level === l.value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-20">
        {live.map((c) => (
          <section
            key={c.slug}
            id={`cat-${c.slug}`}
            aria-labelledby={`cat-title-${c.slug}`}
            style={catStyle(c.slug)}
            className="scroll-mt-32 space-y-8"
          >
            <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div className="max-w-2xl">
                <p className="eyebrow mb-2 flex items-center gap-2">
                  <span className="cat-dot" aria-hidden />{" "}
                  {sheetsIn(c.slug).length} sheets
                </p>
                <h2
                  id={`cat-title-${c.slug}`}
                  className="font-heading text-title"
                >
                  <Link to={categoryPath(c.slug)}>{c.title}</Link>
                </h2>
                <p className="mt-2 text-muted-foreground">{c.description}</p>
              </div>
              <Link to={categoryPath(c.slug)} className="link-quiet text-sm">
                All {c.title} →
              </Link>
            </header>
            {c.subcategories.map((s) => {
              const list = visible(sheetsIn(c.slug, s.slug))
              if (!list.length) return null
              return (
                <div key={s.slug} className="space-y-4">
                  <h3 className="eyebrow">
                    <Link
                      to={subcategoryPath(c.slug, s.slug)}
                      className="hover:text-foreground"
                    >
                      {s.title}
                    </Link>
                  </h3>
                  <SheetGrid list={list} />
                </div>
              )
            })}
            {visible(sheetsIn(c.slug)).length === 0 && (
              <p className="text-sm text-muted-foreground">
                No {level} sheets in {c.title} yet.
              </p>
            )}
          </section>
        ))}
      </div>
    </>
  )
}
