import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CornerDownLeft, History, Search } from "lucide-react"

import {
  getCategory,
  getSheet,
  sheetPath,
  sheets,
  type SheetMeta,
} from "@/content"
import { catStyle } from "@/lib/accent"
import { useHistory } from "@/lib/local"
import { searchSheets } from "@/lib/search"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Kbd } from "@/components/ui/kbd"

export default function PaletteDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-label="Search cheat sheets"
        className="top-[12vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <DialogTitle className="sr-only">Search cheat sheets</DialogTitle>
        {open && (
          <Palette initial={initial} close={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function Palette({ initial, close }: { initial: string; close: () => void }) {
  const navigate = useNavigate()
  const { recent } = useHistory()
  const [query, setQuery] = useState(initial)
  const [active, setActive] = useState(0)
  const list = useRef<HTMLUListElement>(null)

  const results: SheetMeta[] = useMemo(() => {
    if (query.trim()) return searchSheets(sheets, query)
    const recents = recent
      .map(getSheet)
      .filter((s): s is SheetMeta => Boolean(s))
    return recents.length
      ? recents
      : sheets.filter((s) => s.level === "core").slice(0, 8)
  }, [query, recent])
  const heading = query.trim()
    ? `${results.length} result${results.length === 1 ? "" : "s"}`
    : recent.length
      ? "Recently viewed"
      : "Start here"

  useEffect(() => setActive(0), [query])
  useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [active])

  const go = (sheet?: SheetMeta) => {
    if (!sheet) return
    close()
    navigate(sheetPath(sheet))
  }

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault()
          setActive((i) => Math.min(i + 1, results.length - 1))
        } else if (e.key === "ArrowUp") {
          e.preventDefault()
          setActive((i) => Math.max(i - 1, 0))
        } else if (e.key === "Enter") {
          e.preventDefault()
          go(results[active])
        }
      }}
    >
      <div className="flex items-center gap-3 border-b border-white/10 px-4">
        <Search className="size-4 shrink-0 text-text-3" aria-hidden />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-results"
          aria-activedescendant={
            results[active] ? `palette-${results[active].slug}` : undefined
          }
          aria-label="Search cheat sheets"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search 55+ sheets: lerp, tunneling, slerp…"
          className="h-12 w-full bg-transparent text-[15px] outline-none placeholder:text-text-3"
        />
        <Kbd className="hidden sm:inline-flex">Esc</Kbd>
      </div>
      <p
        className="eyebrow flex items-center gap-2 px-4 pt-3 pb-1"
        aria-live="polite"
      >
        {!query.trim() && recent.length > 0 && (
          <History className="size-3" aria-hidden />
        )}
        {heading}
      </p>
      <ul
        id="palette-results"
        role="listbox"
        ref={list}
        className="max-h-[50vh] overflow-y-auto p-2"
      >
        {results.map((s, i) => (
          <li
            key={s.slug}
            id={`palette-${s.slug}`}
            data-index={i}
            role="option"
            aria-selected={i === active}
            onMouseMove={() => setActive(i)}
            onClick={() => go(s)}
            style={catStyle(s.category)}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5",
              i === active ? "bg-white/[0.07]" : ""
            )}
          >
            <span className="cat-dot shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {s.title}
              </span>
              <span className="block truncate text-xs text-text-3">
                {getCategory(s.category)?.title} · {s.hook}
              </span>
            </span>
            {i === active && (
              <CornerDownLeft
                className="size-3.5 shrink-0 text-text-3"
                aria-hidden
              />
            )}
          </li>
        ))}
        {query.trim() && results.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">
            No sheets match “{query}”.
          </li>
        )}
      </ul>
      <p className="flex gap-4 border-t border-white/10 px-4 py-2 font-hud text-[10px] text-text-3">
        <span>↑↓ navigate</span>
        <span>↵ open</span>
        <span>type anywhere · / · ⌘K</span>
      </p>
    </div>
  )
}
