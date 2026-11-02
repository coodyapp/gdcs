import { useParams } from "react-router-dom"

import { getSheet, sheetPath } from "@/content"
import { absoluteUrl } from "@/config/site"
import { VisualShell } from "@/visuals/shell"

/**
 * The page other sites frame: the simulation, its controls and a link back. No
 * site chrome. It is always dark, like the simulations, so it looks the same
 * on any host page.
 */
export function EmbedPage() {
  const { slug = "", "*": deeper } = useParams()
  const sheet = deeper ? undefined : getSheet(slug)
  if (!sheet)
    return (
      <p className="p-4 text-sm">
        This simulation does not exist.{" "}
        <a href={absoluteUrl("/")} target="_blank" rel="noopener">
          Browse GDCS
        </a>
      </p>
    )
  return (
    <div className="dark flex min-h-svh flex-col gap-2 bg-background p-2 text-foreground">
      {/* The stage gives way so controls and links stay visible on wide, short frames. */}
      <main className="min-w-0 flex-1 [&_.visual-stage]:aspect-auto [&_.visual-stage]:h-[min(56.25vw,calc(100svh-16rem))] [&_.visual-stage]:min-h-40">
        <VisualShell slug={sheet.slug} title={sheet.title} />
      </main>
      <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 text-sm">
        <a
          href={absoluteUrl(sheetPath(sheet))}
          target="_blank"
          rel="noopener"
          className="link-quiet"
        >
          {sheet.title}: formulas, code and prompt
        </a>
        <a
          href={absoluteUrl("/")}
          target="_blank"
          rel="noopener"
          className="font-medium"
        >
          Powered by GDCS
        </a>
      </footer>
    </div>
  )
}
