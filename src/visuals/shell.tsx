import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react"
import { Pause, Play, RotateCcw } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

import {
  initialValues,
  VisualContext,
  type Values,
  type VisualDef,
} from "./core"
import { registerCard } from "./budget"
import { visualLoaders } from "./registry"

const Controls = lazy(() => import("./controls"))

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
/** `?poster=1`: mount at once and hide overlays (used by scripts/posters.ts). */
const posterMode = () =>
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("poster")

let cardIds = 0
/** Cards ask the global budget for a live slot, ranked by how visible they are. */
function useCardBudget(ref: { current: Element | null }, enabled: boolean) {
  const [granted, setGranted] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!enabled || !el) return
    const card = registerCard(`card-${cardIds++}`, setGranted)
    const io = new IntersectionObserver(
      ([entry]) => card.update(entry.intersectionRatio),
      {
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    )
    io.observe(el)
    return () => {
      io.disconnect()
      card.release()
      setGranted(false)
    }
  }, [ref, enabled])
  return granted
}

/**
 * True once the visitor interacts (or the page has been idle a while). One
 * shared set of listeners for the whole page, however many visuals there are.
 */
let warmed = false
let watching = false
const warmSubscribers = new Set<() => void>()
function startWarmWatch() {
  const events = [
    "pointerdown",
    "pointermove",
    "keydown",
    "wheel",
    "touchstart",
    "scroll",
  ] as const
  const go = () => {
    if (warmed) return
    warmed = true
    events.forEach((e) => window.removeEventListener(e, go))
    warmSubscribers.forEach((fn) => fn())
    warmSubscribers.clear()
  }
  events.forEach((e) =>
    window.addEventListener(e, go, { once: true, passive: true })
  )
  // Reduced motion: only on interaction. Otherwise also after a quiet moment.
  if (!reducedMotion()) setTimeout(() => idle(go), 3500)
}
function useWarm() {
  const [warm, setWarm] = useState(false)
  useEffect(() => {
    if (posterMode() || warmed) return setWarm(true)
    if (!watching) {
      watching = true
      startWarmWatch()
    }
    const fn = () => setWarm(true)
    warmSubscribers.add(fn)
    return () => {
      warmSubscribers.delete(fn)
    }
  }, [])
  return warm
}

/**
 * Interactive Three.js visual for a sheet. A static poster (built by
 * `pnpm posters`) paints first, so LCP and layout never wait for WebGL.
 * The page's main visual goes live on the first interaction or when idle;
 * cards go live on hover (fine pointers) through the idle mount queue.
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
  // Cards also wait for the page to settle, so first load stays poster-only.
  const warm = useWarm()
  const [hovered, setHovered] = useState(false)
  const granted = useCardBudget(ref, compact && warm)
  const [active, setActive] = useState(false)
  const [posterOk, setPosterOk] = useState(true)
  const poster = posterMode()
  useEffect(() => {
    if (!inView) {
      setActive(false)
      return
    }
    if (poster || (!compact && warm)) {
      setActive(true)
      return
    }
    if (compact && (hovered || granted))
      return scheduleMount(() => setActive(true))
    if (compact) setActive(false)
  }, [inView, compact, warm, hovered, granted, poster])
  const loaded = useVisualDef(slug, active)
  const def = loaded?.def
  const [values, setValues] = useState<Values | null>(null)
  const [playing, setPlaying] = useState(true)
  const [resetKey, setResetKey] = useState(0)
  const readoutRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (reducedMotion()) setPlaying(false)
  }, [])
  useEffect(() => {
    if (def && !values) setValues(initialValues(def.params))
  }, [def, values])

  const ready = def && values
  const live = Boolean(ready && loaded && active)
  return (
    <figure
      className={cn("visual", className)}
      aria-label={`${title}: interactive visual`}
    >
      <div
        ref={ref}
        onPointerEnter={(e) => {
          if (compact && e.pointerType === "mouse") setHovered(true)
        }}
        onPointerLeave={() => setHovered(false)}
        className={cn(
          "visual-stage dark relative overflow-hidden rounded-lg border bg-[#0a0a0a] text-foreground",
          compact ? "aspect-[16/10]" : "aspect-[16/10] sm:aspect-[16/9]"
        )}
      >
        {posterOk && !poster && (
          <img
            src={`/posters/${slug}.webp`}
            alt=""
            aria-hidden="true"
            width={960}
            height={600}
            loading={compact ? "lazy" : "eager"}
            fetchPriority={compact ? "auto" : "high"}
            decoding="async"
            onError={() => setPosterOk(false)}
            className={cn(
              "absolute inset-0 size-full object-cover transition-opacity duration-300",
              live && "opacity-0"
            )}
          />
        )}
        {live && def && values && loaded ? (
          <VisualContext.Provider
            value={{ playing, resetKey, compact, readout: readoutRef }}
          >
            <loaded.Stage
              def={def}
              values={values}
              compact={compact}
              label={`${title} visual`}
            />
          </VisualContext.Provider>
        ) : (
          !posterOk && (
            <div className="absolute inset-0 grid place-items-center">
              <span className="eyebrow">Interactive visual</span>
            </div>
          )
        )}
        {!compact && !poster && (
          <div className="absolute top-2 right-2 flex gap-1.5">
            <IconButton
              label={playing ? "Pause animation" : "Play animation"}
              onClick={() => setPlaying((p) => !p)}
            >
              {playing ? <Pause /> : <Play />}
            </IconButton>
            <IconButton
              label="Reset visual"
              onClick={() => {
                setValues(initialValues(def?.params))
                setResetKey((k) => k + 1)
              }}
            >
              <RotateCcw />
            </IconButton>
          </div>
        )}
      </div>
      {!compact && def?.params && values && (
        <Suspense fallback={null}>
          <Controls
            params={def.params}
            values={values}
            onChange={(key, value) =>
              setValues((v) => ({ ...v, [key]: value }))
            }
            readout={def.readout?.(values)}
            readoutRef={readoutRef}
          />
        </Suspense>
      )}
    </figure>
  )
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      variant="outline"
      size="icon-sm"
      className="rounded-full bg-background/70 backdrop-blur"
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
