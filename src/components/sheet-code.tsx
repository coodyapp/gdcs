import { useEffect, useRef, useState } from "react"
import { FileCode, FileText, WrapText } from "lucide-react"

import { useHighlightedCode } from "@/hooks/use-highlighted-code"
import { Button } from "@/components/ui/button"
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
  markdown: "Markdown",
}

/**
 * shadcn code block with Shiki highlighting (lazy, client-side). The server
 * and the first client render emit plain lines, so hydration matches.
 */
export function SheetCode({
  code,
  lang,
  title,
  wrap: wrapByDefault = false,
  onCopy,
}: {
  code: string
  lang: string
  title?: string
  wrap?: boolean
  onCopy?: () => void
}) {
  const value = code.trim()
  const [wrap, setWrap] = useState(wrapByDefault)
  const prose = lang === "markdown"
  const Icon = prose ? FileText : FileCode
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
  const highlightable = near && lang !== "pseudo"
  const lines = useHighlightedCode(value, highlightable ? lang : "text")
  return (
    // Code stays on a dark panel in both themes, like the simulations.
    <div ref={ref} className="dark">
      <CodeBlock className="text-foreground dark:bg-[#1a1a1a]">
        <CodeBlockHeader>
          <CodeBlockTitle>
            <Icon aria-hidden />
            {title ?? LABELS[lang] ?? lang}
          </CodeBlockTitle>
          <CodeBlockActions>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Wrap lines"
              title="Wrap lines"
              aria-pressed={wrap}
              className="aria-pressed:text-foreground"
              onClick={() => setWrap(!wrap)}
            >
              <WrapText />
            </Button>
            <CodeBlockCopyButton
              value={value}
              onClick={onCopy}
              aria-label={`Copy ${title ?? LABELS[lang] ?? "code"}`}
            />
          </CodeBlockActions>
        </CodeBlockHeader>
        {/* A prompt is one paragraph, so numbering its lines would say nothing. */}
        <CodeBlockContent
          wrap={wrap}
          lineNumbers={!prose}
          className="text-[13px]"
        >
          {lines.map((line, i) => (
            <CodeBlockLine key={i}>{line}</CodeBlockLine>
          ))}
        </CodeBlockContent>
      </CodeBlock>
    </div>
  )
}
