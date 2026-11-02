import { sheetPath, type SheetMeta } from "@/content"
import { absoluteUrl } from "@/config/site"

export const LICENSE_PATH = "/license"
export const CC_BY_URL = "https://creativecommons.org/licenses/by/4.0/"
/** Tall enough for a simulation with its controls and the link back at 720 px wide. */
export const EMBED_HEIGHT = 640

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

export const embedPath = (slug: string) => `/embed/${slug}`

/** One line for a page that reuses a sheet's text. */
export const attributionText = (sheet: SheetMeta) =>
  `"${sheet.title}" by GDCS, ${absoluteUrl(sheetPath(sheet))}, licensed under CC BY 4.0 (${CC_BY_URL}).`

/**
 * What a site pastes to embed a simulation. The link below the iframe is part of
 * it: a link inside an iframe is not a link on the host page.
 */
export const embedCode = (sheet: SheetMeta) => {
  const title = escapeHtml(sheet.title)
  return [
    `<iframe src="${absoluteUrl(embedPath(sheet.slug))}" title="${title}: interactive simulation" width="100%" height="${EMBED_HEIGHT}" style="border:0;border-radius:12px" loading="lazy"></iframe>`,
    `<p><a href="${absoluteUrl(sheetPath(sheet))}">${title}</a> simulation by <a href="${absoluteUrl("/")}">GDCS</a> (<a href="${absoluteUrl(LICENSE_PATH)}">license</a>)</p>`,
  ].join("\n")
}
