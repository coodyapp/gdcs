import { Suspense, use, useEffect, useMemo } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, ArrowRight, FileText } from "lucide-react"

import {
  categoryPath,
  getCategory,
  getLoadedSheet,
  getSheet,
  getSubcategory,
  loadSheet,
  neighbours,
  relatedSheets,
  sheetMarkdownPath,
  sheetPath,
  subcategoryPath,
} from "@/content"
import { recordVisit } from "@/lib/local"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { LevelPips, SheetEndCard } from "@/components/sheet-card"
import { embedCode, LICENSE_PATH } from "@/lib/embed"
import { promptMarkdown } from "@/lib/prompt-markdown"
import { SheetCode } from "@/components/sheet-code"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ReadingProgress,
  SheetSidebar,
  TableOfContents,
} from "@/components/sheet-nav"
import { CopyButton } from "@/components/copy-button"
import { Rich } from "@/components/rich"
import { NotFoundPage } from "@/pages/not-found"
import { SheetPaths } from "@/pages/paths"
import { VisualShell } from "@/visuals/shell"

const copyMarkdown = (slug: string) => async () => {
  const { sheetMarkdown } = await import("@/content/markdown")
  return sheetMarkdown(await loadSheet(slug))
}

/** The full sheet: synchronous when preloaded (SSR, hydration), else suspends. */
function useFullSheet(slug: string) {
  return getLoadedSheet(slug) ?? use(loadSheet(slug))
}

export function SheetPage() {
  const { category = "", subcategory = "", slug = "" } = useParams()
  const meta = getSheet(slug)
  if (!meta || meta.category !== category || meta.subcategory !== subcategory)
    return <NotFoundPage />
  return (
    <Suspense
      fallback={
        <article className="mx-auto max-w-3xl" aria-busy="true">
          <h1 className="mt-14 font-heading text-sheet">{meta.title}</h1>
          <p className="mt-3 text-lead text-muted-foreground first-letter:uppercase">
            {meta.hook}
          </p>
          <Skeleton className="mt-8 aspect-[16/9] w-full rounded-xl" />
        </article>
      }
    >
      <SheetArticle slug={slug} />
    </Suspense>
  )
}

