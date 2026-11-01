# GDCS — Game Development Cheat Sheet · Spec & Plan

Status: **APPROVED** (2026-11-01)
Target: https://gdcs.coody.app

## 1. Findings from discovery

| Source | What it is | What we reuse |
| --- | --- | --- |
| `coodyapp/www` (coody.app) | Vite+ (`vp`) · React 19 · TS · Tailwind v4 · three · react-router 7 · **pnpm** · Cloudflare Pages + Pages Functions + D1 · custom build-time prerender plugin (`scripts/prerender.ts`) · `_headers` CSP · cookieless analytics | Design tokens (`globals.css`: HSL tokens, Inter Variable + Cal Sans, `--text-display/title/lead`), prerender/sitemap pattern, Functions + D1 + migrations pattern, CI/CD workflow, `_headers` |
| `physics` (physics.coody.app) | Same Vite+ toolchain (yarn), React Three Fiber + drei, 18 lab sims + 3 GR sims, 29 physics tests. Pages project `coody-physics-prd-01`. Repo `augustobr1to/physics` → redirects to **`coodyapp/physics`** (public) | All 21 simulations + `src/physics/*` equations + tests become the Physics category |
| Game-dev topic reference (external, unnamed) | 34 widely used game-dev concepts in 4 groups. Card = hook + animated demo + explanation + copyable prompt; detail page = when to use, pseudocode, mistakes, related. | **Topic list only** (generic industry terms). All explanations, code, prompts and visuals are original. The source is never named in the repo, commits, or site. |

Other facts:
- Wrangler is logged in with `email_sending (write)`, `email_routing`, D1, Pages scopes → everything can run on Cloudflare.
- The physics working tree has one uncommitted change (`public/logo-dark.png` deleted). It doesn't affect the migration.
- The GitHub MCP server failed to connect; the `gh` CLI is authenticated as `augustobr1to` and works.

## 2. Decisions (recommended defaults)

1. **Stack** = coody.app stack: Vite+ / React 19 / TS / Tailwind v4 / react-router 7 / pnpm / Cloudflare Pages + Functions + D1. Visualizations use **React Three Fiber + drei**, as the physics project does, so its scenes port unchanged.
2. **SSG, more than coody.app**: the build prerenders the **full HTML of each page** (title, explanation, formulas, code, related links) with `react-dom/server`, and the client hydrates it. coody.app only puts an sr-only summary in its HTML. The Three.js canvas is client-only and lazy-mounted.
3. **Formulas**: KaTeX rendered to HTML at build time, so the client ships no math JS.
4. **One source of truth**: each cheat sheet is a typed TS module (metadata + sections + prompt + lazy `Visual`). The HTML page, `.md` endpoint, Copy-as-Markdown, llms.txt, llms-full.txt, JSON-LD, sitemap, and email digest are all generated from it.
5. **Performance**: index/grid pages show a lightweight static preview. A canvas mounts only when its card is in view (IntersectionObserver), with at most about 3 live canvases; `frameloop="demand"` when idle; `prefers-reduced-motion` pauses animation. Three.js is in its own chunk and never blocks LCP.

## 3. Information architecture

`Category › Subcategory › Cheat sheet`. Every sheet has exactly one canonical home; other places link to it as related.

| Category (`/c`) | Subcategories → sheets (phase 1) |
| --- | --- |
| `/threejs` Three.js & Rendering | `rendering`: raycasting, normals, level-of-detail, frustum-culling, fragment-shader, billboarding, z-fighting |
| `/mathematics` Mathematics | `rotations`: quaternions · `interpolation`: easing · `procedural`: seeded-noise |
| `/game-feel` Game Feel | `timing`: delta-time, coyote-time, input-buffering, hit-stop, invincibility-frames · `motion`: acceleration-and-friction, squash-and-stretch · `camera`: camera-deadzone, screen-shake |
| `/systems` Systems | `patterns`: object-pooling, particle-system · `simulation`: fixed-timestep · `collision`: hitbox-hurtbox, tunneling |
| `/ai` AI | `navigation`: a-star-pathfinding · `steering`: steering-behaviors · `decision`: finite-state-machine |
| `/performance` Performance | `cpu`: frame-budget, time-slicing · `gpu`: draw-calls, overdraw, texture-atlas · `world`: spatial-partitioning, chunk-streaming |
| `/physics` Physics | `mechanics` (9), `electromagnetism` (3), `thermodynamics` (3), `quantum-mechanics` (3), `relativity` (mass-effect, gravitational-waves, mercury-precession) |

