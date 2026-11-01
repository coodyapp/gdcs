/**
 * Cookieless event counts (copy prompt, copy markdown, subscribe). Sent with
 * sendBeacon to /api/event, which stores daily aggregates only.
 */
export function trackClicks() {
  window.addEventListener("gdcs:event", (e) => {
    const name = (e as CustomEvent<string>).detail
    const body = JSON.stringify({ name, path: window.location.pathname })
    try {
      navigator.sendBeacon?.(
        "/api/event",
        new Blob([body], { type: "application/json" })
      )
    } catch {
      // Analytics must never break the page.
    }
  })
}
