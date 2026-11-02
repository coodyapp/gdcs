import { useCallback, useEffect, useState } from "react"

/** "system" follows the device; it is the default and stores nothing. */
export type ThemeMode = "system" | "light" | "dark"
const KEY = "gdcs-theme"
const SYSTEM_LIGHT = "(prefers-color-scheme: light)"

/** Colours of the browser UI, matching --background in each theme. */
const CHROME = { light: "#ffffff", dark: "#0a0a0a" }

function apply(mode: ThemeMode) {
  const light =
    mode === "system"
      ? window.matchMedia(SYSTEM_LIGHT).matches
      : mode === "light"
  const theme = light ? "light" : "dark"
  const root = document.documentElement
  root.classList.toggle("dark", !light)
  root.style.colorScheme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", CHROME[theme])
}

function read(): ThemeMode {
  try {
    const saved = localStorage.getItem(KEY)
    return saved === "light" || saved === "dark" ? saved : "system"
  } catch {
    return "system"
  }
}

/**
 * The inline script in index.html applies the theme before first paint, using
 * the same storage key. This keeps it right afterwards, including when the
 * device switches between light and dark while the page is open.
 */
export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>("system")
  useEffect(() => setModeState(read()), [])
  useEffect(() => {
    if (mode !== "system") return
    const query = window.matchMedia(SYSTEM_LIGHT)
    const follow = () => apply("system")
    query.addEventListener("change", follow)
    return () => query.removeEventListener("change", follow)
  }, [mode])
  const setMode = useCallback((next: ThemeMode) => {
    apply(next)
    try {
      if (next === "system") localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, next)
    } catch {
      // Private mode: the choice lasts until the page closes.
    }
    setModeState(next)
  }, [])
  return { mode, setMode }
}
