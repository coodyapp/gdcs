import { renderToString } from "react-dom/server"
import { StaticRouter } from "react-router-dom"

import { Rich } from "@/components/rich"

export type ChangelogBlock =
  | { type: "version"; name: string; date?: string }
  | { type: "section"; name: string }
  | { type: "text"; text: string }
  | { type: "list"; items: string[] }

/** The small part of Markdown that CHANGELOG.md uses. Empty versions are left out. */
export function parseChangelog(markdown: string) {
  const blocks: ChangelogBlock[] = []
  for (const line of markdown.split("\n")) {
    const text = line.trim()
    if (!text || text.startsWith("# ")) continue
    const version = /^## \[([^\]]+)\](?: - (.+))?$/.exec(text)
    const last = blocks.at(-1)
    if (version) {
      if (last?.type === "version") blocks.pop()
      blocks.push({ type: "version", name: version[1], date: version[2] })
    } else if (text.startsWith("### ")) {
      blocks.push({ type: "section", name: text.slice(4) })
    } else if (text.startsWith("- ")) {
      if (last?.type === "list") last.items.push(text.slice(2))
      else blocks.push({ type: "list", items: [text.slice(2)] })
    } else {
      blocks.push({ type: "text", text })
    }
  }
  if (blocks.at(-1)?.type === "version") blocks.pop()
  return blocks
}

function Block({ block }: { block: ChangelogBlock }) {
  switch (block.type) {
    case "version":
      return (
        <h2 className="mt-10">
          {block.name}{" "}
          {block.date && (
            <span className="font-sans text-sm font-normal text-muted-foreground">
              {block.date}
            </span>
          )}
        </h2>
      )
    case "section":
      return <h3 className="mt-4 font-medium">{block.name}</h3>
    case "text":
      return (
        <p>
          <Rich text={block.text} />
        </p>
      )
    case "list":
      return (
        <ul>
          {block.items.map((item) => (
            <li key={item}>
              <Rich text={item} />
            </li>
          ))}
        </ul>
      )
  }
}

/**
 * Built once by the prerenderer into a plain HTML page with no app code, so the
 * growing changelog adds nothing to the JavaScript on other pages.
 */
export function renderChangelogPage(markdown: string) {
  return renderToString(
    <StaticRouter location="/changelog">
      <main className="container pt-6 pb-16 md:pt-10">
        <article className="prose-sheet mx-auto max-w-3xl [overflow-wrap:anywhere]">
          <a href="/" className="link-quiet text-sm">
            Back to GDCS
          </a>
          <h1 className="mt-6 font-heading text-display">Changelog</h1>
          {parseChangelog(markdown).map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </article>
      </main>
    </StaticRouter>
  )
}
