import "@fontsource-variable/inter"
import "katex/dist/katex.min.css"
import "@/styles/globals.css"

import { StrictMode } from "react"
import { createRoot, hydrateRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"

import { App } from "@/App"
import { getSheet, loadSheet } from "@/content"
import { trackClicks } from "@/lib/analytics"

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

const app = (
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)

// A sheet page's body is a lazy chunk: load it before hydrating so the client
// renders exactly what the server did.
const [, , , slug] = window.location.pathname.split("/")
const preload =
  slug && getSheet(slug)
    ? loadSheet(slug).catch(() => undefined)
    : Promise.resolve()

// Prerendered pages hydrate; the bare shell (404/app fallback) renders fresh.
void preload.then(() => {
  if (root.hasChildNodes()) hydrateRoot(root, app)
  else createRoot(root).render(app)
})

trackClicks()