function SheetArticle({ slug }: { slug: string }) {
  const sheet = useFullSheet(slug)
  const { category, subcategory } = sheet
  const c = getCategory(category)!
  const s = getSubcategory(category, subcategory)!
  const { prev, next } = neighbours(sheet)
  const related = relatedSheets(sheet)
  useEffect(() => recordVisit(sheet.slug), [sheet.slug])
  const sections = useMemo(
    () =>
      [
        { id: "visual", label: "Visual" },
        { id: "what", label: "What it is" },
        sheet.formulas?.length && { id: "formulas", label: "Key formulas" },
        sheet.rules?.length && { id: "rules", label: "Rules of thumb" },
        { id: "code", label: "Implementation" },
        { id: "mistakes", label: "Common mistakes" },
        { id: "prompt", label: "Prompt" },
        related.length > 0 && { id: "related", label: "Related" },
      ].filter((x): x is { id: string; label: string } => Boolean(x)),
    [sheet, related.length]
  )
  const minutes = readingMinutes(sheet)

  return (
    <div className="gap-10 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)_11rem]">
      <ReadingProgress target="sheet-article" />
      <SheetSidebar current={sheet} />
      <article id="sheet-article" className="mx-auto w-full max-w-3xl min-w-0">
        <Breadcrumbs
          items={[
            { label: c.title, to: categoryPath(c.slug) },
            { label: s.title, to: subcategoryPath(c.slug, s.slug) },
            { label: sheet.title },
          ]}
        />
        <header className="mb-7">
          <h1 className="font-heading text-sheet">{sheet.title}</h1>
          <p className="mt-3 text-lead text-muted-foreground first-letter:uppercase">
            {sheet.hook}
          </p>
          <p className="mt-3 max-w-2xl leading-relaxed">{sheet.summary}</p>
          <p className="mt-4 flex flex-wrap items-center gap-1.5">
            <LevelPips level={sheet.level} />
            <Badge
              variant="secondary"
              className="font-normal text-muted-foreground"
            >
              {minutes} min read
            </Badge>
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <CopyButton
              label="Copy prompt"
              copiedLabel="Prompt copied"
              text={promptMarkdown(sheet.title, sheet.prompt)}
              event="copy_prompt"
            />
            <CopyButton
              label="Copy as Markdown"
              getText={copyMarkdown(sheet.slug)}
              event="copy_markdown"
            />
            <CopyButton
              label="Copy embed code"
              copiedLabel="Embed code copied"
              text={embedCode(sheet)}
              event="copy_embed"
            />
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <a href={sheetMarkdownPath(sheet)} type="text/markdown" />
              }
            >
              <FileText aria-hidden /> View .md
            </Button>
          </div>
        </header>

        <section id="visual" aria-label="Interactive visual" className="mb-10">
          <VisualShell slug={sheet.slug} title={sheet.title} />
          <p className="mt-3 text-sm text-muted-foreground">
            <Rich text={sheet.visual} />
          </p>
        </section>

        <div className="prose-sheet space-y-10">
          <section aria-labelledby="what">
            <h2 id="what">What it is</h2>
            {sheet.what.map((p, i) => (
              <p key={i}>
                <Rich text={p} />
              </p>
            ))}
            <ul
              aria-label="Tags"
              className="!mt-4 flex !list-none flex-wrap gap-1.5 !pl-0"
            >
              {sheet.tags.map((t) => (
                <li key={t} className="!m-0">
                  <Badge variant="outline" className="text-muted-foreground">
                    {t}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>

          {sheet.formulas?.length ? (
            <section aria-labelledby="formulas">
              <h2 id="formulas">Key formulas</h2>
              <dl className="grid gap-2.5">
                {sheet.formulas.map((f) => (
                  <Card key={f.label} size="sm" className="card-lift dark px-4">
                    <dt className="eyebrow">{f.label}</dt>
                    <dd>
                      {f.math.html ? (
                        <div
                          className="formula overflow-x-auto"
                          // Long formulas scroll sideways: keyboards must reach them.
                          tabIndex={0}
                          role="group"
                          aria-label={f.label}
                          dangerouslySetInnerHTML={{ __html: f.math.html }}
                        />
                      ) : (
                        <code>{f.math.tex}</code>
                      )}
                      {f.note && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          <Rich text={f.note} />
                        </p>
                      )}
                    </dd>
                  </Card>
                ))}
              </dl>
            </section>
          ) : null}

          {sheet.rules?.length ? (
            <section aria-labelledby="rules">
              <h2 id="rules">Rules of thumb</h2>
              <ul>
                {sheet.rules.map((r, i) => (
                  <li key={i}>
                    <Rich text={r} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="code">
            <h2 id="code">Implementation</h2>
            <div className="space-y-4">
              {sheet.code.map((block, i) => (
                <figure key={i} className="space-y-2">
                  {block.caption && (
                    <figcaption className="text-sm text-muted-foreground">
                      <Rich text={block.caption} />
                    </figcaption>
                  )}
                  <SheetCode code={block.code} lang={block.lang} />
                </figure>
              ))}
            </div>
          </section>

          <section aria-labelledby="mistakes">
            <h2 id="mistakes">Common mistakes</h2>
            <ul>
              {sheet.mistakes.map((m, i) => (
                <li key={i}>
                  <Rich text={m} />
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="prompt">
            <h2 id="prompt">Prompt</h2>
            <SheetCode
              code={promptMarkdown(sheet.title, sheet.prompt)}
              lang="markdown"
              title="Prompt for your AI assistant"
              wrap
              onCopy={() =>
                window.dispatchEvent(
                  new CustomEvent("gdcs:event", { detail: "copy_prompt" })
                )
              }
            />
          </section>

          <SheetPaths slug={sheet.slug} />

          {related.length > 0 && (
            <section aria-labelledby="related">
              <h2 id="related">Related</h2>
              <ul className="grid !list-none grid-cols-1 gap-2.5 !pl-0 sm:grid-cols-2">
                {related.map((r) => (
                  <li key={r.slug} className="!m-0">
                    <SheetEndCard
                      title={r.title}
                      to={sheetPath(r)}
                      meta={getCategory(r.category)?.title ?? ""}
                      stretched
                    >
                      <span
                        className="block truncate first-letter:uppercase"
                        title={r.hook}
                      >
                        {r.hook}
                      </span>
                    </SheetEndCard>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {sheet.reading.length > 0 && (
            <section aria-labelledby="reading">
              <h2 id="reading">Further reading</h2>
              <ul>
                {sheet.reading.map((r) => (
                  <li key={r.url}>
                    <a
                      href={r.url}
                      className="link-quiet"
                      rel="noopener"
                      target="_blank"
                    >
                      {r.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <nav
          aria-label="More in this subcategory"
          className="mt-14 grid gap-2.5 sm:grid-cols-2"
        >
          {prev && (
            <Card size="sm" className="card-lift relative">
              <CardContent className="flex items-center gap-3">
                <ArrowLeft
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="eyebrow block">Previous</span>
                  <Link
                    to={sheetPath(prev)}
                    className="font-medium after:absolute after:inset-0"
                  >
                    {prev.title}
                  </Link>
                </span>
              </CardContent>
            </Card>
          )}
          {next && (
            <Card size="sm" className="card-lift relative sm:col-start-2">
              <CardContent className="flex items-center justify-end gap-3 text-right">
                <span className="min-w-0">
                  <span className="eyebrow block">Next</span>
                  <Link
                    to={sheetPath(next)}
                    className="font-medium after:absolute after:inset-0"
                  >
                    {next.title}
                  </Link>
                </span>
                <ArrowRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </CardContent>
            </Card>
          )}
        </nav>
        <p className="mt-6 text-xs text-muted-foreground">
          Updated {sheet.updated}. Text CC BY 4.0, code MIT, simulation
          embeddable.{" "}
          <Link to={LICENSE_PATH} className="link-quiet">
            License
          </Link>
        </p>
      </article>
      <TableOfContents sections={sections} />
    </div>
  )
}

/** ~200 wpm over the prose and code, plus a minute for the visual. */
function readingMinutes(sheet: {
  what: string[]
  rules?: string[]
  mistakes: string[]
  code: { code: string }[]
}) {
  const words = [
    ...sheet.what,
    ...(sheet.rules ?? []),
    ...sheet.mistakes,
    ...sheet.code.map((c) => c.code),
  ]
    .join(" ")
    .split(/\s+/).length
  return Math.max(2, Math.round(words / 200) + 1)
}
