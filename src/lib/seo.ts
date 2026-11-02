import { absoluteUrl, formatTitle, siteConfig } from "@/config/site"
import { getPath, pathUrl, paths } from "@/content/paths"
import {
  categoryPath,
  getCategory,
  getSheet,
  getSubcategory,
  liveCategories,
  sheetMarkdownPath,
  sheetPath,
  sheets,
  sheetsIn,
  subcategoryPath,
  type SheetMeta,
} from "@/content"

export interface Head {
  title: string
  description: string
  path: string
  type: "website" | "article"
  jsonLd: object[]
  noindex?: boolean
  /** Markdown alternate for AI agents. */
  markdown?: string
  updated: string
  /** Social card; defaults to the site image. */
  image?: string
}

const latest = () =>
  sheets.reduce((max, s) => (s.updated > max ? s.updated : max), "2026-11-01")

const organization = {
  "@type": "Organization",
  "@id": "https://coody.app/#organization",
  name: "Coody",
  url: "https://coody.app",
  logo: absoluteUrl("/android-chrome-512x512.png"),
}

const website = {
  "@type": "WebSite",
  "@id": `${siteConfig.url}/#website`,
  name: siteConfig.longName,
  alternateName: siteConfig.name,
  url: siteConfig.url,
  description: siteConfig.description,
  inLanguage: siteConfig.locale,
  publisher: { "@id": organization["@id"] },
}

const breadcrumbs = (items: { name: string; path: string }[]) => ({
  "@type": "BreadcrumbList",
  itemListElement: [{ name: "Home", path: "/" }, ...items].map((item, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: item.name,
    item: absoluteUrl(item.path),
  })),
})

const itemList = (name: string, list: SheetMeta[]) => ({
  "@type": "ItemList",
  name,
  numberOfItems: list.length,
  itemListElement: list.map((s, i) => ({
    "@type": "ListItem",
    position: i + 1,
    url: absoluteUrl(sheetPath(s)),
    name: s.title,
  })),
})

function sheetHead(sheet: SheetMeta): Head {
  const category = getCategory(sheet.category)!
  const sub = getSubcategory(sheet.category, sheet.subcategory)!
  const path = sheetPath(sheet)
  return {
    title: formatTitle(`${sheet.title} — ${category.title} cheat sheet`),
    description: sheet.summary,
    path,
    type: "article",
    markdown: sheetMarkdownPath(sheet),
    updated: sheet.updated,
    image: `/og/${sheet.slug}.jpg`,
    jsonLd: [
      organization,
      website,
      {
        "@type": ["TechArticle", "LearningResource"],
        "@id": `${absoluteUrl(path)}#article`,
        headline: sheet.title,
        name: sheet.title,
        description: sheet.summary,
        abstract: sheet.hook,
        url: absoluteUrl(path),
        image: absoluteUrl(`/og/${sheet.slug}.jpg`),
        dateModified: sheet.updated,
        datePublished: sheet.updated,
        inLanguage: siteConfig.locale,
        keywords: sheet.tags.join(", "),
        about: sheet.tags.map((t) => ({ "@type": "Thing", name: t })),
        articleSection: `${category.title} › ${sub.title}`,
        educationalLevel: sheet.level,
        learningResourceType: "Cheat sheet",
        isAccessibleForFree: true,
        encoding: {
          "@type": "MediaObject",
          contentUrl: absoluteUrl(sheetMarkdownPath(sheet)),
          encodingFormat: "text/markdown",
        },
        author: { "@id": organization["@id"] },
        publisher: { "@id": organization["@id"] },
        isPartOf: { "@id": website["@id"] },
      },
      breadcrumbs([
        { name: category.title, path: categoryPath(category.slug) },
        { name: sub.title, path: subcategoryPath(category.slug, sub.slug) },
        { name: sheet.title, path },
      ]),
    ],
  }
}

const notFound: Head = {
  title: formatTitle("Page not found"),
  description: "This page does not exist.",
  path: "/404",
  type: "website",
  jsonLd: [],
  noindex: true,
  updated: "2026-11-01",
}

const staticPages: Record<string, Omit<Head, "jsonLd" | "updated">> = {
  "/about": {
    title: formatTitle("About"),
    description:
      "What GDCS is, how each cheat sheet is built, and how to use the Markdown, llms.txt and prompt exports with AI assistants.",
    path: "/about",
    type: "website",
  },
  "/privacy": {
    title: formatTitle("Privacy policy"),
    description:
      "What GDCS collects: cookieless analytics, copy-click counts, Turnstile on signup, and the minimum needed for the newsletter.",
    path: "/privacy",
    type: "website",
  },
}

