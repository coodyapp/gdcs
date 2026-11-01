import { Link } from "react-router-dom"

import { sheetPath, type SheetMeta } from "@/content"
import { CopyButton } from "@/components/copy-button"
import { VisualShell } from "@/visuals/shell"

export function SheetCard({
  sheet,
  index,
}: {
  sheet: SheetMeta
  index?: number
}) {
  const href = sheetPath(sheet)
  return (
    <article className="group relative flex flex-col rounded-xl border bg-card p-3 transition-colors hover:border-foreground/25">
      <VisualShell slug={sheet.slug} title={sheet.title} compact />
      <div className="flex flex-1 flex-col gap-2 px-1 pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow">
            {index !== undefined
              ? `${String(index + 1).padStart(2, "0")} · `
              : ""}
            {sheet.level}
          </span>
        </div>
        <h3 className="font-heading text-lg leading-tight">
          <Link
            to={href}
            className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
          >
            {sheet.title}
          </Link>
        </h3>
        <p className="text-sm text-muted-foreground italic">{sheet.hook}</p>
        <p className="text-sm text-muted-foreground">{sheet.summary}</p>
        <div className="relative z-10 mt-auto flex items-center justify-between gap-2 pt-2">
          <CopyButton
            label="Copy prompt"
            text={sheet.prompt}
            event="copy_prompt_card"
          />
          <Link
            to={href}
            className="text-xs text-muted-foreground transition-colors group-hover:text-foreground"
            tabIndex={-1}
            aria-hidden
          >
            Open →
          </Link>
        </div>
      </div>
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
