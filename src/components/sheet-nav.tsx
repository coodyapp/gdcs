import { useEffect, useState } from "react"
import { Link, NavLink } from "react-router-dom"
import { Check } from "lucide-react"

import {
  categoryPath,
  liveCategories,
  sheetPath,
  sheetsIn,
  type SheetMeta,
} from "@/content"
import { useHistory } from "@/lib/local"
import { cn } from "@/lib/utils"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

/** Left rail: every sheet, grouped; the current category is expanded. */
export function SheetSidebar({ current }: { current: SheetMeta }) {
  const { visited } = useHistory()
  return (
    <nav
      aria-label="All cheat sheets"
      className="sticky top-6 hidden max-h-[calc(100dvh-3rem)] self-start overflow-y-auto pr-2 pb-8 text-sm lg:block"
    >
      <Accordion multiple defaultValue={[current.category]}>
        {liveCategories().map((c) => (
          <AccordionItem key={c.slug} value={c.slug} className="border-0">
            <AccordionTrigger className="items-center gap-2 px-2 py-1.5 hover:bg-muted/60 hover:no-underline">
              <span className="flex-1">{c.title}</span>
              <span className="text-xs font-normal text-muted-foreground tabular-nums">
                {sheetsIn(c.slug).length}
              </span>
            </AccordionTrigger>
            {/* Mounted while closed so every link stays in the prerendered HTML. */}
            <AccordionContent keepMounted className="pt-0 pb-2">
              <div className="ml-2 border-l pl-1.5">
                {c.subcategories
                  .filter((s) => sheetsIn(c.slug, s.slug).length)
                  .map((s) => (
                    <div key={s.slug} className="mb-1.5">
                      <p className="px-2 py-1 text-xs text-muted-foreground">
                        {s.title}
                      </p>
                      <ul>
                        {sheetsIn(c.slug, s.slug).map((sheet) => (
                          <li key={sheet.slug}>
                            <NavLink
                              to={sheetPath(sheet)}
                              className={({ isActive }) =>
                                cn(
                                  "flex items-center gap-2 rounded-md px-2 py-1 no-underline transition-colors",
                                  isActive
                                    ? "bg-muted text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                                )
                              }
                            >
                              <span className="flex-1 truncate">
                                {sheet.title}
                              </span>
                              {visited.has(sheet.slug) && (
                                <Check
                                  className="size-3 shrink-0"
                                  aria-label="visited"
                                />
                              )}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                <Link
                  to={categoryPath(c.slug)}
                  className="block px-2 py-1 text-xs text-muted-foreground no-underline hover:text-foreground"
                >
                  Overview
                </Link>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
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
      <ul className="space-y-1 border-l">
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
