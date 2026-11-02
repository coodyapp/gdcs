import { Link, useParams } from "react-router-dom"
import {
  ArrowRight,
  Atom,
  Axis3d,
  Brain,
  Check,
  Gamepad2,
  Layers,
  Mountain,
  Network,
  PersonStanding,
  Route,
  type LucideIcon,
} from "lucide-react"

import { getCategory, getSheet, sheetPath, type SheetMeta } from "@/content"
import { getPath, pathUrl, paths, type LearningPath } from "@/content/paths"
import { useHistory } from "@/lib/local"
import { cn } from "@/lib/utils"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { LevelPips } from "@/components/sheet-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Progress } from "@/components/ui/progress"
import { NotFoundPage } from "@/pages/not-found"

const stepsOf = (path: LearningPath) =>
  path.steps
    .map((s) => ({ ...s, sheet: getSheet(s.slug) }))
    .filter((s): s is typeof s & { sheet: SheetMeta } => Boolean(s.sheet))

/** Shared poster thumbnail, same artwork as the sheet cards. */
function Poster({ slug, className }: { slug: string; className?: string }) {
  return (
    <img
      src={`/posters/${slug}.webp`}
      alt=""
      width={960}
      height={600}
      loading="lazy"
      decoding="async"
      className={cn("aspect-[16/10] w-full object-cover", className)}
    />
  )
}

const PATH_ICONS: Record<string, LucideIcon> = {
  "3d-math-foundations": Axis3d,
  "platformer-feel": Gamepad2,
  "collision-and-physics": Atom,
  "character-animation": PersonStanding,
  "rendering-pipeline": Layers,
  "procedural-worlds": Mountain,
  "multiplayer-netcode": Network,
  "game-ai": Brain,
}

function PathProgress({ done, total }: { done: number; total: number }) {
  return (
    <Progress
      value={(done / total) * 100}
      aria-label={`${done} of ${total} steps visited`}
      className="w-full flex-nowrap items-center"
    >
      <span className="order-last shrink-0 text-xs text-muted-foreground tabular-nums">
        {done}/{total}
      </span>
    </Progress>
  )
}

export function PathCard({
  path,
  heading: Heading = "h3",
}: {
  path: LearningPath
  /** h2 where the cards are the page's top-level sections. */
  heading?: "h2" | "h3"
}) {
  const { visited } = useHistory()
  const steps = stepsOf(path)
  const done = steps.filter((s) => visited.has(s.slug)).length
  const Icon = PATH_ICONS[path.slug] ?? Route
  return (
    <Card
      render={<article />}
      className="card-lift relative h-full gap-3 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-foreground"
    >
      <CardContent>
        <span className="grid size-10 place-items-center rounded-lg bg-muted text-foreground ring-1 ring-foreground/10">
          <Icon className="size-5" aria-hidden />
        </span>
      </CardContent>
      <CardHeader>
        <CardTitle className="text-[1.0625rem] font-semibold">
          <Heading>
            <Link
              to={pathUrl(path.slug)}
              className="after:absolute after:inset-0 focus-visible:outline-none"
            >
              {path.title}
            </Link>
          </Heading>
        </CardTitle>
        <CardDescription className="line-clamp-2 leading-relaxed">
          {path.summary}
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-auto">
        <PathProgress done={done} total={steps.length} />
      </CardContent>
    </Card>
  )
}

export function PathsIndexPage() {
  return (
    <>
      <Breadcrumbs items={[{ label: "Learning paths" }]} />
      <header className="mb-10 max-w-3xl">
        <h1 className="font-heading text-sheet">Learning paths</h1>
        <p className="mt-4 text-lead text-muted-foreground">
          Ordered routes through the cheat sheets for a specific goal. Progress
          is saved in this browser only.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {paths.map((p) => (
          <PathCard key={p.slug} path={p} heading="h2" />
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
    <div className="mx-auto max-w-3xl">
      <Breadcrumbs
        items={[
          { label: "Learning paths", to: "/paths" },
          { label: path.title },
        ]}
      />
      <header className="mb-8">
        <h1 className="font-heading text-sheet">{path.title}</h1>
        <p className="mt-4 text-lead text-muted-foreground">{path.summary}</p>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button
            size="lg"
            className="h-10 max-w-full px-4"
            nativeButton={false}
            render={<Link to={sheetPath(next.sheet)} />}
          >
            <span className="truncate">
              {done === 0
                ? "Start"
                : done === steps.length
                  ? "Review"
                  : "Continue"}
              : {next.sheet.title}
            </span>
            <ArrowRight aria-hidden />
          </Button>
          <div className="w-40">
            <PathProgress done={done} total={steps.length} />
          </div>
        </div>
      </header>
      <ol className="space-y-2.5">
        {steps.map((s, i) => {
          const seen = visited.has(s.slug)
          return (
            <li key={s.slug}>
              <Item
                variant="outline"
                className="card-lift bg-card p-2.5 pr-4 hover:bg-card"
                render={<Link to={sheetPath(s.sheet)} />}
              >
                <ItemMedia className="w-24 self-center overflow-hidden rounded-md sm:w-32">
                  <Poster slug={s.slug} />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="text-[0.9375rem]">
                    <span className="text-muted-foreground tabular-nums">
                      {i + 1}.
                    </span>{" "}
                    {s.sheet.title}
                    {seen && (
                      <Check
                        className="size-3.5 text-muted-foreground"
                        aria-label="visited"
                      />
                    )}
                  </ItemTitle>
                  <ItemDescription className="line-clamp-2">
                    {s.why}
                  </ItemDescription>
                  <div className="mt-1.5 flex gap-1.5">
                    <LevelPips level={s.sheet.level} />
                    <Badge
                      variant="secondary"
                      className="font-normal text-muted-foreground"
                    >
                      {getCategory(s.sheet.category)?.short ??
                        getCategory(s.sheet.category)?.title}
                    </Badge>
                  </div>
                </ItemContent>
              </Item>
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
      <ul className="grid !list-none gap-2.5 !pl-0 sm:grid-cols-2">
        {member.map(({ p, i }) => {
          const next = p.steps[i + 1] && getSheet(p.steps[i + 1].slug)
          return (
            <li key={p.slug} className="!m-0">
              <Card size="sm" className="card-lift h-full">
                <CardHeader>
                  <CardTitle className="font-sans font-medium">
                    <Link to={pathUrl(p.slug)} className="hover:underline">
                      {p.title}
                    </Link>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Step {i + 1} of {p.steps.length}
                  </CardDescription>
                </CardHeader>
                {next && (
                  <CardContent>
                    <Link
                      to={sheetPath(next)}
                      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      Next: {next.title}
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  </CardContent>
                )}
              </Card>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
