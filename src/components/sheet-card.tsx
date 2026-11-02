import { Link } from "react-router-dom"
import { Check } from "lucide-react"

import { sheetPath, type SheetMeta } from "@/content"
import { catStyle } from "@/lib/accent"
import { useHistory } from "@/lib/local"
import { CopyButton } from "@/components/copy-button"
import { VisualShell } from "@/visuals/shell"

const LEVELS = { core: 1, common: 2, advanced: 3 } as const

/** Difficulty as 1–3 filled pips plus the word (never colour alone). */
export function LevelPips({ level }: { level: SheetMeta["level"] }) {
  const n = LEVELS[level]
  return (
    <span
      className="inline-flex items-center gap-1.5"
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
      <span className="eyebrow !tracking-[0.18em]">{level}</span>
    </span>
  )
}

export function SheetCard({
  sheet,
  index,
}: {
  sheet: SheetMeta
  index?: number
}) {
  const href = sheetPath(sheet)
  const { visited } = useHistory()
  const seen = visited.has(sheet.slug)
  return (
    <article
      style={catStyle(sheet.category)}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-card p-3 transition-colors duration-150 before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-[var(--cat)] before:opacity-60 before:transition-opacity focus-within:border-white/[0.16] hover:border-white/[0.16] hover:bg-surface-2 hover:before:opacity-100"
    >
      <VisualShell slug={sheet.slug} title={sheet.title} compact />
      <div className="flex flex-1 flex-col gap-1.5 px-1 pt-3">
        <div className="flex items-center justify-between gap-2">
          <LevelPips level={sheet.level} />
          {index !== undefined && (
            <span className="font-hud text-[11px] text-text-3">
              {String(index + 1).padStart(2, "0")}
            </span>
          )}
        </div>
        <h3 className="font-heading text-lg leading-tight">
          <Link
            to={href}
            className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
          >
            {sheet.title}
            <span
              className="ml-1 inline-block text-text-3 transition-transform duration-150 group-hover:translate-x-0.5"
              aria-hidden
            >
              →
            </span>
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {sheet.hook}
        </p>
        <div className="relative z-10 mt-auto flex items-center justify-between gap-2 pt-3">
          <CopyButton
            label="Copy prompt"
            copiedLabel="Prompt copied"
            text={sheet.prompt}
            event="copy_prompt_card"
          />
          {seen && (
            <span className="flex items-center gap-1 text-xs text-text-3">
              <Check className="size-3.5" aria-hidden /> Visited
            </span>
          )}
        </div>
      </div>
      {/* Keyboard focus on the stretched link outlines the whole card. */}
      <span
        className="pointer-events-none absolute inset-0 rounded-xl opacity-0 ring-2 ring-[var(--color-ui-strong)] ring-offset-2 ring-offset-background group-has-[a:focus-visible]:opacity-100"
        aria-hidden
      />
    </article>
  )
}

export function SheetGrid({
  list,
  numbered,
}: {
  list: SheetMeta[]
  numbered?: boolean
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {list.map((s, i) => (
        <SheetCard key={s.slug} sheet={s} index={numbered ? i : undefined} />
      ))}
    </div>
  )
}