Total in phase 1: **34 game-dev + 21 physics = 55 sheets.**

URLs (stable, lowercase, no trailing slash):
- `/` · `/{category}` · `/{category}/{subcategory}` · `/{category}/{subcategory}/{slug}`
- `/{category}/{subcategory}/{slug}.md` (raw Markdown, `text/markdown; charset=utf-8`)
- `/llms.txt`, `/llms-full.txt`, `/sitemap.xml`, `/robots.txt`, `/search-index.json`
- New areas (e.g. `/web`, `/devops`) = add a category entry + sheet modules. Nothing in routing or SEO code changes.

## 4. Cheat sheet template

Each sheet module provides: `title`, `slug`, `category`, `subcategory`, `summary` (≤160 chars, used as the meta description), `hook`, `level` (core/common/advanced), `tags`, `updated`, and these sections:
1. **Visual**: interactive R3F scene with 1–3 controls (sliders/toggles), labelled axes/legend, and pause/reset.
2. **What it is**: 2–4 sentences.
3. **Key formulas** (KaTeX) and/or **rules of thumb** (numbers).
4. **Implementation**: one short Three.js/TypeScript snippet, plus engine-neutral pseudocode where it helps.
5. **Common mistakes**: 3–5 bullets.
6. **Prompt**: the ready-to-paste AI prompt (Copy button on card and page).
7. **Related** sheets and **Further reading** (external docs).

Page actions: `Copy prompt`, `Copy as Markdown`, `View .md`. Breadcrumbs, previous/next within the subcategory.

## Decisions confirmed (2026-11-01)
- Build all phases, 0 → 9.
- Email: **Cloudflare Email Service** (`send_email` binding) from `gdcs@mail.coody.app` (mail.coody.app is already onboarded; no new DNS).
- physics.coody.app: **remove the DNS record + Pages project** in cleanup, without redirects. Each step is still confirmed with you first.
- Repo: **`coodyapp/gdcs`, public**. The game-dev topic source is never named in code, commits, docs, or the site. Third-party credits go in `THIRD_PARTY_LICENSES.md`.

## 5. Checklist

### Phase 0 — Scaffold
- [x] Init repo in `/Users/augustobrito/Work/gdcs` (git, pnpm, Vite+, TS, Tailwind v4, R3F/drei, react-router 7, KaTeX), mirroring the `www` configs (`vite.config.ts` lint/fmt, `tsconfig`, `components.json`, `mise.toml`, husky/commitlint, AGENTS.md).
- [x] Port coody design tokens, fonts, and logo; build the layout (header with category nav + search, footer "Powered by Coody", theme toggle).
- [ ] Verify: `vp check`, `vp test`, `vp build`, `vp dev`.

### Phase 1 — Content model, routing, SSG
- [x] `src/content/schema.ts` (types + zod-free runtime validation test) and `src/content/registry.ts` (categories, subcategories, sheets).
- [x] Pages: home (category grid + search), category, subcategory, sheet detail, 404, about.
- [x] Build plugin: SSR-prerender every route into `dist/**/index.html` with per-page `<title>`, description, canonical, OG/Twitter, JSON-LD; generate `.md`, `llms.txt`, `llms-full.txt`, `sitemap.xml`, `search-index.json`.
- [x] Tests: unique slugs/URLs, description length, every sheet has a visual + prompt, and prerendered HTML contains the h1 and canonical.

### Phase 2 — Physics migration (21 sheets)
- [x] Copy `src/physics/*` + tests, and refactor the 18 lab scenes and 3 GR scenes into per-sheet `Visual` components on shared controls.
- [x] Write the sheet content from the existing `summary/principle/equations/method/expectedOutput`, adding formulas, mistakes, and a prompt.
- [x] Verify: the 29 existing physics tests pass; each scene was visually checked in the browser.

