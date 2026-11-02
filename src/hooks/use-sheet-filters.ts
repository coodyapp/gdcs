import { useEffect, useState } from "react"

import { SORTS, type SheetFilters, type SortKey } from "@/lib/search"

export const LEVELS = ["core", "common", "advanced"] as const

export const NO_FILTERS: SheetFilters = {
  query: "",
  categories: [],
  subcategory: "",
  level: "all",
  sort: "relevance",
}

/** Whether anything narrows the list. Sorting alone does not. */
export const isFiltering = (f: SheetFilters) =>
  f.query.trim() !== "" ||
  f.categories.length > 0 ||
  f.subcategory !== "" ||
  f.level !== "all"

/** Search and filters mirrored in the URL (?q=&cat=&sub=&level=&sort=), read after hydration. */
export function useSheetFilters() {
  const [filters, setFilters] = useState<SheetFilters>(NO_FILTERS)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const level = q.get("level") as SheetFilters["level"] | null
    const sort = q.get("sort") as SortKey | null
    setFilters({
      query: q.get("q") ?? "",
      categories: (q.get("cat") ?? "").split(",").filter(Boolean),
      subcategory: q.get("sub") ?? "",
      level: level && LEVELS.includes(level as never) ? level : "all",
      sort: sort && sort in SORTS ? sort : "relevance",
    })
  }, [])
  const update = (next: SheetFilters) => {
    setFilters(next)
    const url = new URL(window.location.href)
    const set = (k: string, v: string) =>
      v ? url.searchParams.set(k, v) : url.searchParams.delete(k)
    set("q", next.query)
    set("cat", next.categories.join(","))
    set("sub", next.subcategory)
    set("level", next.level === "all" ? "" : next.level)
    set("sort", next.sort === "relevance" ? "" : next.sort)
    window.history.replaceState(window.history.state, "", url)
  }
  return [filters, update] as const
}
