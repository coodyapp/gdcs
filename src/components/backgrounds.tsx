import { lazy, Suspense, useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"
import { budget } from "@/visuals/budget"

// Decorative WebGL backgrounds. Each is its own chunk, loaded after first paint,
// skipped on low-end or data-saving devices, and paused offscreen by the component.
const GhostFibers = lazy(() => import("@/components/ghost-fibers"))
const GradientASCII = lazy(() => import("@/components/gradient-ascii"))

const whenIdle = (run: () => void) => {
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(run, { timeout: 1500 })
    return () => window.cancelIdleCallback(id)
  }
  const id = setTimeout(run, 200)
  return () => clearTimeout(id)
}

/** True a moment after load: the hero text paints first, then the fibers join. */
function useAfterPaint(delay: number) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (budget() === 0) return
    let cancelIdle = () => {}
    const timer = setTimeout(() => {
      cancelIdle = whenIdle(() => setReady(true))
    }, delay)
    return () => {
      clearTimeout(timer)
      cancelIdle()
    }
  }, [delay])
  return ready
}

/** True once the element is about to scroll into view. */
function useNearViewport(ref: { current: Element | null }) {
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || budget() === 0) return
    let cancelIdle = () => {}
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        cancelIdle = whenIdle(() => setNear(true))
      },
      { rootMargin: "300px" }
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelIdle()
    }
  }, [ref])
  return near
}

const isPhone = () => window.matchMedia("(max-width: 639px)").matches

/** Hero: fibers in Coody neutrals. Fills its positioned parent. */
export function HeroFibers({ className }: { className?: string }) {
  const ready = useAfterPaint(1800)
  if (!ready) return null
  return (
    <Suspense fallback={null}>
      <GhostFibers
        className={className}
        glowColor="#a3a3a3"
        lineColor="#fafafa"
        secondaryColor="#737373"
        threads={isPhone() ? 40 : 72}
        speed={0.35}
        brightness={0.85}
        pulseOnClick={false}
        dpr={1}
      />
    </Suspense>
  )
}

/**
 * Footer: the hero's fibers, drawn larger so they leave every edge. Nothing
 * fades at the bottom, so the page reads as continuing past the screen.
 */
export function FooterFibers({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const near = useNearViewport(ref)
  return (
    <div ref={ref} aria-hidden className={cn("h-full w-full", className)}>
      {near && (
        <Suspense fallback={null}>
          <GhostFibers
            glowColor="#a3a3a3"
            lineColor="#fafafa"
            secondaryColor="#737373"
            threads={isPhone() ? 40 : 72}
            speed={0.35}
            scale={1.6}
            rotation={-24}
            brightness={0.85}
            vignette={0}
            pulseOnClick={false}
            dpr={1}
          />
        </Suspense>
      )}
    </div>
  )
}

/** Quiet ASCII band that leads into the footer, in Coody neutrals. */
export function FooterAscii({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const near = useNearViewport(ref)
  return (
    <div
      ref={ref}
      aria-hidden
      className={cn(
        "pointer-events-none h-40 w-full overflow-hidden opacity-30 [mask-image:linear-gradient(to_bottom,transparent,#000_60%)] md:h-56",
        className
      )}
    >
      {near && (
        <Suspense fallback={null}>
          <GradientASCII
            shape="rise"
            scale={0.55}
            colors={["#0a0a0a", "#404040", "#a3a3a3", "#fafafa"]}
            cellSize={isPhone() ? 16 : 14}
            speed={0.5}
            grain={0}
            mouseInteraction={false}
            dpr={1}
          />
        </Suspense>
      )}
    </div>
  )
}
