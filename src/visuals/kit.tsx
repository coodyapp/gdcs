/** Everything a scene module needs: core types/helpers plus R3F hooks. */
import { useEffect, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"

import { useVisual } from "./core"

export * from "./core"

/**
 * Simulation time in seconds as a ref (no re-render). Advances only while
 * playing and restarts on Reset. Use inside useFrame-driven scenes.
 */
export function useClock(speed = 1) {
  const { playing, resetKey } = useVisual()
  const time = useRef(0)
  useEffect(() => {
    time.current = 0
  }, [resetKey])
  useFrame((_, delta) => {
    if (playing) time.current += Math.min(delta, 0.1) * speed
  })
  return time
}

/** Same clock as state, for small declarative scenes that re-render per frame. */
export function useAnimationTime(speed = 1) {
  const { playing, resetKey } = useVisual()
  const [time, setTime] = useState(0)
  useEffect(() => setTime(0), [resetKey])
  useFrame((_, delta) => {
    if (playing) setTime((t) => t + Math.min(delta, 0.1) * speed)
  })
  return time
}

/**
 * Fixed-step simulation driver: calls `step(dt)` at `hz` while playing, so
 * numerical scenes behave the same at any frame rate.
 */
export function useFixedStep(step: (dt: number) => void, hz = 120) {
  const { playing } = useVisual()
  const acc = useRef(0)
  const stepRef = useRef(step)
  stepRef.current = step
  useFrame((_, delta) => {
    if (!playing) return
    const dt = 1 / hz
    acc.current = Math.min(acc.current + delta, 0.25)
    while (acc.current >= dt) {
      stepRef.current(dt)
      acc.current -= dt
    }
  })
}
