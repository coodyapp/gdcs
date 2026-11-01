import { Check, Copy } from "lucide-react"

import { cn } from "@/lib/utils"
import { useClipboard } from "@/hooks/use-clipboard"

/**
 * Copies `text` (or the result of `getText`, for content that is expensive
 * to build) and announces the result to screen readers.
 */
export function CopyButton({
  label,
  text,
  getText,
  className,
  event,
}: {
  label: string
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
      className={cn("chip", className)}
      onClick={async (e) => {
        e.preventDefault()
        e.stopPropagation()
        await copy(text ?? (await getText?.()) ?? "")
        if (event)
          window.dispatchEvent(new CustomEvent("gdcs:event", { detail: event }))
      }}
    >
      {copied ? (
        <Check className="size-3.5" aria-hidden />
      ) : (
        <Copy className="size-3.5" aria-hidden />
      )}
      <span>{copied ? "Copied" : label}</span>
      <span className="sr-only" aria-live="polite">
        {copied ? `${label}: copied to clipboard` : ""}
      </span>
    </button>
  )
}
