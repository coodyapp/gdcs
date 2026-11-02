import { useEffect } from "react"
import { useLocation } from "react-router-dom"

import { absoluteUrl, siteConfig } from "@/config/site"
import { headFor } from "@/lib/seo"

function setMeta(
  selector: string,
  attr: "name" | "property",
  key: string,
  value: string
) {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement("meta")
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = value
}

/**
 * Keeps head tags in sync on client-side navigation. First paint already has
 * them: the prerenderer writes the same `headFor` output into each HTML file.
 */
export function Seo() {
  const { pathname } = useLocation()
  useEffect(() => {
    const head = headFor(pathname)
    const url = absoluteUrl(head.path)
    document.title = head.title
    setMeta('meta[name="description"]', "name", "description", head.description)
    setMeta(
      'meta[name="robots"]',
      "name",
      "robots",
      head.noindex ? "noindex,follow" : "index,follow"
    )
    setMeta('meta[property="og:title"]', "property", "og:title", head.title)
    setMeta(
      'meta[property="og:description"]',
      "property",
      "og:description",
      head.description
    )
    setMeta('meta[property="og:url"]', "property", "og:url", url)
    setMeta('meta[property="og:type"]', "property", "og:type", head.type)
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", head.title)
    setMeta(
      'meta[name="twitter:description"]',
      "name",
      "twitter:description",
      head.description
    )
    const image = absoluteUrl(head.image ?? siteConfig.image)
    setMeta('meta[property="og:image"]', "property", "og:image", image)
    setMeta('meta[name="twitter:image"]', "name", "twitter:image", image)
    document.head
      .querySelector<HTMLLinkElement>('link[rel="canonical"]')
      ?.setAttribute("href", url)
  }, [pathname])
  return null
}