/** Head data for any route path; shared by the client and the prerenderer. */
export function headFor(pathname: string): Head {
  const path = pathname.replace(/\/+$/, "") || "/"
  if (path === "/") {
    return {
      title: formatTitle(),
      description: siteConfig.description,
      path: "/",
      type: "website",
      updated: latest(),
      jsonLd: [
        organization,
        website,
        {
          "@type": "CollectionPage",
          name: siteConfig.longName,
          url: siteConfig.url,
          hasPart: liveCategories().map((c) => ({
            "@type": "CollectionPage",
            name: c.title,
            url: absoluteUrl(categoryPath(c.slug)),
          })),
        },
      ],
    }
  }
  if (path === "/paths") {
    return {
      title: formatTitle("Learning paths"),
      description:
        "Curated, ordered routes through the cheat sheets: 3D math, platformer feel, collision, animation, rendering and procedural worlds.",
      path,
      type: "website",
      updated: latest(),
      jsonLd: [
        {
          "@type": "CollectionPage",
          name: "Learning paths",
          url: absoluteUrl(path),
        },
        {
          "@type": "ItemList",
          itemListElement: paths.map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: absoluteUrl(pathUrl(p.slug)),
            name: p.title,
          })),
        },
        breadcrumbs([{ name: "Learning paths", path }]),
      ],
    }
  }
  if (path.startsWith("/paths/")) {
    const lp = getPath(path.slice("/paths/".length))
    if (!lp) return notFound
    const steps = lp.steps
      .map((s) => getSheet(s.slug))
      .filter((s): s is SheetMeta => Boolean(s))
    return {
      title: formatTitle(`${lp.title} — learning path`),
      description: lp.summary,
      path,
      type: "website",
      updated: latest(),
      jsonLd: [
        {
          "@type": "Course",
          name: lp.title,
          description: lp.summary,
          url: absoluteUrl(path),
          provider: { "@id": organization["@id"] },
          isAccessibleForFree: true,
          inLanguage: siteConfig.locale,
          hasCourseInstance: {
            "@type": "CourseInstance",
            courseMode: "online",
            courseWorkload: `PT${steps.length * 10}M`,
          },
          hasPart: steps.map((s, i) => ({
            "@type": "LearningResource",
            position: i + 1,
            name: s.title,
            url: absoluteUrl(sheetPath(s)),
          })),
        },
        breadcrumbs([
          { name: "Learning paths", path: "/paths" },
          { name: lp.title, path },
        ]),
      ],
    }
  }
  const page = staticPages[path]
  if (page)
    return { ...page, updated: latest(), jsonLd: [organization, website] }

  const [c, s, slug, ...rest] = path.slice(1).split("/")
  if (rest.length) return notFound
  const category = getCategory(c)
  if (!category || !sheetsIn(c).length) return notFound
  if (!s) {
    const list = sheetsIn(c)
    return {
      title: formatTitle(`${category.title} cheat sheets`),
      description: category.description,
      path,
      type: "website",
      updated: latest(),
      jsonLd: [
        {
          "@type": "CollectionPage",
          name: category.title,
          url: absoluteUrl(path),
          description: category.description,
        },
        itemList(`${category.title} cheat sheets`, list),
        breadcrumbs([{ name: category.title, path }]),
      ],
    }
  }
  const sub = getSubcategory(c, s)
  if (!sub || !sheetsIn(c, s).length) return notFound
  if (!slug) {
    const list = sheetsIn(c, s)
    return {
      title: formatTitle(`${sub.title} — ${category.title} cheat sheets`),
      description:
        `${sub.description} ${list.length} visual cheat sheets: ${list.map((x) => x.title).join(", ")}.`.slice(
          0,
          300
        ),
      path,
      type: "website",
      updated: latest(),
      jsonLd: [
        {
          "@type": "CollectionPage",
          name: `${category.title} › ${sub.title}`,
          url: absoluteUrl(path),
          description: sub.description,
        },
        itemList(`${sub.title} cheat sheets`, list),
        breadcrumbs([
          { name: category.title, path: categoryPath(c) },
          { name: sub.title, path },
        ]),
      ],
    }
  }
  const sheet = getSheet(slug)
  if (!sheet || sheet.category !== c || sheet.subcategory !== s) return notFound
  return sheetHead(sheet)
}

/** Every indexable path, for prerendering and the sitemap. */
export function allPaths(): string[] {
  const live = liveCategories()
  return [
    "/",
    ...Object.keys(staticPages),
    "/paths",
    ...paths.map((p) => pathUrl(p.slug)),
    ...live.flatMap((c) => [
      categoryPath(c.slug),
      ...c.subcategories.map((s) => subcategoryPath(c.slug, s.slug)),
    ]),
    ...sheets.map(sheetPath),
  ]
}
