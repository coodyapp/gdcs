import { Suspense, use } from "react"
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
import { Breadcrumbs } from "@/components/breadcrumbs"
import { CopyButton } from "@/components/copy-button"
import { Rich } from "@/components/rich"
import { NotFoundPage } from "@/pages/not-found"
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
        <article className="mx-auto max-w-4xl" aria-busy="true">
          <h1 className="mt-14 font-heading text-display">{meta.title}</h1>
          <p className="mt-3 text-lead text-muted-foreground italic">
            {meta.hook}
          </p>
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

  return (
    <article className="mx-auto max-w-4xl">
      <Breadcrumbs
        items={[
          { label: c.title, to: categoryPath(c.slug) },
          { label: s.title, to: subcategoryPath(c.slug, s.slug) },
          { label: sheet.title },
        ]}
      />
      <header className="mb-8">
        <p className="eyebrow mb-3">
          {c.title} · {s.title} · {sheet.level}
        </p>
        <h1 className="font-heading text-display">{sheet.title}</h1>
        <p className="mt-3 text-lead text-muted-foreground italic">
          {sheet.hook}
        </p>
        <p className="mt-4 max-w-2xl">{sheet.summary}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <CopyButton
            label="Copy prompt"
            text={sheet.prompt}
            event="copy_prompt"
          />
          <CopyButton
            label="Copy as Markdown"
            getText={copyMarkdown(sheet.slug)}
            event="copy_markdown"
          />
          <a
            href={sheetMarkdownPath(sheet)}
            className="chip"
            type="text/markdown"
          >
            <FileText className="size-3.5" aria-hidden /> View .md
          </a>
        </div>
      </header>

      <section aria-label="Interactive visual" className="mb-12">
        <VisualShell slug={sheet.slug} title={sheet.title} />
        <p className="mt-3 text-sm text-muted-foreground">
          <Rich text={sheet.visual} />
        </p>
      </section>

      <div className="prose-sheet space-y-12">
        <section aria-labelledby="what">
          <h2 id="what">What it is</h2>
          {sheet.what.map((p, i) => (
            <p key={i}>
              <Rich text={p} />
            </p>
          ))}
        </section>

        {sheet.formulas?.length ? (
          <section aria-labelledby="formulas">
            <h2 id="formulas">Key formulas</h2>
            <dl className="grid gap-3">
              {sheet.formulas.map((f) => (
                <div key={f.label} className="rounded-lg border bg-card p-4">
                  <dt className="eyebrow mb-2">{f.label}</dt>
                  <dd>
                    {f.math.html ? (
                      <div
                        className="formula overflow-x-auto"
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
                </div>
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
          {sheet.code.map((block, i) => (
            <figure key={i} className="space-y-2">
              {block.caption && (
                <figcaption className="text-sm text-muted-foreground">
                  <Rich text={block.caption} />
                </figcaption>
              )}
              <div className="relative">
                <pre className="code-block" data-lang={block.lang}>
                  <code>{block.code.trim()}</code>
                </pre>
                <CopyButton
                  label="Copy"
                  text={block.code.trim()}
                  className="absolute top-2 right-2 !min-h-7 !px-2 text-[11px]"
                />
              </div>
            </figure>
          ))}
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
          <div className="relative">
            <pre className="code-block whitespace-pre-wrap">{sheet.prompt}</pre>
            <CopyButton
              label="Copy prompt"
              text={sheet.prompt}
              className="absolute top-2 right-2 !min-h-7 !px-2 text-[11px]"
              event="copy_prompt"
            />
          </div>
        </section>

        {related.length > 0 && (
          <section aria-labelledby="related">
            <h2 id="related">Related</h2>
            <ul className="grid !list-none gap-2 !pl-0 sm:grid-cols-2">
              {related.map((r) => (
                <li key={r.slug} className="!m-0">
                  <Link
                    to={sheetPath(r)}
                    className="block rounded-lg border p-3 transition-colors hover:border-foreground/30"
                  >
                    <span className="font-medium">{r.title}</span>
                    <span className="block text-sm text-muted-foreground">
                      {r.hook}
                    </span>
                  </Link>
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
        className="mt-16 grid gap-3 border-t pt-6 sm:grid-cols-2"
      >
        {prev && (
          <Link
            to={sheetPath(prev)}
            className="group flex items-center gap-3 rounded-lg border p-4 hover:border-foreground/30"
          >
            <ArrowLeft className="size-4 text-muted-foreground" aria-hidden />
            <span>
              <span className="eyebrow block">Previous</span>
              {prev.title}
            </span>
          </Link>
        )}
        {next && (
          <Link
            to={sheetPath(next)}
            className="group flex items-center justify-end gap-3 rounded-lg border p-4 text-right hover:border-foreground/30 sm:col-start-2"
          >
            <span>
              <span className="eyebrow block">Next</span>
              {next.title}
            </span>
            <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        )}
      </nav>
      <p className="mt-6 text-xs text-muted-foreground">
        Updated {sheet.updated}
      </p>
    </article>
  )
}
