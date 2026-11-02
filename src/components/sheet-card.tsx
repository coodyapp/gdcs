import { Link } from "react-router-dom"
import { Check, Copy } from "lucide-react"

import { getCategory, sheetPath, type SheetMeta } from "@/content"
import { useHistory } from "@/lib/local"
import { cn } from "@/lib/utils"
import { useClipboard } from "@/hooks/use-clipboard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { VisualShell } from "@/visuals/shell"

const LEVELS = { core: 1, common: 2, advanced: 3 } as const

/** Difficulty as a badge: 1–3 filled pips plus the word (never colour alone). */
export function LevelPips({ level }: { level: SheetMeta["level"] }) {
  const n = LEVELS[level]
  return (
    <Badge
      variant="outline"
      className="gap-1.5 font-hud text-[10px] tracking-[0.14em] text-muted-foreground uppercase"
      title={`Level: ${level}`}
    >
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={
              i <= n
                ? "h-2 w-1 rounded-full bg-foreground"
                : "h-2 w-1 rounded-full bg-white/15"
            }
          />
        ))}
      </span>
      {level}
    </Badge>
  )
}

/** Icon-only copy for dense cards. Native title: a tooltip per card costs hydration time. */
function CopyPrompt({ prompt, title }: { prompt: string; title: string }) {
  const { copied, copy } = useClipboard()
  const label = copied ? "Prompt copied" : "Copy prompt"
  return (
    <Button
      variant="outline"
      size="icon-sm"
      className="relative z-10 rounded-full"
      title={label}
      aria-label={`${label}: ${title}`}
      onClick={async (e) => {
        e.preventDefault()
        e.stopPropagation()
        await copy(prompt)
        window.dispatchEvent(
          new CustomEvent("gdcs:event", { detail: "copy_prompt_card" })
        )
      }}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      <span className="sr-only" aria-live="polite">
        {copied ? "Prompt copied to clipboard" : ""}
      </span>
    </Button>
  )
}

export function SheetCard({
  sheet,
  index,
  showCategory = false,
}: {
  sheet: SheetMeta
  index?: number
  showCategory?: boolean
}) {
  const href = sheetPath(sheet)
  const { visited } = useHistory()
  const seen = visited.has(sheet.slug)
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-card transition-[border-color,background-color,transform] duration-200 focus-within:border-white/[0.18] hover:-translate-y-0.5 hover:border-white/[0.18] hover:bg-surface-2 motion-reduce:hover:translate-y-0">
      <VisualShell
        slug={sheet.slug}
        title={sheet.title}
        compact
        className="[&_.visual-stage]:rounded-none [&_.visual-stage]:border-0 [&_.visual-stage]:border-b [&_.visual-stage]:border-white/[0.06]"
      />
      <div className="flex flex-1 flex-col gap-2 p-4 pt-3.5">
        <div className="flex items-center gap-2 text-text-3">
          {index !== undefined && (
            <span className="font-hud text-[11px] tabular-nums">
              {String(index + 1).padStart(2, "0")}
            </span>
          )}
          {showCategory && (
            <span className="eyebrow truncate">
              {getCategory(sheet.category)?.title}
            </span>
          )}
        </div>
        <h3 className="font-heading text-[1.15rem] leading-snug">
          <Link
            to={href}
            className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none"
          >
            {sheet.title}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {sheet.hook}
        </p>
        <div className="mt-auto flex items-center gap-2 pt-3">
          <LevelPips level={sheet.level} />
          {seen && (
            <Badge variant="secondary" className="gap-1 text-[11px]">
              <Check aria-hidden /> Visited
            </Badge>
          )}
          <span className="ml-auto">
            <CopyPrompt prompt={sheet.prompt} title={sheet.title} />
          </span>
        </div>
      </div>
      {/* Keyboard focus on the stretched link outlines the whole card. */}
      <span
        className={cn(
          "pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-foreground ring-offset-2 ring-offset-background opacity-0",
          "group-has-[a:focus-visible]:opacity-100"
        )}
        aria-hidden
      />
    </article>
  )
}

export function SheetGrid({
  list,
  numbered,
  showCategory,
}: {
  list: SheetMeta[]
  numbered?: boolean
  showCategory?: boolean
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {list.map((s, i) => (
        <SheetCard
          key={s.slug}
          sheet={s}
          index={numbered ? i : undefined}
          showCategory={showCategory}
        />
      ))}
    </div>
  )
}
