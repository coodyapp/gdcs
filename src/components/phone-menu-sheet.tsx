import { Link } from "react-router-dom"

import { categoryPath, liveCategories, sheetsIn } from "@/content"
import { paths } from "@/content/paths"
import { SearchTrigger } from "@/components/command-palette"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const row =
  "flex items-center justify-between rounded-md px-2 py-2.5 text-sm hover:bg-muted"

export default function PhoneMenuSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const close = () => onOpenChange(false)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[85vw] max-w-xs gap-0 p-0">
        <SheetHeader className="pb-2">
          <SheetTitle className="font-heading text-lg">GDCS</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-3" onClick={close}>
          <SearchTrigger className="w-full" />
        </div>
        <Separator />
        <ScrollArea className="min-h-0 flex-1">
          <nav aria-label="Site" className="p-2">
            <Link to="/" className={row} onClick={close}>
              Home
            </Link>
            <Link to="/paths" className={row} onClick={close}>
              Learning paths
              <span className="text-xs text-muted-foreground tabular-nums">
                {paths.length}
              </span>
            </Link>
            <Separator className="my-2" />
            {liveCategories().map((c) => (
              <Link
                key={c.slug}
                to={categoryPath(c.slug)}
                className={row}
                onClick={close}
              >
                {c.title}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {sheetsIn(c.slug).length}
                </span>
              </Link>
            ))}
            <Separator className="my-2" />
            <Link to="/about" className={row} onClick={close}>
              About
            </Link>
          </nav>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
