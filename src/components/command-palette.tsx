import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
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

const PaletteContext = createContext<() => void>(() => {})
/** Opens the search palette (header button, home search field…). */
export const useOpenPalette = () => useContext(PaletteContext)

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const show = useCallback(() => {
    dialog.current?.showModal()
    setOpen(true)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.key === "k" && (e.metaKey || e.ctrlKey)) ||
        (e.key === "/" && !isTyping(e.target))
      ) {
        e.preventDefault()
        show()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [show])

  return (
    <PaletteContext.Provider value={show}>
      {children}
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        aria-label="Search cheat sheets"
        className="palette m-auto mt-[12vh] w-[min(640px,calc(100vw-2rem))] rounded-xl border border-white/10 bg-popover p-0 text-foreground shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        {open && <Palette close={() => dialog.current?.close()} />}
      </dialog>
    </PaletteContext.Provider>
  )
}

function Palette({ close }: { close: () => void }) {
  const navigate = useNavigate()
  const { recent } = useHistory()
  const [query, setQuery] = useState("")
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
        <kbd className="hidden rounded border border-white/15 px-1.5 py-0.5 font-hud text-[10px] text-text-3 sm:block">
          ESC
        </kbd>
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
        <span>/ or ⌘K anywhere</span>
      </p>
    </div>
  )
}

/** Header / inline trigger that looks like a search field. */
export function SearchTrigger({
  className,
  wide = false,
}: {
  className?: string
  wide?: boolean
}) {
  const open = useOpenPalette()
  const [mac, setMac] = useState(true)
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), [])
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Search cheat sheets"
      aria-keyshortcuts="Meta+K Control+K /"
      className={cn(
        "flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-card px-3 text-sm text-text-3 transition-colors hover:border-white/20 hover:text-foreground",
        wide && "h-11 w-full max-w-xl",
        className
      )}
    >
      <Search className="size-4" aria-hidden />
      <span className={cn("text-left", wide ? "flex-1" : "hidden lg:inline")}>
        {wide ? "Search: quaternions, coyote time, tunneling…" : "Search"}
      </span>
      <kbd className="hidden rounded border border-white/15 px-1.5 py-0.5 font-hud text-[10px] sm:inline">
        {mac ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  )
}
