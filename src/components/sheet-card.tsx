import { Link } from "react-router-dom"
import { Check, Copy } from "lucide-react"

import { getCategory, sheetPath, type SheetMeta } from "@/content"
import { useHistory } from "@/lib/local"
import { highlightParts } from "@/lib/search"
import { promptMarkdown } from "@/lib/prompt-markdown"
import { cn } from "@/lib/utils"
import { useClipboard } from "@/hooks/use-clipboard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { VisualShell } from "@/visuals/shell"

const LEVELS = { core: 1, common: 2, advanced: 3 } as const

/** Difficulty as a badge: 1–3 filled pips plus the word (never colour alone). */
export function LevelPips({
  level,
  plain = false,
}: {
  level: SheetMeta["level"]
  /** Without the badge background, for footers. */
  plain?: boolean
}) {
  const n = LEVELS[level]
  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1.5 font-normal text-muted-foreground capitalize",
        plain && "bg-transparent px-0 text-xs"
      )}
      title={`Level: ${level}`}
    >
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={
              i <= n
                ? "h-2 w-1 rounded-full bg-foreground"
                : "h-2 w-1 rounded-full bg-foreground/20"
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
      variant="ghost"
      size="sm"
      className="relative z-10 -mr-1.5 font-normal text-muted-foreground"
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
      {copied ? "Copied" : "Copy prompt"}
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
  highlight = "",
}: {
  sheet: SheetMeta
  index?: number
  showCategory?: boolean
  /** Search text: matching words in the title get underlined. */
  highlight?: string
}) {
  const href = sheetPath(sheet)
  const { visited } = useHistory()
  const seen = visited.has(sheet.slug)
  return (
    <Card
      render={<article />}
      className="card-lift relative h-full gap-3 pt-0 pb-0 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-foreground"
    >
      <VisualShell
        slug={sheet.slug}
        title={sheet.title}
        compact
        className="[&_.visual-stage]:rounded-none [&_.visual-stage]:border-0 [&_.visual-stage]:border-b"
      />
      <CardHeader>
        <CardTitle className="text-[1.0625rem] font-semibold">
          <h3>
            <Link
              to={href}
              className="after:absolute after:inset-0 focus-visible:outline-none"
            >
              {index !== undefined && (
                <span className="mr-1.5 text-muted-foreground tabular-nums">
                  {index + 1}.
                </span>
              )}
              {highlightParts(sheet.title, highlight).map((part, i) =>
                part.match ? (
                  <mark
                    key={i}
                    className="bg-transparent text-inherit underline decoration-foreground/50 decoration-2 underline-offset-4"
                  >
                    {part.text}
                  </mark>
                ) : (
                  part.text
                )
              )}
            </Link>
          </h3>
        </CardTitle>
        <CardDescription className="line-clamp-2 leading-relaxed first-letter:uppercase">
          {sheet.hook}
        </CardDescription>
      </CardHeader>
      <CardFooter className="mt-auto min-h-11 gap-3 bg-muted/30 px-4 py-1.5 text-xs text-muted-foreground">
        <LevelPips level={sheet.level} plain />
        {showCategory && (
          <span className="truncate">
            {getCategory(sheet.category)?.short ??
              getCategory(sheet.category)?.title}
          </span>
        )}
        {seen && (
          <span className="inline-flex shrink-0 items-center gap-1">
            <Check className="size-3" aria-hidden /> Visited
          </span>
        )}
        <span className="ml-auto shrink-0">
          <CopyPrompt
            prompt={promptMarkdown(sheet.title, sheet.prompt)}
            title={sheet.title}
          />
        </span>
      </CardFooter>
    </Card>
  )
}

/**
 * Small card at the end of a sheet (learning paths, related). Always three single
 * lines, so every card in these sections is the same size whatever its text.
 */
export function SheetEndCard({
  title,
  to,
  meta,
  children,
  stretched = false,
}: {
  title: string
  to: string
  meta: string
  children?: React.ReactNode
  /** The whole card is the link. Otherwise only the title is, for a second link inside. */
  stretched?: boolean
}) {
  return (
    <Card
      size="sm"
      className="card-lift relative h-full has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-foreground"
    >
      <CardHeader>
        <CardTitle className="truncate font-sans font-medium" title={title}>
          <Link
            to={to}
            className={
              stretched
                ? "after:absolute after:inset-0 focus-visible:outline-none"
                : "hover:underline"
            }
          >
            {title}
          </Link>
        </CardTitle>
        <CardDescription className="truncate text-xs">{meta}</CardDescription>
      </CardHeader>
      <CardContent className="truncate text-sm text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  )
}

export function SheetGrid({
  list,
  numbered,
  showCategory,
  highlight,
}: {
  list: SheetMeta[]
  numbered?: boolean
  showCategory?: boolean
  highlight?: string
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {list.map((s, i) => (
        <SheetCard
          key={s.slug}
          sheet={s}
          index={numbered ? i : undefined}
          showCategory={showCategory}
          highlight={highlight}
        />
      ))}
    </div>
  )
}
