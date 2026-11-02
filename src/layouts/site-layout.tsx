import { useEffect } from "react"
import { Outlet, useLocation } from "react-router-dom"

import {
  CommandPaletteProvider,
  FloatingSearch,
} from "@/components/command-palette"
import { SiteFooter } from "@/components/site-footer"
import { UpdatesNotice } from "@/components/updates"
import { Seo } from "@/components/seo"

export function SiteLayout() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])
  return (
    <CommandPaletteProvider>
      <a
        href="#main"
        className="chip sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
      >
        Skip to content
      </a>
      <Seo />
      <FloatingSearch />
      <UpdatesNotice />
      <main
        id="main"
        tabIndex={-1}
        className="container min-h-[60vh] pt-10 outline-none"
      >
        <Outlet />
      </main>
      <SiteFooter />
    </CommandPaletteProvider>
  )
}
