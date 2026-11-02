import { Moon, Sun } from "lucide-react"

import { useTheme } from "@/hooks/use-theme"
import { Button } from "@/components/ui/button"

/** Switches between light and dark; both icons render so hydration always matches. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const next = theme === "dark" ? "light" : "dark"
  return (
    <Button
      variant="outline"
      size="icon-lg"
      className={className}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={() => setTheme(next)}
    >
      <Sun className="hidden dark:block" aria-hidden />
      <Moon className="dark:hidden" aria-hidden />
    </Button>
  )
}
