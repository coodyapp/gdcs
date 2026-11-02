import { useEffect, useRef, useState } from "react"

import { useHighlightedCode } from "@/hooks/use-highlighted-code"
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
} from "@/components/ui/code-block"

const LABELS: Record<string, string> = {
  ts: "TypeScript",
  glsl: "GLSL",
  pseudo: "Pseudocode",
  text: "Prompt",
}

/**
 * shadcn code block with Shiki highlighting (lazy, client-side). The server
 * and the first client render emit plain lines, so hydration matches.
 */
export function SheetCode({
  code,
  lang,
  title,
  wrap = false,
  onCopy,
}: {
  code: string
  lang: string
  title?: string
  wrap?: boolean
  onCopy?: () => void
}) {
  const value = code.trim()
  // Tokenizing is main-thread work: only do it near the viewport, when idle.
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        if ("requestIdleCallback" in window)
          window.requestIdleCallback(() => setNear(true), { timeout: 1500 })
        else setTimeout(() => setNear(true), 200)
      },
      { rootMargin: "200px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const highlightable = near && lang !== "pseudo" && lang !== "text"
  const lines = useHighlightedCode(value, highlightable ? lang : "text")
  return (
    <div ref={ref}>
      <CodeBlock>
        <CodeBlockHeader>
          <CodeBlockTitle>{title ?? LABELS[lang] ?? lang}</CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockCopyButton
              value={value}
              onClick={onCopy}
              aria-label={`Copy ${title ?? LABELS[lang] ?? "code"}`}
            />
          </CodeBlockActions>
        </CodeBlockHeader>
        <CodeBlockContent wrap={wrap} className="text-[13px]">
          {lines.map((line, i) => (
            <CodeBlockLine key={i}>{line}</CodeBlockLine>
          ))}
        </CodeBlockContent>
      </CodeBlock>
    </div>
  )
}
