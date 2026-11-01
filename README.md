# GDCS: Game Development Cheat Sheet

Visual, AI-ready cheat sheets for game development and physics, at **https://gdcs.coody.app**.

Each sheet has an interactive Three.js visual, formulas (KaTeX, rendered at build time), code, common mistakes and a copy-ready AI prompt. Every page also has a Markdown twin (`<url>.md`), and the site publishes `llms.txt`, `llms-full.txt`, `feed.json`, `sitemap.xml` and schema.org JSON-LD.

## Stack

Vite+ (`vp`) · React 19 · TypeScript · Tailwind v4 · React Three Fiber/drei · Cloudflare Pages (static + Functions) · D1 · Email Worker (Cloudflare Email Service).

## Develop

```bash
pnpm install
pnpm dev                 # http://localhost:5173
pnpm exec vp check       # format + lint
pnpm exec vp test --run  # content contract, physics, API, mailer, prerender tests
pnpm build               # client build → SSR build → prerender (dist/)
pnpm preview             # wrangler pages dev dist (Functions + local D1)
```

## How the build works

1. `vp build` builds the client bundle. Three.js is lazy-loaded per visual.
2. `vp build --ssr src/entry-server.tsx` builds a server renderer.
3. `scripts/prerender.ts` renders every route to static HTML with its own head tags and JSON-LD, then writes the `.md` twins, `llms*.txt`, `sitemap.xml`, `robots.txt` and `feed.json`.

## Content

- Taxonomy: `src/content/taxonomy.ts` (Category › Subcategory). A new topic area is one entry there.
- Sheets: `src/content/sheets/<category>/<slug>.ts` + visual `src/visuals/scenes/<category>/<slug>.tsx`. See `docs/authoring.md`.
- Roadmap: `tasks/roadmap.md`.

## Updates (email)

- `functions/api/subscribe|confirm|unsubscribe|event` (Pages Functions, D1 `gdcs-prd`).
- `workers/mailer`: sends double opt-in confirmations (via service binding) and a weekly digest (cron, Mondays 14:00 UTC). It only sends when `feed.json` shows sheets changed since the last digest. Sender: `gdcs@mail.coody.app`.

## Deploy

Pushing to `main` runs `.github/workflows/cd.yaml`: check, test, build, then the Pages deploy to `coody-gdcs-prd-01`. It uses the coodyapp org secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

That token is scoped to Pages, so these two steps are manual when they change:

```bash
pnpm db:migrate:remote                    # D1 schema (migrations/)
(cd workers/mailer && wrangler deploy)    # email Worker + cron
```

## Licenses

Code: see `LICENSE.md`. Third-party: `THIRD_PARTY_LICENSES.md`.
