/**
 * Local-only reading history (never sent anywhere): visited sheets and the
 * last few opened. Every access is guarded; storage can be unavailable.
 */
import { useEffect, useState } from "react"

const VISITED = "gdcs:visited"
const RECENT = "gdcs:recent"
const EVENT = "gdcs:history"

function read(key: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]")
    return Array.isArray(value)
      ? value.filter((x) => typeof x === "string")
      : []
  } catch {
    return []
  }
}

function write(key: string, value: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    window.dispatchEvent(new Event(EVENT))
  } catch {
    // Private mode or blocked storage: history is a nicety.
  }
}

export function recordVisit(slug: string) {
  const visited = read(VISITED)
  if (!visited.includes(slug)) write(VISITED, [...visited, slug].slice(-500))
  write(RECENT, [slug, ...read(RECENT).filter((s) => s !== slug)].slice(0, 6))
}

/** Reactive history. Empty during SSR and hydration, filled after mount. */
export function useHistory() {
  const [state, setState] = useState<{
    visited: Set<string>
    recent: string[]
  }>({ visited: new Set(), recent: [] })
  useEffect(() => {
    const sync = () =>
      setState({ visited: new Set(read(VISITED)), recent: read(RECENT) })
    sync()
    window.addEventListener(EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])
  return state
}
