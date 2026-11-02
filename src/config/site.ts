export const siteConfig = {
  name: "GDCS",
  longName: "Game Development Cheat Sheet",
  url: "https://gdcs.coody.app",
  description:
    "Visual, AI-ready cheat sheets for game development and physics. Every concept has an interactive Three.js visual, formulas, code and a copy-ready prompt.",
  tagline: "Visual cheat sheets for game dev, ready for your AI prompts",
  image: "/og.png",
  author: "Coody",
  authorUrl: "https://coody.app",
  repo: "https://github.com/coodyapp/gdcs",
  locale: "en",
  version: __APP_VERSION__,
  changelog: "https://github.com/coodyapp/gdcs/blob/main/CHANGELOG.md",
} as const

export function formatTitle(title?: string) {
  return title
    ? `${title} | ${siteConfig.name}`
    : `${siteConfig.longName} | ${siteConfig.name}`
}

export const absoluteUrl = (pathname: string) =>
  new URL(pathname, siteConfig.url).toString().replace(/\/$/, "") ||
  siteConfig.url
