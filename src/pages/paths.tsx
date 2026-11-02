import { Link, useParams } from "react-router-dom"
import { ArrowRight, Check } from "lucide-react"

import { getCategory, getSheet, sheetPath, type SheetMeta } from "@/content"
import { getPath, pathUrl, paths, type LearningPath } from "@/content/paths"
import { catStyle } from "@/lib/accent"
import { useHistory } from "@/lib/local"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { LevelPips } from "@/components/sheet-card"
import { NotFoundPage } from "@/pages/not-found"

const stepsOf = (path: LearningPath) =>
  path.steps
    .map((s) => ({ ...s, sheet: getSheet(s.slug) }))
    .filter((s): s is typeof s & { sheet: SheetMeta } => Boolean(s.sheet))

function Progress({ done, total }: { done: number; total: number }) {
  return (
    <div
      className="flex items-center gap-3"
      aria-label={`${done} of ${total} visited`}
    >
      <div
        className="h-1.5 w-32 overflow-hidden rounded-full bg-white/10"
        aria-hidden
      >
        <div
          className="h-full rounded-full bg-[var(--color-ui-strong)] transition-[width] duration-300"
          style={{ width: `${(done / total) * 100}%` }}
        />
      </div>
      <span className="font-hud text-xs text-text-3">
        {done}/{total}
      </span>
    </div>
  )
}

export function PathCard({ path }: { path: LearningPath }) {
  const { visited } = useHistory()
  const steps = stepsOf(path)
  const done = steps.filter((s) => visited.has(s.slug)).length
  return (
    <article
      style={catStyle(path.accent)}
      className="group relative flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-card p-5 transition-colors before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:rounded-t-xl before:bg-[var(--cat)] before:opacity-60 hover:border-white/[0.16] hover:bg-surface-2 hover:before:opacity-100"
    >
      <p className="eyebrow flex items-center gap-2">
        <span className="cat-dot" aria-hidden /> {steps.length} steps
      </p>
      <h3 className="font-heading text-xl leading-tight">
        <Link to={pathUrl(path.slug)} className="after:absolute after:inset-0">
          {path.title}
        </Link>
      </h3>
      <p className="text-sm text-muted-foreground">{path.summary}</p>
      <div className="mt-auto pt-2">
        <Progress done={done} total={steps.length} />
      </div>
    </article>
  )
}

export function PathsIndexPage() {
  return (
    <>
      <Breadcrumbs items={[{ label: "Learning paths" }]} />
      <header className="mb-10 max-w-3xl">
        <h1 className="font-heading text-display">Learning paths</h1>
        <p className="mt-4 text-lead text-muted-foreground">
          Ordered routes through the cheat sheets for a specific goal. Progress
          is saved in this browser only.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {paths.map((p) => (
          <PathCard key={p.slug} path={p} />
        ))}
      </div>
    </>
  )
}

export function PathPage() {
  const { path: slug = "" } = useParams()
  const path = getPath(slug)
  const { visited } = useHistory()
  if (!path) return <NotFoundPage />
  const steps = stepsOf(path)
  const done = steps.filter((s) => visited.has(s.slug)).length
  const next = steps.find((s) => !visited.has(s.slug)) ?? steps[0]
  return (
    <div style={catStyle(path.accent)} className="mx-auto max-w-3xl">
      <Breadcrumbs
        items={[
          { label: "Learning paths", to: "/paths" },
          { label: path.title },
        ]}
      />
      <header className="mb-10">
        <p className="eyebrow mb-3 flex items-center gap-2">
          <span className="cat-dot" aria-hidden /> Learning path ·{" "}
          {steps.length} steps
        </p>
        <h1 className="font-heading text-display">{path.title}</h1>
        <p className="mt-4 text-lead text-muted-foreground">{path.summary}</p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link
            to={sheetPath(next.sheet)}
            className="chip !border-[var(--cat)] bg-[color-mix(in_oklch,var(--cat)_14%,transparent)]"
          >
            {done === 0
              ? "Start"
              : done === steps.length
                ? "Review"
                : "Continue"}
            : {next.sheet.title} <ArrowRight className="size-3.5" aria-hidden />
          </Link>
          <Progress done={done} total={steps.length} />
        </div>
      </header>
      <ol className="relative space-y-3 border-l border-white/10 pl-6">
        {steps.map((s, i) => {
          const seen = visited.has(s.slug)
          return (
            <li
              key={s.slug}
              className="relative"
              style={catStyle(s.sheet.category)}
            >
              <span
                className={`absolute top-4 -left-[2.1rem] grid size-6 place-items-center rounded-full border font-hud text-[11px] ${seen ? "border-[var(--color-ui-strong)] bg-[color-mix(in_oklch,var(--color-ui-strong)_15%,transparent)] text-[var(--color-ui-strong)]" : "border-white/20 bg-background text-text-3"}`}
                aria-hidden
              >
                {seen ? <Check className="size-3" /> : i + 1}
              </span>
              <Link
                to={sheetPath(s.sheet)}
                className="block rounded-xl border border-white/[0.08] bg-card p-4 transition-colors hover:border-white/[0.16] hover:bg-surface-2"
              >
                <span className="mb-1 flex items-center justify-between gap-3">
                  <span className="eyebrow flex items-center gap-2">
                    <span className="cat-dot" aria-hidden />
                    {getCategory(s.sheet.category)?.title}
                  </span>
                  <LevelPips level={s.sheet.level} />
                </span>
                <span className="block font-heading text-lg">
                  {i + 1}. {s.sheet.title}
                  {seen && <span className="sr-only"> (visited)</span>}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {s.why}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** On a sheet page: which paths include it, with the next step. */
export function SheetPaths({ slug }: { slug: string }) {
  const member = paths
    .map((p) => ({ p, i: p.steps.findIndex((s) => s.slug === slug) }))
    .filter((x) => x.i >= 0)
  if (!member.length) return null
  return (
    <section aria-labelledby="paths">
      <h2 id="paths">In learning paths</h2>
      <ul className="grid !list-none gap-2 !pl-0 sm:grid-cols-2">
        {member.map(({ p, i }) => {
          const next = p.steps[i + 1] && getSheet(p.steps[i + 1].slug)
          return (
            <li key={p.slug} className="!m-0" style={catStyle(p.accent)}>
              <div className="rounded-lg border border-white/[0.08] bg-card p-3">
                <Link
                  to={pathUrl(p.slug)}
                  className="flex items-center gap-2 font-medium hover:underline"
                >
                  <span className="cat-dot" aria-hidden /> {p.title}
                </Link>
                <span className="block text-xs text-text-3">
                  Step {i + 1} of {p.steps.length}
                </span>
                {next && (
                  <Link
                    to={sheetPath(next)}
                    className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Next: {next.title}{" "}
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
