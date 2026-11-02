import { useEffect } from "react"
import { Outlet, useLocation } from "react-router-dom"

import { CommandPaletteProvider } from "@/components/command-palette"
import { PhoneMenu } from "@/components/phone-menu"
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
        className="sr-only rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
      >
        Skip to content
      </a>
      <Seo />
      <UpdatesNotice />
      <main
        id="main"
        tabIndex={-1}
        className="container min-h-[60vh] pt-6 outline-none md:pt-10"
      >
        <Outlet />
      </main>
      <SiteFooter />
      <PhoneMenu />
    </CommandPaletteProvider>
  )
}
