import { Route, Routes } from "react-router-dom"

import { SiteLayout } from "@/layouts/site-layout"
import { AboutPage } from "@/pages/about"
import { CategoryPage, SubcategoryPage } from "@/pages/category"
import { HomePage } from "@/pages/home"
import { NotFoundPage } from "@/pages/not-found"
import { SheetPage } from "@/pages/sheet"
import { UpdatesPage } from "@/pages/updates"

export function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="updates" element={<UpdatesPage />} />
        <Route path=":category" element={<CategoryPage />} />
        <Route path=":category/:subcategory" element={<SubcategoryPage />} />
        <Route path=":category/:subcategory/:slug" element={<SheetPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
