import type { Ref } from "react"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

import type { ParamDef, Values } from "./core"

/** Parameter controls for a visual. Lazy: loaded with the scene. */
export default function Controls({
  params,
  values,
  onChange,
  readout,
  readoutRef,
}: {
  params: ParamDef[]
  values: Values
  onChange: (key: string, value: number | boolean | string) => void
  readout?: string
  readoutRef?: Ref<HTMLParagraphElement>
}) {
  return (
    <figcaption className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {params.map((p) => {
        const id = `param-${p.key}`
        if (p.type === "toggle") {
          return (
            <label
              key={p.key}
              htmlFor={id}
              className="flex items-center gap-2.5 text-sm"
            >
              <Switch
                id={id}
                checked={Boolean(values[p.key])}
                onCheckedChange={(checked) => onChange(p.key, checked)}
              />
              {p.label}
            </label>
          )
        }
        if (p.type === "select") {
          return (
            <div key={p.key} className="text-sm">
              <div id={`${id}-label`} className="mb-1.5 text-muted-foreground">
                {p.label}
              </div>
              <ToggleGroup
                aria-labelledby={`${id}-label`}
                variant="outline"
                size="sm"
                spacing={1}
                className="flex-wrap"
                value={[String(values[p.key])]}
                onValueChange={(next) => next[0] && onChange(p.key, next[0])}
              >
                {p.options.map((o) => (
                  <ToggleGroupItem
                    key={o.value}
                    value={o.value}
                    className="px-2.5 text-xs"
                  >
                    {o.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )
        }
        const value = Number(values[p.key])
        const digits =
          p.digits ??
          (p.step < 1
            ? Math.min(3, String(p.step).split(".")[1]?.length ?? 1)
            : 0)
        return (
          <div key={p.key} className="text-sm">
            <span className="mb-2 flex justify-between gap-2">
              <span id={`${id}-label`} className="text-muted-foreground">
                {p.label}
              </span>
              <output className="font-hud text-xs tabular-nums" aria-live="off">
                {value.toFixed(digits)}
                {p.unit ? ` ${p.unit}` : ""}
              </output>
            </span>
            <Slider
              aria-labelledby={`${id}-label`}
              min={p.min}
              max={p.max}
              step={p.step}
              value={[value]}
              onValueChange={(next) =>
                onChange(p.key, Array.isArray(next) ? next[0] : next)
              }
            />
          </div>
        )
      })}
      {readout && (
        <p
          ref={readoutRef}
          className="font-hud text-xs text-muted-foreground sm:col-span-2 lg:col-span-3"
        >
          {readout}
        </p>
      )}
    </figcaption>
  )
}
