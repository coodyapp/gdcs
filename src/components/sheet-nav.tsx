import { useEffect, useState } from "react"
import { Link, NavLink } from "react-router-dom"

import {
  categoryPath,
  liveCategories,
  sheetPath,
  sheetsIn,
  type SheetMeta,
} from "@/content"
import { catStyle } from "@/lib/accent"
import { useHistory } from "@/lib/local"
import { cn } from "@/lib/utils"

/** Left rail: every sheet, grouped; the current category is expanded. */
export function SheetSidebar({ current }: { current: SheetMeta }) {
  const { visited } = useHistory()
  return (
    <nav
      aria-label="All cheat sheets"
      className="sticky top-6 hidden max-h-[calc(100dvh-3rem)] overflow-y-auto pr-2 pb-8 text-sm lg:block"
    >
      {liveCategories().map((c) => (
        <details
          key={c.slug}
          open={c.slug === current.category}
          style={catStyle(c.slug)}
          className="mb-1"
        >
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 font-medium hover:bg-white/5">
            <span className="cat-dot" aria-hidden />
            <span className="flex-1">{c.title}</span>
            <span className="font-hud text-[11px] text-text-3">
              {sheetsIn(c.slug).length}
            </span>
          </summary>
          <div className="mt-1 mb-3 ml-3 border-l border-white/10 pl-2">
            {c.subcategories.map((s) => (
              <div key={s.slug} className="mb-2">
                <p className="eyebrow px-2 py-1 !text-[10px]">{s.title}</p>
                <ul>
                  {sheetsIn(c.slug, s.slug).map((sheet) => (
                    <li key={sheet.slug}>
                      <NavLink
                        to={sheetPath(sheet)}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-2 rounded-md px-2 py-1 transition-colors",
                            isActive
                              ? "bg-white/[0.08] text-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          )
                        }
                      >
                        <span className="flex-1 truncate">{sheet.title}</span>
                        {visited.has(sheet.slug) && (
                          <span
                            className="text-[10px] text-text-3"
                            aria-label="visited"
                          >
                            ✓
                          </span>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <Link
              to={categoryPath(c.slug)}
              className="block px-2 py-1 text-xs text-text-3 hover:text-foreground"
            >
              Overview →
            </Link>
          </div>
        </details>
      ))}
    </nav>
  )
}

/** Right rail: in-page sections with scroll-spy. */
export function TableOfContents({
  sections,
}: {
  sections: { id: string; label: string }[]
}) {
  const [active, setActive] = useState(sections[0]?.id)
  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((e): e is HTMLElement => Boolean(e))
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
          )[0]
        if (top) setActive(top.target.id)
      },
      { rootMargin: "-80px 0px -65% 0px" }
    )
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [sections])
  return (
    <nav
      aria-label="On this page"
      className="sticky top-6 hidden self-start text-sm xl:block"
    >
      <p className="eyebrow mb-3">On this page</p>
      <ul className="space-y-1 border-l border-white/10">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={active === s.id ? "location" : undefined}
              className={cn(
                "-ml-px block border-l px-3 py-1 transition-colors",
                active === s.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Thin bar at the top of the viewport showing how far the article is read. */
export function ReadingProgress({ target }: { target: string }) {
  const [p, setP] = useState(0)
  useEffect(() => {
    const el = document.getElementById(target)
    if (!el) return
    let frame = 0
    const update = () => {
      frame = 0
      const rect = el.getBoundingClientRect()
      const total = rect.height - window.innerHeight
      setP(total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 1)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      cancelAnimationFrame(frame)
    }
  }, [target])
  return (
    <div
      className="reading-progress"
      style={{ transform: `scaleX(${p})` }}
      aria-hidden
    />
  )
}
