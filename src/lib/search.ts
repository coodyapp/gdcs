import type { SheetMeta } from "@/content"

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")

/**
 * Small fuzzy ranker (no dependency): exact/prefix/word matches in the
 * title score highest, then hook/tags/category, then in-order letters
 * (so "fxts" finds "Fixed timestep"). Returns best first.
 */
export function searchSheets(list: SheetMeta[], query: string, limit = 12) {
  const q = norm(query.trim())
  if (!q) return []
  const terms = q.split(/\s+/)
  const scored: { sheet: SheetMeta; score: number }[] = []
  for (const sheet of list) {
    const title = norm(sheet.title)
    const rest = norm(
      [
        sheet.hook,
        sheet.tags.join(" "),
        sheet.category,
        sheet.subcategory,
        sheet.slug,
      ].join(" ")
    )
    let score = 0
    for (const t of terms) {
      if (title === t) score += 100
      else if (title.startsWith(t)) score += 60
      else if (
        new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(title)
      )
        score += 40
      else if (title.includes(t)) score += 25
      else if (rest.includes(t)) score += 12
      else if (subsequence(title, t)) score += 6
      else {
        score = 0
        break
      }
    }
    if (score > 0) scored.push({ sheet, score })
  }
  return scored
    .sort(
      (a, b) => b.score - a.score || a.sheet.title.localeCompare(b.sheet.title)
    )
    .slice(0, limit)
    .map((s) => s.sheet)
}

export const SORTS = {
  relevance: "Best match",
  easiest: "Easiest first",
  az: "A to Z",
  newest: "Recently updated",
} as const
export type SortKey = keyof typeof SORTS

export interface SheetFilters {
  query: string
  categories: string[]
  subcategory: string
  level: SheetMeta["level"] | "all"
  sort: SortKey
}

const LEVEL_ORDER = ["core", "common", "advanced"]

const inCategory = (s: SheetMeta, f: SheetFilters) =>
  !f.categories.length || f.categories.includes(s.category)
const inSubcategory = (s: SheetMeta, f: SheetFilters) =>
  !f.subcategory || s.subcategory === f.subcategory
const inLevel = (s: SheetMeta, f: SheetFilters) =>
  f.level === "all" || s.level === f.level

const matching = (list: SheetMeta[], query: string) =>
  query.trim() ? searchSheets(list, query, list.length) : list

const COMPARE: Record<
  Exclude<SortKey, "relevance">,
  (a: SheetMeta, b: SheetMeta) => number
> = {
  easiest: (a, b) =>
    LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level),
  az: (a, b) => a.title.localeCompare(b.title),
  newest: (a, b) => b.updated.localeCompare(a.updated),
}

/** Every sheet passing the filters: ranked for a query, then sorted if asked. */
export function searchFiltered(list: SheetMeta[], filters: SheetFilters) {
  const found = matching(
    list.filter(
      (s) =>
        inCategory(s, filters) &&
        inSubcategory(s, filters) &&
        inLevel(s, filters)
    ),
    filters.query
  )
  return filters.sort === "relevance"
    ? found
    : [...found].sort(COMPARE[filters.sort])
}

/**
 * How many sheets each choice would give, counting every other active filter
 * but not its own group, so a count always equals what clicking it shows.
 */
export function facetCounts(list: SheetMeta[], filters: SheetFilters) {
  const categories: Record<string, number> = {}
  const subcategories: Record<string, number> = {}
  const levels: Record<string, number> = { all: 0 }
  for (const s of matching(list, filters.query)) {
    if (inLevel(s, filters))
      categories[s.category] = (categories[s.category] ?? 0) + 1
    if (inCategory(s, filters) && inLevel(s, filters))
      subcategories[s.subcategory] = (subcategories[s.subcategory] ?? 0) + 1
    if (inCategory(s, filters) && inSubcategory(s, filters)) {
      levels.all += 1
      levels[s.level] = (levels[s.level] ?? 0) + 1
    }
  }
  return { categories, subcategories, levels }
}

/** Splits a title around the words of a search, for highlighting. */
export function highlightParts(title: string, query: string) {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  if (!terms.length) return [{ text: title, match: false }]
  return title
    .split(new RegExp(`(${terms.join("|")})`, "gi"))
    .filter(Boolean)
    .map((text) => ({
      text,
      match: terms.some((t) => new RegExp(`^${t}$`, "i").test(text)),
    }))
}

function subsequence(text: string, needle: string) {
  let i = 0
  for (const ch of text) if (ch === needle[i]) i++
  return i === needle.length
}
