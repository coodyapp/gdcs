import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { History } from "lucide-react"

import {
  getCategory,
  getSheet,
  sheetPath,
  sheets,
  type SheetMeta,
} from "@/content"
import { useHistory } from "@/lib/local"
import { searchSheets } from "@/lib/search"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
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
  const searching = Boolean(query.trim())

  const results: SheetMeta[] = useMemo(() => {
    if (searching) return searchSheets(sheets, query)
    const recents = recent
      .map(getSheet)
      .filter((s): s is SheetMeta => Boolean(s))
    return recents.length
      ? recents
      : sheets.filter((s) => s.level === "core").slice(0, 8)
  }, [query, searching, recent])
  const heading = searching
    ? `${results.length} result${results.length === 1 ? "" : "s"}`
    : recent.length
      ? "Recently viewed"
      : "Start here"

  return (
    // searchSheets ranks the results, so cmdk must not filter them again.
    <Command shouldFilter={false} loop className="rounded-none! p-0">
      <CommandInput
        autoFocus
        value={query}
        onValueChange={setQuery}
        placeholder={`Search ${sheets.length} sheets: lerp, tunneling, slerp`}
      />
      <CommandList className="max-h-[50vh] p-1.5">
        <CommandEmpty>No sheets match “{query}”.</CommandEmpty>
        {results.length > 0 && (
          <CommandGroup
            heading={
              <span className="flex items-center gap-1.5" aria-live="polite">
                {!searching && recent.length > 0 && (
                  <History className="size-3" aria-hidden />
                )}
                {heading}
              </span>
            }
          >
            {results.map((s) => (
              <CommandItem
                key={s.slug}
                value={s.slug}
                onSelect={() => {
                  close()
                  navigate(sheetPath(s))
                }}
                className="items-start gap-3 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {getCategory(s.category)?.title}: {s.hook}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
      <p className="hidden items-center gap-4 border-t px-3 py-2 text-xs text-muted-foreground sm:flex">
        <span className="flex items-center gap-1">
          <Kbd>↑↓</Kbd> Navigate
        </span>
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd> Open
        </span>
        <span className="flex items-center gap-1">
          <Kbd>Esc</Kbd> Close
        </span>
      </p>
    </Command>
  )
}
