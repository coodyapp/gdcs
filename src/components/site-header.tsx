import { useEffect, useRef } from "react"
import { Link, NavLink, useLocation } from "react-router-dom"
import { Menu, Search, X } from "lucide-react"

import {
  categoryPath,
  liveCategories,
  sheetsIn,
  subcategoryPath,
} from "@/content"
import { catStyle } from "@/lib/accent"
import { SearchTrigger, useOpenPalette } from "@/components/command-palette"

export function SiteHeader() {
  const nav = liveCategories()
  const drawer = useRef<HTMLDialogElement>(null)
  const { pathname } = useLocation()
  useEffect(() => drawer.current?.close(), [pathname])

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-background/85 backdrop-blur-md">
      <div className="container flex h-14 items-center gap-4">
        <Link
          to="/"
          className="flex shrink-0 items-baseline gap-2 rounded-sm"
          aria-label="GDCS home"
        >
          <span className="font-heading text-lg tracking-tight">GDCS</span>
          <span className="eyebrow hidden 2xl:inline">
            Game Dev Cheat Sheet
          </span>
        </Link>
        <nav
          aria-label="Categories"
          className="no-scrollbar hidden min-w-0 flex-1 gap-4 overflow-x-auto px-1 md:flex xl:gap-5"
        >
          {nav.map((c) => (
            <NavLink
              key={c.slug}
              to={categoryPath(c.slug)}
              style={catStyle(c.slug)}
              className="nav-link group flex shrink-0 items-center gap-2 whitespace-nowrap"
            >
              <span
                className="cat-dot opacity-70 transition-opacity group-hover:opacity-100 group-aria-[current=page]:opacity-100"
                aria-hidden
              />
              {c.short ?? c.title}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Link to="/paths" className="nav-link hidden shrink-0 lg:block">
            Paths
          </Link>
          <SearchTrigger className="hidden sm:flex" />
          <MobileSearchButton />
          <Link to="/updates" className="chip hidden lg:inline-flex">
            Get updates
          </Link>
          <button
            type="button"
            className="chip !min-h-9 !min-w-9 !px-2 md:hidden"
            aria-label="Open menu"
            aria-haspopup="dialog"
            onClick={() => drawer.current?.showModal()}
          >
            <Menu className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <dialog
        ref={drawer}
        aria-label="Menu"
        onClick={(e) => e.target === drawer.current && drawer.current?.close()}
        className="drawer m-0 ml-auto h-dvh max-h-dvh w-[min(22rem,88vw)] border-l border-white/10 bg-popover p-0 text-foreground backdrop:bg-black/60"
      >
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
          <span className="font-heading">Browse</span>
          <button
            type="button"
            className="chip !min-h-9 !min-w-9 !px-2"
            aria-label="Close menu"
            onClick={() => drawer.current?.close()}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <nav
          aria-label="All categories"
          className="space-y-1 overflow-y-auto p-3"
        >
          {nav.map((c) => (
            <details
              key={c.slug}
              style={catStyle(c.slug)}
              open={pathname.startsWith(categoryPath(c.slug))}
              className="group rounded-lg"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/5">
                <span className="cat-dot" aria-hidden />
                <span className="flex-1 font-medium">{c.title}</span>
                <span className="font-hud text-xs text-text-3">
                  {sheetsIn(c.slug).length}
                </span>
              </summary>
              <ul className="mt-1 mb-2 ml-6 border-l border-white/10 pl-3">
                <li>
                  <Link
                    to={categoryPath(c.slug)}
                    className="block rounded px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                  >
                    All {c.title}
                  </Link>
                </li>
                {c.subcategories.map((s) => (
                  <li key={s.slug}>
                    <Link
                      to={subcategoryPath(c.slug, s.slug)}
                      className="block rounded px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                    >
                      {s.title}{" "}
                      <span className="text-text-3">
                        · {sheetsIn(c.slug, s.slug).length}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
          <div className="mt-4 grid gap-2 border-t border-white/10 pt-4">
            <Link to="/paths" className="chip justify-start">
              Learning paths
            </Link>
            <Link to="/updates" className="chip justify-start">
              Get updates
            </Link>
            <Link to="/about" className="chip justify-start">
              About & AI exports
            </Link>
          </div>
        </nav>
      </dialog>
    </header>
  )
}

function MobileSearchButton() {
  const open = useOpenPalette()
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Search cheat sheets"
      className="chip !min-h-9 !min-w-9 !px-2 sm:hidden"
    >
      <Search className="size-4" aria-hidden />
    </button>
  )
}
