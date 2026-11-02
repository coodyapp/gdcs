import { lazy, Suspense, useState } from "react"
import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"

/** Loaded on first tap: the drawer stays out of the main bundle. */
const PhoneMenuSheet = lazy(() => import("@/components/phone-menu-sheet"))

/**
 * Phones have no keyboard for type-to-search and no sidebar, so this one small
 * button carries search and navigation. Hidden where the sidebar appears.
 */
export function PhoneMenu() {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  return (
    <>
      <Button
        variant="secondary"
        size="icon-lg"
        aria-label="Open menu"
        aria-haspopup="dialog"
        className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 size-11 rounded-full shadow-lg ring-1 ring-foreground/15 lg:hidden print:hidden"
        onClick={() => {
          setLoaded(true)
          setOpen(true)
        }}
      >
        <Menu aria-hidden />
      </Button>
      {loaded && (
        <Suspense fallback={null}>
          <PhoneMenuSheet open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </>
  )
}
