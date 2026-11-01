import { Fragment, type ReactNode } from "react"
import { Link } from "react-router-dom"

const TOKEN = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g

/** Renders the tiny inline markup used in content: `code`, **bold**, [a](/b). */
export function Rich({ text }: { text: string }) {
  const parts = text.split(TOKEN)
  return (
    <>
      {parts.map((part, i): ReactNode => {
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
          return (
            <code key={i} className="inline-code">
              {part.slice(1, -1)}
            </code>
          )
        }
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-foreground">
              {part.slice(2, -2)}
            </strong>
          )
        }
        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
        if (link) {
          const [, label, href] = link
          return href.startsWith("/") ? (
            <Link key={i} to={href} className="link-quiet">
              {label}
            </Link>
          ) : (
            <a
              key={i}
              href={href}
              className="link-quiet"
              rel="noopener"
              target="_blank"
            >
              {label}
            </a>
          )
        }
        return <Fragment key={i}>{part}</Fragment>
      })}
    </>
  )
}
