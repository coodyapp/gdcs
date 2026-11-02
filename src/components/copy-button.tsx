import { Check, Copy } from "lucide-react"

import { cn } from "@/lib/utils"
import { useClipboard } from "@/hooks/use-clipboard"
import { Button } from "@/components/ui/button"

/**
 * shadcn Button that copies `text` (or `getText()`) and confirms in place.
 * Both labels share one grid cell, so the width never jumps.
 */
export function CopyButton({
  label,
  copiedLabel = "Copied",
  text,
  getText,
  className,
  event,
  size = "sm",
}: {
  label: string
  copiedLabel?: string
  text?: string
  getText?: () => string | Promise<string>
  className?: string
  event?: string
  size?: "sm" | "default" | "lg"
}) {
  const { copied, copy } = useClipboard()
  return (
    <Button
      variant="outline"
      size={size}
      className={cn("rounded-full", className)}
      onClick={async (e) => {
        e.preventDefault()
        e.stopPropagation()
        await copy(text ?? (await getText?.()) ?? "")
        if (event)
          window.dispatchEvent(new CustomEvent("gdcs:event", { detail: event }))
      }}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      <span className="grid">
        <span
          className={cn(
            "col-start-1 row-start-1 transition-opacity duration-150",
            copied && "opacity-0"
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "col-start-1 row-start-1 transition-opacity duration-150",
            !copied && "opacity-0"
          )}
          aria-hidden={!copied}
        >
          {copiedLabel}
        </span>
      </span>
      <span className="sr-only" aria-live="polite">
        {copied ? `${copiedLabel} to clipboard` : ""}
      </span>
    </Button>
  )
}
