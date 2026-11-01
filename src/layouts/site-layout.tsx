import { useEffect } from "react"
import { Outlet, useLocation } from "react-router-dom"

import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { Seo } from "@/components/seo"

export function SiteLayout() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])
  return (
    <>
      <a
        href="#main"
        className="chip sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
      >
        Skip to content
      </a>
      <Seo />
      <SiteHeader />
      <main id="main" className="container min-h-[60vh] pt-8">
        <Outlet />
      </main>
      <SiteFooter />
    </>
  )
}
