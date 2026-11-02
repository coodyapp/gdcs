import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Kbd } from "@/components/ui/kbd"

/** Loaded on first open: dialog primitives and search stay out of the main bundle. */
const PaletteDialog = lazy(() => import("@/components/palette-dialog"))

const PaletteContext = createContext<() => void>(() => {})
/** Opens the search palette (header button, home search field…). */
export const useOpenPalette = () => useContext(PaletteContext)

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [initial, setInitial] = useState("")
  const [loaded, setLoaded] = useState(false)
  const openRef = useRef(false)
  openRef.current = open
  const show = useCallback((query = "") => {
    if (openRef.current) return
    setInitial(query)
    setLoaded(true)
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
        return
      }
      // Type to search: a letter or digit typed anywhere opens search with it.
      if (
        /^[\p{L}\p{N}]$/u.test(e.key) &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.repeat &&
        !isTyping(e.target)
      ) {
        e.preventDefault()
        show(e.key)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [show])

  return (
    <PaletteContext.Provider value={() => show()}>
      {children}
      {loaded && (
        <Suspense fallback={null}>
          <PaletteDialog open={open} onOpenChange={setOpen} initial={initial} />
        </Suspense>
      )}
    </PaletteContext.Provider>
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
      <Kbd className="hidden sm:inline-flex">{mac ? "⌘K" : "Ctrl K"}</Kbd>
    </button>
  )
}
