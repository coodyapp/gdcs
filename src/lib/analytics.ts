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

/** Cloudflare Web Analytics (cookieless), production hostname only. */
export function loadWebAnalytics(host = window.location.hostname) {
  if (host !== "gdcs.coody.app") return
  const script = document.createElement("script")
  script.defer = true
  script.src = "https://static.cloudflareinsights.com/beacon.min.js"
  script.dataset.cfBeacon = JSON.stringify({
    token: "a9144059f35f44ba9852f1fb1ba1fd13",
    spa: true,
  })
  document.head.appendChild(script)
}
