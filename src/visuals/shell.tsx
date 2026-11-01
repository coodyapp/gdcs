import { useEffect, useRef, useState, type ComponentType } from "react"
import { Pause, Play, RotateCcw } from "lucide-react"

import { cn } from "@/lib/utils"

import {
  initialValues,
  VisualContext,
  type ParamDef,
  type Values,
  type VisualDef,
} from "./core"
import { visualLoaders } from "./registry"

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** True while the element is near the viewport. */
function useInView<T extends Element>(rootMargin = "200px") {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin])
  return [ref, inView] as const
}

type StageComponent = ComponentType<{
  def: VisualDef<Values>
  values: Values
  compact: boolean
  label: string
}>

/**
 * Canvas creation is expensive (WebGL context, shader compiles). Cards on a
 * grid would all start in the same tick, so mounts go through a queue that
 * releases one per idle period.
 */
const queue: (() => void)[] = []
let draining = false
const idle = (cb: () => void) =>
  "requestIdleCallback" in window
    ? window.requestIdleCallback(cb, { timeout: 600 })
    : setTimeout(cb, 80)
function drain() {
  const next = queue.shift()
  if (!next) {
    draining = false
    return
  }
  draining = true
  next()
  idle(drain)
}
function scheduleMount(cb: () => void) {
  let cancelled = false
  queue.push(() => {
    if (!cancelled) cb()
  })
  if (!draining) idle(drain)
  return () => {
    cancelled = true
  }
}

/** Loads the WebGL stage and the sheet's scene module on first view. */
function useVisualDef(slug: string, enabled: boolean) {
  const [loaded, setLoaded] = useState<{
    def: VisualDef<Values>
    Stage: StageComponent
  } | null>(null)
  useEffect(() => {
    if (!enabled || loaded) return
    const load = visualLoaders[slug]
    if (!load) return
    let alive = true
    Promise.all([load(), import("./stage")]).then(([scene, stage]) => {
      if (alive) setLoaded({ def: scene.default, Stage: stage.default })
    })
    return () => {
      alive = false
    }
  }, [slug, enabled, loaded])
  return loaded
}

/**
 * Interactive Three.js visual for a sheet. The server renders a fixed-size
 * placeholder (no layout shift); the client loads the scene module and
 * mounts a canvas only while the visual is near the viewport.
 */
export function VisualShell({
  slug,
  title,
  compact = false,
  className,
}: {
  slug: string
  title: string
  compact?: boolean
  className?: string
}) {
  const [ref, inView] = useInView<HTMLDivElement>(compact ? "100px" : "400px")
  // Cards mount through the idle queue; the main visual of a page at once.
  const [active, setActive] = useState(false)
  useEffect(() => {
    if (!inView) {
      setActive(false)
      return
    }
    if (!compact) {
      setActive(true)
      return
    }
    return scheduleMount(() => setActive(true))
  }, [inView, compact])
  const loaded = useVisualDef(slug, active)
  const def = loaded?.def
  const [values, setValues] = useState<Values | null>(null)
  const [playing, setPlaying] = useState(true)
  const [resetKey, setResetKey] = useState(0)

  useEffect(() => {
    if (reducedMotion()) setPlaying(false)
  }, [])
  useEffect(() => {
    if (def && !values) setValues(initialValues(def.params))
  }, [def, values])

  const ready = def && values
  return (
    <figure
      className={cn("visual", className)}
      aria-label={`${title}: interactive visual`}
    >
      <div
        ref={ref}
        className={cn(
          "visual-stage relative overflow-hidden rounded-lg border bg-[#0a0a0a]",
          compact ? "aspect-[16/10]" : "aspect-[16/10] sm:aspect-[16/9]"
        )}
      >
        {ready && loaded && active ? (
          <VisualContext.Provider value={{ playing, resetKey, compact }}>
            <loaded.Stage
              def={def}
              values={values}
              compact={compact}
              label={`${title} visual`}
            />
          </VisualContext.Provider>
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <span className="eyebrow">Interactive visual</span>
          </div>
        )}
        {!compact && (
          <div className="absolute top-2 right-2 flex gap-1.5">
            <button
              type="button"
              className="chip !min-h-8 !min-w-8 !px-2"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Pause animation" : "Play animation"}
            >
              {playing ? (
                <Pause className="size-3.5" />
              ) : (
                <Play className="size-3.5" />
              )}
            </button>
            <button
              type="button"
              className="chip !min-h-8 !min-w-8 !px-2"
              onClick={() => {
                setValues(initialValues(def?.params))
                setResetKey((k) => k + 1)
              }}
              aria-label="Reset visual"
            >
              <RotateCcw className="size-3.5" />
            </button>
          </div>
        )}
      </div>
      {!compact && def?.params && values && (
        <Controls
          params={def.params}
          values={values}
          onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
          readout={def.readout?.(values)}
        />
      )}
    </figure>
  )
}

function Controls({
  params,
  values,
  onChange,
  readout,
}: {
  params: ParamDef[]
  values: Values
  onChange: (key: string, value: number | boolean | string) => void
  readout?: string
}) {
  return (
    <figcaption className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {params.map((p) => {
        const id = `param-${p.key}`
        if (p.type === "toggle") {
          return (
            <label
              key={p.key}
              htmlFor={id}
              className="flex items-center gap-2 text-sm"
            >
              <input
                id={id}
                type="checkbox"
                checked={Boolean(values[p.key])}
                onChange={(e) => onChange(p.key, e.target.checked)}
                className="size-4 accent-sky-400"
              />
              {p.label}
            </label>
          )
        }
        if (p.type === "select") {
          return (
            <div key={p.key} className="text-sm">
              <div className="mb-1 text-muted-foreground">{p.label}</div>
              <div
                className="flex flex-wrap gap-1"
                role="radiogroup"
                aria-label={p.label}
              >
                {p.options.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={values[p.key] === o.value}
                    onClick={() => onChange(p.key, o.value)}
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs transition-colors",
                      values[p.key] === o.value
                        ? "border-foreground/50 bg-foreground/10 text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )
        }
        const value = Number(values[p.key])
        return (
          <label key={p.key} htmlFor={id} className="block text-sm">
            <span className="mb-1 flex justify-between gap-2">
              <span className="text-muted-foreground">{p.label}</span>
              <output htmlFor={id} className="font-hud text-xs tabular-nums">
                {value.toFixed(
                  p.digits ??
                    (p.step < 1
                      ? Math.min(3, String(p.step).split(".")[1]?.length ?? 1)
                      : 0)
                )}
                {p.unit ? ` ${p.unit}` : ""}
              </output>
            </span>
            <input
              id={id}
              type="range"
              min={p.min}
              max={p.max}
              step={p.step}
              value={value}
              onChange={(e) => onChange(p.key, Number(e.target.value))}
              className="w-full accent-sky-400"
            />
          </label>
        )
      })}
      {readout && (
        <p className="font-hud text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">
          {readout}
        </p>
      )}
    </figcaption>
  )
}
