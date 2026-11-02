import { Monitor, Moon, Sun } from "lucide-react"

import { useTheme, type ThemeMode } from "@/hooks/use-theme"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const MODES: { value: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { value: "system", label: "Auto", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
]

/** Auto follows the device. Clicking the active option keeps it selected. */
export function ThemeSelector({ className }: { className?: string }) {
  const { mode, setMode } = useTheme()
  return (
    <ToggleGroup
      aria-label="Theme"
      spacing={1}
      className={className}
      value={[mode]}
      onValueChange={(next) => {
        if (next[0]) setMode(next[0] as ThemeMode)
      }}
    >
      {MODES.map(({ value, label, Icon }) => (
        <ToggleGroupItem
          key={value}
          value={value}
          aria-label={`${label} theme`}
          title={value === "system" ? "Auto: follow this device" : label}
          className="size-8 rounded-lg border-0 p-0 text-muted-foreground aria-pressed:bg-foreground aria-pressed:text-background data-[pressed]:bg-foreground data-[pressed]:text-background"
        >
          <Icon className="size-4" aria-hidden />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