### Phase 3 — Game-dev sheets (34)
- [x] Write original content + Three.js visual for each of the 34 topics, in batches by category (Three.js → Game Feel → Systems/AI → Performance → Math).
- [x] Unit-test the pure helpers behind the visuals (easing fns, A*, fixed-step accumulator, PRNG/noise, steering, grid partitioning).
- [x] Verify each batch in the browser (screenshot + console clean).

### Phase 4 — AI-ready
- [x] Copy-prompt button on every card + detail page; Copy as Markdown; `.md` link with `<link rel="alternate" type="text/markdown">`.
- [x] `llms.txt` (spec format: H1, summary, sections per category linking `.md` URLs) + `llms-full.txt`.
- [x] JSON-LD: `WebSite` + `Organization` (home), `CollectionPage` + `ItemList` (category/subcategory), `TechArticle` + `LearningResource` + `BreadcrumbList` (sheet).
- [x] robots.txt explicitly allows AI/search crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.).

### Phase 5 — SEO & Core Web Vitals
- [x] Unique titles/descriptions, canonical, OG/Twitter (build-time OG image per category + default), semantic HTML (`main/article/nav/section`, one h1).
- [x] `_headers`: CSP (based on www's), immutable `/assets/*`, `text/markdown` for `*.md`, short cache + `stale-while-revalidate` for HTML.
- [x] Lighthouse (mobile) on home, one category, and two sheets: target Perf ≥ 90, SEO = 100, A11y ≥ 95, Best Practices = 100; LCP < 2.5 s, CLS < 0.1. Validate JSON-LD (schema validator).

### Phase 6 — Get Updates (email)
- [x] D1 `gdcs-prd` with `subscribers(id, email, status pending|active|unsubscribed, confirm_token, unsub_token, created_at, confirmed_at)` and `sends(id, sent_at, sheet_ids)`.
- [x] `POST /api/subscribe` (Pages Function): validation, Turnstile, rate limit, double opt-in email. `GET /api/confirm`, `GET /api/unsubscribe` + `List-Unsubscribe` header (one-click POST).
- [x] `workers/mailer`: a Worker with a **cron trigger** (Pages has no cron) that sends a digest of sheets added/updated since the last send, built from `/search-index.json`. Skips the send if nothing changed.
- [x] Sending: Cloudflare Email Service `send_email` binding from `updates@gdcs.coody.app` (SPF/DKIM/DMARC set up in the zone). Fallback: an email API (e.g. Resend) called from the same Worker.
- [x] Tests for parsing, tokens, the digest builder, and idempotent sends.

### Phase 7 — Cloudflare deployment
- [x] GitHub repo `coodyapp/gdcs`, CI (`vp check`, `vp test`, `vp build`) + CD (`wrangler pages deploy`) copied from www.
- [x] Pages project `coody-gdcs-prd-01`, D1 + MAILER bindings. Custom domain added in Pages, **waiting on the CNAME** (see Review).
- [ ] Verify: DNS resolves (proxied CNAME), HTTPS, cache headers (`cf-cache-status`), `.md` content type, Web Analytics enabled, sitemap submitted path reachable, `/api/subscribe` end-to-end with a real inbox.

### Phase 8 — Cleanup (each step needs your explicit confirmation)
- [x] Before anything: confirm the 21 physics sheets are live and match the old ones.
- [ ] ⚠️ Delete GitHub repo `coodyapp/physics`. Confirmed by you, but blocked: the gh token needs the `delete_repo` scope.
- [x] ⚠️ Delete local folder `/Users/augustobrito/Downloads/coodyapp/physics`.
- [x] ⚠️ Custom domain detached and Pages project `coody-physics-prd-01` deleted (2026-11-01). **The DNS record must be removed in the dashboard.**

### Phase 9 — Roadmap & wrap-up
- [x] Draft `tasks/roadmap.md` from the topic table (done in planning; review together).
- [x] Final summary: what was built, what was verified (with outputs), what remains. Add a review section to this file.

## 6. Risks / notes
- **Scope**: 55 hand-built interactive scenes is the bulk of the work. I'll ship in batches and deploy early (phases 0, 1, 2, 7 first) so the site is live while game-dev sheets fill in.
- **Copyright**: the game-dev topic reference has no license. No text, code, or demo is copied, and it is not named anywhere. Other references (Three.js, KaTeX, Gaffer On Games, Red Blob Games, Box2D, etc.) are credited in `THIRD_PARTY_LICENSES.md` and in each sheet's Further reading.
- Email deliverability depends on domain authentication. The first sends go to you only.

## Progress log
- 2026-11-01: Scaffold, content model, SSR prerender, KaTeX build plugin, lazy visual shell, SEO/JSON-LD, Markdown/llms/feed exports done. Two reference sheets (projectile-motion, raycasting) verified in headless Chrome.
- 2026-11-01: D1 `gdcs-prd` created and migrated. `gdcs-mailer-prd-01` Worker deployed (cron Mon 14:00 UTC; sender `gdcs@mail.coody.app`). Pages project `coody-gdcs-prd-01` created.
- Decision: the API lives in Pages Functions; email sending is in the mailer Worker via a service binding, because the `send_email` binding is a Worker binding. Spam protection is a honeypot, per-IP rate limit and double opt-in (Turnstile deferred).
- Decision: physics URLs move from `/simulations/<cat>/<slug>` to `/physics/<sub>/<slug>`. No redirects, per the decision to remove physics.coody.app.

## Review (2026-11-01)

### Built
- 55 sheets (34 game-dev in 6 categories + 21 physics in 5 subcategories). Each has an interactive R3F visual, KaTeX formulas, code, mistakes, prompt, related and reading.
- Prerendered SSR HTML for 86 routes, `.md` twins, `llms.txt`, `llms-full.txt`, `feed.json`, `sitemap.xml`, `robots.txt` (AI crawlers allowed), and JSON-LD on every page.
- Main bundle is ~114 KB br. three.js loads lazily (~196 KB br). Sheet bodies are lazy chunks, cards mount through an idle queue, and CSS is inlined.
- Get Updates: Pages Functions (subscribe/confirm/unsubscribe/event) + D1 `gdcs-prd` + `gdcs-mailer-prd-01` Worker (double opt-in, weekly digest cron, RFC 8058 one-click unsubscribe).
- Physics bugs fixed during the migration: about 15 across mechanics, EM/thermo and relativity (see agent notes in git history).

### Verified
- `vp check` clean; `vp test` 740/740 (content contract, physics incl. Mercury, API, mailer, prerender); `pnpm build` OK.
- Headless Chrome: every sheet page screenshotted with no console errors and no hydration errors.
- Local API: subscribe 202/400/403/429, confirm → active, unsubscribe link + one-click, tampered token rejected, resend throttle and rolling daily cap, events only for real pages.
- Production (pages.dev): content types, cache headers, canonical/JSON-LD/markdown alternate, live subscribe → remote D1 (test row removed).
- Lighthouse mobile on the Cloudflare edge: A11y 100, Best Practices 100, SEO 100 on 5 pages; Performance 82–96; CLS ≤ 0.02; LCP 2.0–3.2 s.
- JSON-LD parses on all 86 pages; exactly one `<title>` and `<h1>` per page.

### Needs you
1. DNS (coody.app zone): add `CNAME gdcs → coody-gdcs-prd-01.pages.dev` (proxied), and delete the `physics` record.
2. Web Analytics: Pages project `coody-gdcs-prd-01` → Metrics → enable Web Analytics.
3. CI deploy: the org secret `CLOUDFLARE_API_TOKEN` gets an auth error on `coody-gdcs-prd-01`. Grant it Pages:Edit on this project (+ D1:Edit / Workers Scripts:Edit to automate migrations/mailer), or deploy with `wrangler pages deploy` as done so far.
4. `gh auth refresh -h github.com -s delete_repo`, then the physics repo can be deleted.

### Remaining / follow-ups
- End-to-end email: confirm with a real inbox once gdcs.coody.app resolves (the mailer only accepts links on that origin).
- Turnstile on the signup form (currently honeypot + rate limits + double opt-in).
- Performance on sheet pages is bounded by the three.js parse; a lighter static poster before first interaction could push it above 90.
- Roadmap: `tasks/roadmap.md` (13 ✅ / 15 🟡 / 12 ⬜ in the Top-40).

### Lessons
- The shared org Cloudflare token is Pages-scoped and per-project. Check deploy permissions before wiring a new project into CD.
- Mixing `?` and `?N` placeholders in one SQLite statement binds the wrong values. Use numbered placeholders only.
