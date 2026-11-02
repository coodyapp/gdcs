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

export interface SheetFilters<L extends string = SheetMeta["level"]> {
  query: string
  categories: string[]
  level: L | "all"
}

/** Every sheet passing the category and level filters; ranked when there is a query. */
export function searchFiltered(list: SheetMeta[], filters: SheetFilters) {
  const matching = list.filter(
    (s) =>
      (!filters.categories.length || filters.categories.includes(s.category)) &&
      (filters.level === "all" || s.level === filters.level)
  )
  return filters.query.trim()
    ? searchSheets(matching, filters.query, matching.length)
    : matching
}

function subsequence(text: string, needle: string) {
  let i = 0
  for (const ch of text) if (ch === needle[i]) i++
  return i === needle.length
}
