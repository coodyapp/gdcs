import { Link, NavLink } from "react-router-dom"

import { categoryPath, liveCategories } from "@/content"

export function SiteHeader() {
  const nav = liveCategories()
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
      <div className="container flex h-14 items-center gap-6">
        <Link
          to="/"
          className="flex shrink-0 items-baseline gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
          aria-label="GDCS home"
        >
          <span className="font-heading text-lg tracking-tight">GDCS</span>
          <span className="eyebrow hidden sm:inline">Game Dev Cheat Sheet</span>
        </Link>
        <nav
          aria-label="Categories"
          className="no-scrollbar -mx-2 flex min-w-0 flex-1 gap-4 overflow-x-auto px-2"
        >
          {nav.map((c) => (
            <NavLink
              key={c.slug}
              to={categoryPath(c.slug)}
              className="nav-link shrink-0 whitespace-nowrap"
            >
              {c.title}
            </NavLink>
          ))}
        </nav>
        <Link to="/updates" className="chip hidden shrink-0 md:inline-flex">
          Get updates
        </Link>
      </div>
    </header>
  )
}
