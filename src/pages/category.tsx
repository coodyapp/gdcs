import { Link, useParams } from "react-router-dom"

import {
  getCategory,
  getSubcategory,
  sheetsIn,
  subcategoryPath,
  categoryPath,
} from "@/content"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { SheetGrid } from "@/components/sheet-card"
import { NotFoundPage } from "@/pages/not-found"

export function CategoryPage() {
  const { category = "" } = useParams()
  const c = getCategory(category)
  if (!c || !sheetsIn(category).length) return <NotFoundPage />
  const subs = c.subcategories.filter((s) => sheetsIn(c.slug, s.slug).length)
  return (
    <>
      <Breadcrumbs items={[{ label: c.title }]} />
      <header className="mb-10 max-w-3xl">
        <h1 className="font-heading text-sheet">{c.title}</h1>
        <p className="mt-3 text-lead text-muted-foreground">{c.description}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          {sheetsIn(c.slug).length} cheat sheets in {subs.length}{" "}
          {subs.length === 1 ? "group" : "groups"}
        </p>
      </header>
      <div className="space-y-12">
        {subs.map((s) => (
          <section
            key={s.slug}
            aria-labelledby={`sub-${s.slug}`}
            className="space-y-4"
          >
            <div>
              <h2 id={`sub-${s.slug}`} className="font-heading text-xl">
                <Link to={subcategoryPath(c.slug, s.slug)}>{s.title}</Link>
              </h2>
              <p className="text-sm text-muted-foreground">{s.description}</p>
            </div>
            <SheetGrid list={sheetsIn(c.slug, s.slug)} />
          </section>
        ))}
      </div>
    </>
  )
}

export function SubcategoryPage() {
  const { category = "", subcategory = "" } = useParams()
  const c = getCategory(category)
  const s = getSubcategory(category, subcategory)
  const list = sheetsIn(category, subcategory)
  if (!c || !s || !list.length) return <NotFoundPage />
  return (
    <>
      <Breadcrumbs
        items={[
          { label: c.title, to: categoryPath(c.slug) },
          { label: s.title },
        ]}
      />
      <header className="mb-10 max-w-3xl">
        <h1 className="font-heading text-sheet">{s.title}</h1>
        <p className="mt-3 text-lead text-muted-foreground">{s.description}</p>
      </header>
      <SheetGrid list={list} numbered />
    </>
  )
}
