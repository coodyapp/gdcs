import { promptMarkdown } from "@/lib/prompt-markdown"
import { absoluteUrl, siteConfig } from "@/config/site"

import {
  getCategory,
  getSubcategory,
  liveCategories,
  relatedSheets,
  sheetMarkdownPath,
  sheetPath,
  sheets,
  sheetsIn,
} from "./index"
import { pathUrl, paths } from "./paths"
import type { Sheet } from "./types"

/** Rewrites site-relative links to absolute ones so Markdown works anywhere. */
const absolutize = (text: string) =>
  text.replace(
    /\]\((\/[^)]*)\)/g,
    (_, path: string) => `](${absoluteUrl(path)})`
  )

const fence = (lang: string, code: string) =>
  "```" + (lang === "pseudo" ? "text" : lang) + "\n" + code.trim() + "\n```"

/** The full sheet as Markdown: the `.md` endpoint and "Copy as Markdown". */
export function sheetMarkdown(sheet: Sheet) {
  const category = getCategory(sheet.category)
  const sub = getSubcategory(sheet.category, sheet.subcategory)
  const out: string[] = [
    `# ${sheet.title}`,
    "",
    `> ${sheet.summary}`,
    "",
    `- Category: ${category?.title} › ${sub?.title}`,
    `- Level: ${sheet.level}`,
    `- Tags: ${sheet.tags.join(", ")}`,
    `- Updated: ${sheet.updated}`,
    `- URL: ${absoluteUrl(sheetPath(sheet))}`,
    "",
    "## What it is",
    "",
    ...sheet.what.map(absolutize).flatMap((p) => [p, ""]),
  ]
  if (sheet.formulas?.length) {
    out.push("## Key formulas", "")
    for (const f of sheet.formulas) {
      out.push(
        `- **${f.label}:** $${f.math.tex}$${f.note ? ` — ${f.note}` : ""}`
      )
    }
    out.push("")
  }
  if (sheet.rules?.length) {
    out.push(
      "## Rules of thumb",
      "",
      ...sheet.rules.map((r) => `- ${absolutize(r)}`),
      ""
    )
  }
  out.push("## Implementation", "")
  for (const block of sheet.code) {
    if (block.caption) out.push(block.caption, "")
    out.push(fence(block.lang, block.code), "")
  }
  out.push(
    "## Common mistakes",
    "",
    ...sheet.mistakes.map((m) => `- ${absolutize(m)}`),
    "",
    "## Interactive visual",
    "",
    absolutize(sheet.visual),
    "",
    "## Prompt",
    "",
    fence("markdown", promptMarkdown(sheet.title, sheet.prompt)),
    ""
  )
  const related = relatedSheets(sheet)
  if (related.length) {
    out.push(
      "## Related",
      "",
      ...related.map(
        (r) =>
          `- [${r.title}](${absoluteUrl(sheetMarkdownPath(r))}) — ${r.summary}`
      ),
      ""
    )
  }
  if (sheet.reading.length) {
    out.push(
      "## Further reading",
      "",
      ...sheet.reading.map((r) => `- [${r.title}](${r.url})`),
      ""
    )
  }
  out.push(
    `---`,
    `Source: ${siteConfig.longName} (${absoluteUrl(sheetPath(sheet))})`,
    `License: text CC BY 4.0, credit GDCS with a link to the source. Code and prompts MIT. Details: ${absoluteUrl("/license")}`,
    ""
  )
  return out.join("\n")
}

/** llms.txt (https://llmstxt.org): an index of every sheet's Markdown URL. */
export function llmsTxt() {
  const out = [
    `# ${siteConfig.longName} (${siteConfig.name})`,
    "",
    `> ${siteConfig.description}`,
    "",
    "Each sheet has an HTML page and a Markdown twin at the same URL plus `.md`. The full corpus is at " +
      absoluteUrl("/llms-full.txt") +
      ".",
    "",
    `License: sheet text is CC BY 4.0, so credit GDCS and link to the sheet when you use it. Code examples and prompts are MIT. Simulations are all rights reserved and can be embedded. Details: ${absoluteUrl("/license")}`,
    "",
  ]
  for (const category of liveCategories()) {
    out.push(`## ${category.title}`, "", category.description, "")
    for (const sub of category.subcategories) {
      for (const s of sheetsIn(category.slug, sub.slug)) {
        out.push(
          `- [${s.title}](${absoluteUrl(sheetMarkdownPath(s))}): ${sub.title}. ${s.summary}`
        )
      }
    }
    out.push("")
  }
  out.push("## Learning paths", "")
  for (const p of paths) {
    out.push(
      `- [${p.title}](${absoluteUrl(pathUrl(p.slug))}): ${p.summary} Steps: ${p.steps.map((s) => s.slug).join(" → ")}`
    )
  }
  out.push("")
  out.push(
    "## Optional",
    "",
    `- [Sitemap](${absoluteUrl("/sitemap.xml")})`,
    `- [About](${absoluteUrl("/about")})`,
    `- [License](${absoluteUrl("/license")})`,
    `- [Changelog](${absoluteUrl("/changelog")})`,
    ""
  )
  return out.join("\n")
}

/** Every sheet concatenated, for one-shot ingestion (server/build only). */
export function llmsFullTxt(full: Sheet[]) {
  return [
    `# ${siteConfig.longName} — full corpus`,
    "",
    `> ${siteConfig.description}`,
    "",
    ...sheets.map((meta) =>
      sheetMarkdown(full.find((s) => s.slug === meta.slug)!)
    ),
  ].join("\n\n")
}
