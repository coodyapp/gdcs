import { useCallback, useEffect, useRef } from "react"

/** Public site key for gdcs.coody.app; elsewhere Cloudflare's always-pass test key. */
const PROD_KEY = "0x4AAAAAAFv9d_mHOxAwi6xo"
const TEST_KEY = "1x00000000000000000000AA"
const SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string
  reset(id: string): void
  remove(id: string): void
}
declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let loading: Promise<TurnstileApi> | null = null
function loadScript() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const s = document.createElement("script")
    s.src = SCRIPT
    s.async = true
    s.onload = () =>
      window.turnstile
        ? resolve(window.turnstile)
        : reject(new Error("turnstile missing"))
    s.onerror = () => {
      loading = null
      reject(new Error("turnstile failed to load"))
    }
    document.head.appendChild(s)
  })
  return loading
}

/**
 * Invisible Turnstile for a form. The script loads only when the form is
 * near the viewport; `getToken()` resolves once Turnstile has a token.
 */
export function useTurnstile() {
  const container = useRef<HTMLDivElement>(null)
  const token = useRef<string>(undefined)
  const waiters = useRef<((t: string | undefined) => void)[]>([])
  const widget = useRef<string>(undefined)

  useEffect(() => {
    const el = container.current
    if (!el) return
    let cancelled = false
    const start = () =>
      loadScript()
        .then((api) => {
          if (cancelled || widget.current) return
          widget.current = api.render(el, {
            sitekey:
              window.location.hostname === "gdcs.coody.app"
                ? PROD_KEY
                : TEST_KEY,
            "refresh-expired": "auto",
            callback: (t: string) => {
              token.current = t
              waiters.current.splice(0).forEach((w) => w(t))
            },
            "expired-callback": () => (token.current = undefined),
          })
        })
        .catch(() => waiters.current.splice(0).forEach((w) => w(undefined)))
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          io.disconnect()
          void start()
        }
      },
      { rootMargin: "300px" }
    )
    io.observe(el)
    return () => {
      cancelled = true
      io.disconnect()
      if (widget.current) window.turnstile?.remove(widget.current)
      widget.current = undefined
    }
  }, [])

  const getToken = useCallback(
    () =>
      token.current
        ? Promise.resolve(token.current)
        : new Promise<string | undefined>((resolve) => {
            waiters.current.push(resolve)
            setTimeout(() => resolve(token.current), 8000)
          }),
    []
  )
  /** Tokens are single-use: reset after each submit. */
  const reset = useCallback(() => {
    token.current = undefined
    if (widget.current) window.turnstile?.reset(widget.current)
  }, [])

  return { container, getToken, reset }
}
