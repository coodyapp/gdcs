import type { Values, VisualDef } from "./core"

type Loader = () => Promise<{ default: VisualDef<Values> }>

const loaders = import.meta.glob<{ default: VisualDef<Values> }>(
  "./scenes/**/*.tsx"
)

/** Lazy visual modules keyed by sheet slug (the file's basename). */
export const visualLoaders: Record<string, Loader> = Object.fromEntries(
  Object.entries(loaders).map(([path, load]) => [
    path
      .split("/")
      .pop()!
      .replace(/\.tsx$/, ""),
    load,
  ])
)

export const hasVisual = (slug: string) => slug in visualLoaders
