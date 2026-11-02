/**
 * Cloudflare's bot protection injects a script into HTML responses. It costs
 * more main-thread time than the whole app and this site has no rule that reads
 * its signal, so pages opt out with `no-transform`: the documented per-response
 * switch, which leaves the rest of the zone protected.
 *
 * `no-transform` also stops the edge compressing the page, so the Worker asks
 * the runtime to do it here. The analytics beacon, no longer injected either,
 * is a plain script tag in index.html.
 */
const EMBED_PAGE = /^\/embed\/[a-z0-9-]+$/

/**
 * `_headers` opens framing for all of /embed/*, which also matches addresses that
 * are not embeds. Only a page that exists, one level down, may be framed.
 */
function refuseFramingUnlessEmbed(
  request: Request,
  response: Response,
  headers: Headers
) {
  const { pathname } = new URL(request.url)
  if (!pathname.startsWith("/embed/")) return
  if (response.status < 400 && EMBED_PAGE.test(pathname)) return
  const policy = headers.get("Content-Security-Policy")
  if (policy)
    headers.set(
      "Content-Security-Policy",
      policy.replace(/frame-ancestors [^;]*/, "frame-ancestors 'none'")
    )
}

export function preparePage(request: Request, response: Response) {
  if (!response.headers.get("Content-Type")?.includes("text/html"))
    return response
  const headers = new Headers(response.headers)
  refuseFramingUnlessEmbed(request, response, headers)
  const cache = headers.get("Cache-Control")
  headers.set(
    "Cache-Control",
    cache ? `${cache}, no-transform` : "no-transform"
  )
  if (response.body && !headers.has("Content-Encoding")) {
    const cf = (request as { cf?: { clientAcceptEncoding?: string } }).cf
    const accepts =
      cf?.clientAcceptEncoding ?? request.headers.get("Accept-Encoding") ?? ""
    const encoding = /\bbr\b/.test(accepts)
      ? "br"
      : /\bgzip\b/.test(accepts)
        ? "gzip"
        : null
    if (encoding) {
      // The runtime encodes the body to match this header.
      headers.set("Content-Encoding", encoding)
      headers.delete("Content-Length")
      headers.append("Vary", "Accept-Encoding")
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
