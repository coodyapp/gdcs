import { StrictMode } from "react"
import { renderToString } from "react-dom/server"
import { StaticRouter } from "react-router-dom"

import { App } from "@/App"
import { fullSheets } from "@/content/full"
import { llmsFullTxt as buildFullTxt } from "@/content/markdown"

/** Server render of one route, used only by the build-time prerenderer. */
export function render(url: string) {
  return renderToString(
    <StrictMode>
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    </StrictMode>
  )
}

export { headFor, allPaths, embedPaths } from "@/lib/seo"
export { sheetMarkdown, llmsTxt } from "@/content/markdown"
export { sheets, sheetMarkdownPath, sheetPath } from "@/content"
export { fullSheets }
export const llmsFullTxt = () => buildFullTxt(fullSheets)
