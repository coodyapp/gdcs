# GDCS: Game Development Cheat Sheet

Visual, AI-ready cheat sheets for game development and physics, at **https://gdcs.coody.app**.

Each sheet has an interactive Three.js visual, formulas (KaTeX, rendered at build time), code, common mistakes and a copy-ready AI prompt. Every page also has a Markdown twin (`<url>.md`), and the site publishes `llms.txt`, `llms-full.txt`, `feed.json`, `sitemap.xml` and schema.org JSON-LD.

## Stack

Vite+ (`vp`) · React 19 · TypeScript · Tailwind v4 · React Three Fiber/drei · one Cloudflare Worker (Static Assets + API + mailer + cron) · D1 · Cloudflare Email Service.

## Develop

```bash
pnpm install
pnpm dev                 # http://localhost:5173
pnpm exec vp check       # format + lint
pnpm exec vp test --run  # content contract, physics, API, mailer, prerender tests
pnpm build               # client build → SSR build → prerender (dist/)
pnpm preview             # wrangler dev: Worker + assets + local D1
```

## How the build works

1. `vp build` builds the client bundle. Three.js is lazy-loaded per visual.
2. `vp build --ssr src/entry-server.tsx` builds a server renderer.
3. `scripts/prerender.ts` renders every route to static HTML with its own head tags and JSON-LD, then writes the `.md` twins, `llms*.txt`, `sitemap.xml`, `robots.txt` and `feed.json`.

## Content

- Taxonomy: `src/content/taxonomy.ts` (Category › Subcategory). A new topic area is one entry there.
- Sheets: `src/content/sheets/<category>/<slug>.ts` + visual `src/visuals/scenes/<category>/<slug>.tsx`. See `docs/reference/authoring.md`.
- Roadmap: `tasks/roadmap.md`.

## Updates (email)

- `worker/`: one Worker `gdcs-prd-01`. Static assets are served first; `/api/*` (subscribe, confirm, unsubscribe, event) runs the Worker (`run_worker_first`). It binds D1 `gdcs-prd` and Email Service, and its `scheduled()` sends the weekly digest (Mondays 14:00 UTC), only when `feed.json` shows changes. Sender: `gdcs@mail.coody.app`.

## Deploy

Pushing to `main` runs `.github/workflows/cd.yaml`: check → test → build → D1 migrations → `wrangler deploy`. It needs a `CLOUDFLARE_API_TOKEN` with these permissions:

- Account · Workers Scripts · Edit
- Account · D1 · Edit
- Account · Email Sending · Edit
- Zone (coody.app) · Workers Routes · Edit

Manual: `pnpm deploy`.

## Versioning

Semantic Versioning. See [docs/reference/versioning.md](docs/reference/versioning.md). Documentation starts at [docs/README.md](docs/README.md).

## Licenses

See `LICENSE.md` and https://gdcs.coody.app/license. Third-party: `THIRD_PARTY_LICENSES.md`.
