import { Route, Routes } from "react-router-dom"

import { SiteLayout } from "@/layouts/site-layout"
import { AboutPage } from "@/pages/about"
import { EmbedPage } from "@/pages/embed"
import { LicensePage } from "@/pages/license"
import { CategoryPage, SubcategoryPage } from "@/pages/category"
import { HomePage } from "@/pages/home"
import { NotFoundPage } from "@/pages/not-found"
import { PathPage, PathsIndexPage } from "@/pages/paths"
import { SheetPage } from "@/pages/sheet"
import { PrivacyPage } from "@/pages/privacy"

export function App() {
  return (
    <Routes>
      <Route path="embed/:slug" element={<EmbedPage />} />
      {/* Never the site layout: its signup form must not appear under /embed.
          Must outrank the three-segment sheet route, which a bare embed/* does not. */}
      <Route path="embed/:slug/*" element={<EmbedPage />} />
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="license" element={<LicensePage />} />
        <Route path="paths" element={<PathsIndexPage />} />
        <Route path="paths/:path" element={<PathPage />} />
        <Route path=":category" element={<CategoryPage />} />
        <Route path=":category/:subcategory" element={<SubcategoryPage />} />
        <Route path=":category/:subcategory/:slug" element={<SheetPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
