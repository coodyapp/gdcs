/**
 * Cloudflare's bot protection injects an inline script into every HTML
 * response. Its documented way to pass a CSP is a per-request nonce in the
 * response header: the edge reads the nonce and adds it to what it injects.
 * Our own scripts are external and stay allowed by 'self', so no HTML changes.
 */
export function withScriptNonce(response: Response) {
  const csp = response.headers.get("Content-Security-Policy")
  const type = response.headers.get("Content-Type") ?? ""
  if (!csp || !type.includes("text/html")) return response
  const nonce = btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))
  )
  const headers = new Headers(response.headers)
  headers.set(
    "Content-Security-Policy",
    csp.replace("script-src 'self'", `script-src 'self' 'nonce-${nonce}'`)
  )
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
