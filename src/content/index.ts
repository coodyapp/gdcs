import { categories } from "./taxonomy"
import type { Category, Sheet, SheetMeta, Subcategory } from "./types"

export { categories }
export type { Category, Sheet, SheetMeta, Subcategory }

/** Metadata only: the bundler drops each module's heavy default export. */
const metaModules = import.meta.glob<SheetMeta>("./sheets/**/*.ts", {
  eager: true,
  import: "meta",
})
/** Full sheets (formulas, code…), one lazy chunk each. */
// `?body` makes these distinct modules from the eager `meta` imports above,
// so each body becomes its own chunk instead of joining the main bundle.
const bodyLoaders = import.meta.glob<Sheet>("./sheets/**/*.ts", {
  import: "default",
  query: "?body",
})
const loaderBySlug = new Map(
  Object.entries(bodyLoaders).map(([path, load]) => [
    path
      .split("/")
      .pop()!
      .replace(/\.ts(\?body)?$/, ""),
    load,
  ])
)
const bodies = new Map<string, Sheet>()
const pending = new Map<string, Promise<Sheet>>()

/** Full sheet if already loaded (always true on the server and after preload). */
export const getLoadedSheet = (slug: string) => bodies.get(slug)

/** Loads (once) and caches a full sheet. */
export function loadSheet(slug: string): Promise<Sheet> {
  const ready = bodies.get(slug)
  if (ready) return Promise.resolve(ready)
  let p = pending.get(slug)
  if (!p) {
    const load = loaderBySlug.get(slug)
    if (!load) return Promise.reject(new Error(`Unknown sheet ${slug}`))
    p = load().then((sheet) => {
      bodies.set(slug, sheet)
      return sheet
    })
    pending.set(slug, p)
  }
  return p
}

/** Server/build only: make every full sheet available synchronously. */
export function primeSheets(all: Sheet[]) {
  for (const s of all) bodies.set(s.slug, s)
}

const categoryOrder = new Map(categories.map((c, i) => [c.slug, i]))
const subOrder = new Map(
  categories.flatMap((c) =>
    c.subcategories.map((s, i) => [`${c.slug}/${s.slug}`, i] as const)
  )
)

/** All sheets in display order: category, subcategory, then title. */
export const sheets: SheetMeta[] = Object.values(metaModules).sort(
  (a, b) =>
    (categoryOrder.get(a.category) ?? 99) -
      (categoryOrder.get(b.category) ?? 99) ||
    (subOrder.get(`${a.category}/${a.subcategory}`) ?? 99) -
      (subOrder.get(`${b.category}/${b.subcategory}`) ?? 99) ||
    a.title.localeCompare(b.title)
)

const bySlug = new Map(sheets.map((s) => [s.slug, s]))

export const getSheet = (slug: string) => bySlug.get(slug)
export const getCategory = (slug: string) =>
  categories.find((c) => c.slug === slug)
export const getSubcategory = (category: string, sub: string) =>
  getCategory(category)?.subcategories.find((s) => s.slug === sub)

export const sheetsIn = (category: string, sub?: string) =>
  sheets.filter(
    (s) => s.category === category && (!sub || s.subcategory === sub)
  )

export const categoryPath = (category: string) => `/${category}`
export const subcategoryPath = (category: string, sub: string) =>
  `/${category}/${sub}`
export const sheetPath = (
  s: Pick<SheetMeta, "category" | "subcategory" | "slug">
) => `/${s.category}/${s.subcategory}/${s.slug}`
export const sheetMarkdownPath = (
  s: Pick<SheetMeta, "category" | "subcategory" | "slug">
) => `${sheetPath(s)}.md`

/** Previous/next sheet inside the same subcategory (wrapping). */
export function neighbours(sheet: SheetMeta) {
  const list = sheetsIn(sheet.category, sheet.subcategory)
  const i = list.findIndex((s) => s.slug === sheet.slug)
  if (list.length < 2) return { prev: undefined, next: undefined }
  return {
    prev: list[(i - 1 + list.length) % list.length],
    next: list[(i + 1) % list.length],
  }
}

export const relatedSheets = (sheet: SheetMeta) =>
  sheet.related.map(getSheet).filter((s): s is SheetMeta => Boolean(s))

/** Categories that currently have at least one sheet. */
export const liveCategories = () =>
  categories
    .map((c) => ({
      ...c,
      subcategories: c.subcategories.filter(
        (s) => sheetsIn(c.slug, s.slug).length > 0
      ),
    }))
    .filter((c) => c.subcategories.length > 0)
