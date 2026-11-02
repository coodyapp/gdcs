import { Check, Copy } from "lucide-react"

import { cn } from "@/lib/utils"
import { useClipboard } from "@/hooks/use-clipboard"

/**
 * Copies `text` (or the result of `getText`) and confirms in place. Both
 * labels are stacked in one grid cell so the button never changes width.
 */
export function CopyButton({
  label,
  copiedLabel = "Copied",
  text,
  getText,
  className,
  event,
}: {
  label: string
  /** What was copied, e.g. "Prompt copied". */
  copiedLabel?: string
  text?: string
  getText?: () => string | Promise<string>
  className?: string
  /** Analytics event name, e.g. "copy_prompt". */
  event?: string
}) {
  const { copied, copy } = useClipboard()
  return (
    <button
      type="button"
      className={cn(
        "chip",
        copied && "!border-[var(--color-ui-strong)]/50",
        className
      )}
      onClick={async (e) => {
        e.preventDefault()
        e.stopPropagation()
        await copy(text ?? (await getText?.()) ?? "")
        if (event)
          window.dispatchEvent(new CustomEvent("gdcs:event", { detail: event }))
      }}
    >
      {copied ? (
        <Check className="size-3.5 text-[var(--color-ui-strong)]" aria-hidden />
      ) : (
        <Copy className="size-3.5" aria-hidden />
      )}
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
    </button>
  )
}
