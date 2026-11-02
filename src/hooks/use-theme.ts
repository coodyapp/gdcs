import { useCallback, useEffect, useState } from "react"

export type Theme = "light" | "dark"
const KEY = "gdcs-theme"

/** Colours of the browser UI, matching --background in each theme. */
const CHROME: Record<Theme, string> = { light: "#ffffff", dark: "#0a0a0a" }

/**
 * Light or dark. The inline script in index.html applies the saved choice (or
 * the system setting) before first paint; this keeps React and the page in step.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("dark")
  useEffect(() => {
    setThemeState(
      document.documentElement.classList.contains("dark") ? "dark" : "light"
    )
  }, [])
  const setTheme = useCallback((next: Theme) => {
    const root = document.documentElement
    root.classList.toggle("dark", next === "dark")
    root.style.colorScheme = next
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", CHROME[next])
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Private mode: the choice lasts until the page closes.
    }
    setThemeState(next)
  }, [])
  return { theme, setTheme }
}
