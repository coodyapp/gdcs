import { lazy, Suspense, useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"
import { budget } from "@/visuals/budget"

// Decorative WebGL backgrounds. A poster of the first frame paints with the page,
// so there is never an empty hero; the live canvas takes over from that same frame.
// Devices that stay static (reduced motion, data saver, no WebGL) keep the poster.
const loadFibers = () => import("@/components/ghost-fibers")
const GhostFibers = lazy(loadFibers)

const whenIdle = (run: () => void, timeout: number) => {
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(run, { timeout })
    return () => window.cancelIdleCallback(id)
  }
  const id = setTimeout(run, 100)
  return () => clearTimeout(id)
}

/** `?poster=1`: frozen first frame, shown at once (used by scripts/fiber-posters.ts). */
const capturing = () =>
  new URLSearchParams(window.location.search).has("poster")

/** True right after load: the page paints and hydrates first, then the fibers start. */
function useAfterLoad() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (budget() === 0) return
    let cancelIdle = () => {}
    const start = () => {
      cancelIdle = whenIdle(() => setReady(true), 400)
    }
    if (document.readyState === "complete") start()
    else window.addEventListener("load", start, { once: true })
    return () => {
      window.removeEventListener("load", start)
      cancelIdle()
    }
  }, [])
  return ready
}

/** True once the element is close: the chunk is fetched ahead, the canvas starts before it shows. */
function useNearViewport(ref: { current: Element | null }) {
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || budget() === 0) return
    const cancelFetch = whenIdle(() => void loadFibers(), 2000)
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        setNear(true)
      },
      { rootMargin: "800px" }
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelFetch()
    }
  }, [ref])
  return near
}

const isPhone = () => window.matchMedia("(max-width: 639px)").matches

function Fibers({
  name,
  start,
  scale,
  rotation,
  vignette,
  eager = false,
}: {
  name: "hero" | "footer"
  start: boolean
  scale?: number
  rotation?: number
  vignette?: number
  eager?: boolean
}) {
  const [live, setLive] = useState(false)
  return (
    <div data-fibers={name} className="absolute inset-0">
      <picture>
        <source
          media="(max-width: 639px)"
          srcSet={`/posters/fibers-${name}-phone.webp`}
        />
        <img
          src={`/posters/fibers-${name}.webp`}
          alt=""
          decoding="async"
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : undefined}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-500",
            live && "opacity-0"
          )}
        />
      </picture>
      {start && (
        <Suspense fallback={null}>
          <GhostFibers
            className={cn(
              "transition-opacity duration-500",
              live ? "opacity-100" : "opacity-0"
            )}
            glowColor="#a3a3a3"
            lineColor="#fafafa"
            secondaryColor="#737373"
            threads={isPhone() ? 40 : 72}
            speed={0.35}
            scale={scale}
            rotation={rotation}
            brightness={0.85}
            vignette={vignette}
            intro={false}
            paused={capturing()}
            pulseOnClick={false}
            dpr={1}
            onReady={() => setLive(true)}
          />
        </Suspense>
      )}
    </div>
  )
}

/** Hero: fibers in Coody neutrals. Fills its positioned parent. */
export function HeroFibers() {
  return <Fibers name="hero" start={useAfterLoad()} eager />
}

/**
 * Before the footer: the hero's fibers, drawn larger so they leave every edge
 * and run under the footer line, so the page reads as continuing.
 */
export function FooterFibers({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const near = useNearViewport(ref)
  return (
    <div
      ref={ref}
      aria-hidden
      className={cn(
        "pointer-events-none relative h-56 w-full overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,#000_55%)] md:h-80",
        className
      )}
    >
      <Fibers
        name="footer"
        start={near}
        scale={1.6}
        rotation={-24}
        vignette={0}
      />
    </div>
  )
}
