# GDCS — Game Development Cheat Sheet · Spec & Plan

Status: **APPROVED** (2026-11-01)
Target: https://gdcs.coody.app

## 1. Findings from discovery

| Source | What it is | What we reuse |
| --- | --- | --- |
| `coodyapp/www` (coody.app) | Vite+ (`vp`) · React 19 · TS · Tailwind v4 · three · react-router 7 · **pnpm** · Cloudflare Pages + Pages Functions + D1 · custom build-time prerender plugin (`scripts/prerender.ts`) · `_headers` CSP · cookieless analytics | Design tokens (`globals.css`: HSL tokens, Inter Variable + Cal Sans, `--text-display/title/lead`), prerender/sitemap pattern, Functions + D1 + migrations pattern, CI/CD workflow, `_headers` |
| `physics` (physics.coody.app) | Same Vite+ toolchain (yarn), React Three Fiber + drei, 18 lab sims + 3 GR sims, 29 physics tests. Pages project `coody-physics-prd-01`. Repo `augustobr1to/physics` → redirects to **`coodyapp/physics`** (public) | All 21 simulations + `src/physics/*` equations + tests become the Physics category |34 widely used game development concepts in 4 groups. Card = hook + animated demo + explanation + copyable prompt; detail page = when to use, pseudocode, mistakes, related. | **Topic list only** (generic industry terms). All explanations, code, prompts and visuals are original. The source is never named in the repo, commits, or site. |

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

Total in phase 1: **34 game development + 21 physics = 55 sheets.**

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
- Third-party credits go in `THIRD_PARTY_LICENSES.md`.

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

### Phase 3 — Game Development sheets (34)
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
- **Scope**: 55 hand-built interactive scenes is the bulk of the work. I'll ship in batches and deploy early (phases 0, 1, 2, 7 first) so the site is live while game development sheets fill in.
- **Copyright**: No text, code, or demo is copied, and it is not named anywhere. Other references (Three.js, KaTeX, Gaffer On Games, Red Blob Games, Box2D, etc.) are credited in `THIRD_PARTY_LICENSES.md` and in each sheet's Further reading.
- Email deliverability depends on domain authentication. The first sends go to you only.

## Progress log
- 2026-11-01: Scaffold, content model, SSR prerender, KaTeX build plugin, lazy visual shell, SEO/JSON-LD, Markdown/llms/feed exports done. Two reference sheets (projectile-motion, raycasting) verified in headless Chrome.
- 2026-11-01: D1 `gdcs-prd` created and migrated. `gdcs-mailer-prd-01` Worker deployed (cron Mon 14:00 UTC; sender `gdcs@mail.coody.app`). Pages project `coody-gdcs-prd-01` created.
- Decision: the API lives in Pages Functions; email sending is in the mailer Worker via a service binding, because the `send_email` binding is a Worker binding. Spam protection is a honeypot, per-IP rate limit and double opt-in (Turnstile deferred).
- Decision: physics URLs move from `/simulations/<cat>/<slug>` to `/physics/<sub>/<slug>`. No redirects, per the decision to remove physics.coody.app.

## Review (2026-11-01)

### Built
- 55 sheets (34 game development in 6 categories + 21 physics in 5 subcategories). Each has an interactive R3F visual, KaTeX formulas, code, mistakes, prompt, related and reading.
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

---

# Phase 2 (2026-11-01) — Workers migration, design system, content batch

Status: **APPROVED 2026-11-01** (custom-domain cutover). Order: A (Workers) → B (design) → C (Top-40 batch) → D (learning paths) → E (performance) → F (polish).

## A. Pages → Workers (single Worker)
Decision: **one Worker `gdcs-prd-01`** with Static Assets + API + mailer + cron. The mailer merges in, which removes the service binding and the separate deploy. Bindings: `ASSETS`, `DB` (D1 `gdcs-prd`), `EMAIL` (send_email), cron `0 14 * * 1`.
- [x] `wrangler.jsonc`: `main: worker/index.ts`, `assets: { directory: "./dist", binding: "ASSETS", html_handling: "auto-trailing-slash", not_found_handling: "404-page", run_worker_first: ["/api/*"] }`.
- [x] Port `functions/api/*` + `functions/_lib/*` into `worker/` (a small router: POST subscribe, GET confirm, GET/POST unsubscribe, POST event). Mailer code moves from `workers/mailer` → `worker/mailer.ts`, so subscribe calls the mailer function directly. `scheduled()` sends the digest.
- [x] Keep `_headers` (applies to static assets on Workers). API responses already set their own headers.
- [x] Web Analytics: Pages auto-injection doesn't carry over to Workers, so add the beacon `<script>` explicitly (site token `a9144059…`). CSP already allows it.
- [x] Remove `functions/`, `public/_routes.json`, `workers/mailer`. Add `dist/.assetsignore`.
- [x] Tests: move existing API/mailer tests and add router tests (method/route dispatch, 404 for unknown `/api/*`).
- [x] Parity check before cutover: deploy to `gdcs-prd-01.<subdomain>.workers.dev`, then diff status + key headers (content-type, cache-control, CSP) for all 86 routes, every `.md`, llms/feed/sitemap/robots, a 404, and `/assets/*` against the current Pages site. Run API flows end to end (send to your inbox).
- [x] Cutover done 2026-11-01: `gdcs.coody.app` is a Workers custom domain on `gdcs-prd-01`; the temporary zone route was removed. Downtime < 1 min.
- [x] CD: `wrangler deploy` (+ `d1 migrations apply`). Token permissions needed: Account · Workers Scripts Edit, Account · D1 Edit, Account · Email Sending Edit, Zone (coody.app) · Workers Routes Edit. Delete the old `gdcs-mailer-prd-01` Worker and the Pages project `coody-gdcs-prd-01` **after you confirm**.

- [x] Deleted Pages project `coody-gdcs-prd-01` and Worker `gdcs-mailer-prd-01` (confirmed by you). The CD run with the new token passed (migrations + deploy).
- [x] `<PoweredByCoody />` (`src/components/coody/`): portable glitch-logo component, used in the footer.

## B. UI/UX + colour system (rules: `docs/design-system.md`)
- [ ] Tokens: surfaces/text/semantic accents/category accents as Tailwind v4 `@theme` (OKLCH + hex). Retire zinc-500 for text. Focus ring = 2px cyan, offset 2.
- [ ] Visual palette (`src/visuals/core.ts`) → semantic names (`subject`, `moving`, `secondary`, `success`, `velocity`, `accel`, `force`). Codemod all 55 scenes, then review each for the hue-only rule (dash/shape for velocity vs force) and screenshot every scene.
- [ ] Formula ↔ visual colour link: KaTeX `\textcolor` on the key variables in each sheet (force, velocity, energy…).
- [ ] Cards: slimmer (title, hook, level pips, category accent top border, poster). Long summary off the grid. Hover/focus states per spec. Visited tick.
- [ ] Navigation: ⌘K command palette (fuzzy search + recently viewed). Mobile drawer. Sticky category chips with scroll-spy and level filter in the URL on home. Sheet layout with left sidebar + right TOC + reading time + progress bar. Builds-on / Leads-to chips.
- [ ] Reduced-motion branch: sims paused by default, no hover lift.
- [ ] Validate: before/after screenshots (desktop 1280 + mobile 390; home, category, sheet), automated contrast test over tokens (vitest), Lighthouse: A11y 100 and Performance not lower than before.

## Progress (2026-11-02)
- A, B, C, D, E and F1 (Turnstile) are done. B changed direction per your feedback: the UI uses Coody neutrals only; simulations use green, yellow and red plus greys. The top header, floating search and /updates page were removed. shadcn (Base UI) components adopted. Field-of-view and stencil sheets added. Home cards animate within a live-canvas budget (4 desktop / 2 phone, 30 fps). Released as v1.0.0.
- F2, per-sheet OG images: done in v1.1.0.

## C. Top-40 gap batch (12 sheets, same parallel workflow as phase 1)
mathematics: vectors, trigonometry, dot-and-cross-product, transforms-and-matrices, local-vs-world-space, euler-angles · interpolation: lerp-and-smoothstep, bezier-curves · physics/mechanics: rigid-body-dynamics · animation (new category): inverse-kinematics · threejs/rendering: reflection-and-refraction, pbr-materials.
- [ ] Each built on the new palette; content contract tests; screenshot review; roadmap ✅ updates.

## D. Learning paths (hub pages)
- [ ] `/paths/<slug>`: racing & vehicles, character animation & IK, procedural worlds, multiplayer & simulation, 3D math foundations. Each is an ordered list of existing sheets with one sentence of why, progress checkmarks (localStorage), JSON-LD `Course`/`ItemList`, and sitemap + llms.txt entries.

## E. Performance: static poster before WebGL
- [ ] Build-time poster per visual (headless capture of the default frame → `.webp`, ~15–30 KB) shown in cards and as the sheet LCP. The canvas replaces it on view/interaction. Target mobile Performance ≥ 95 on sheet pages without losing interactivity.

## F. Polish
- [ ] Cloudflare Turnstile (managed, invisible) on subscribe, verified in the Worker. Secret in Worker secrets.
- [x] Per-sheet OG images (1200×630) from the poster + title (`pnpm og`, committed).

## Review: v1.1.0 (2026-11-02)
- Shipped: neutral palette matching coody.app, Tailwind 400 sim hues, shadcn component pass, compact filters, new path cards and footer, phone menu, CSP nonce, OG images.
- Lesson: compare tokens against the real coody.app CSS, not by eye. Zinc passed review for weeks because it is nearly grey.
- Lesson: shadcn's Base UI `data-selected:` variant matches attribute presence; cmdk always sets the attribute, so use `data-[selected=true]:`.
- Local `wrangler dev` needs `--compatibility-date 2026-09-30` until wrangler is upgraded.
- Lesson: measure a third-party script's cost before unblocking it. The nonce was Cloudflare's documented fix and removed a console error, but it let a script run that used more CPU than the whole app.

## Review: v1.6.0 (2026-11-02)
- Top-40 complete: 40 of 40. Roadmap section statuses corrected where a sheet demonstrably covers the term.
- Lesson: readouts need a live channel. Four scenes hit the same wall independently before `useLiveReadout` existed.

## Home loading and search (v1.7.0, 2026-11-02)
- [x] Fibers: poster of the exact first frame on first paint (hero and footer), cross-fade to live with no intro, start sooner, chunk fetched ahead. Poster stays for reduced motion, data saver and no WebGL.
- [x] Big search merged with category and level filters, inline results, `?q=`; typing and ⌘K focus it on home, palette elsewhere.
- [x] Hero: email form like the footer in place of search and button. Turnstile loads on first focus, not on view.
- [x] Verify: screenshots at 1280 and 390, Lighthouse before and after, tests.

## Then
- [x] v1.7.1: home phone LCP (inline poster), Yellow box slider while moving. Sheet pages: real paint is about 0.2 s, simulated scores vary run to run, main bundle has no leak to cut.
- [x] Signup and confirmation: done by the user, subscription active.
- [ ] Digest: not tested yet. Dry run first, and confirm before sending anything.
- [ ] Later sheets: see "Planned next" in tasks/roadmap.md.

## Batch 2, group A (v1.8.0)
- [x] client-side-prediction, snapshot-interpolation, rollback-netcode (new Networking category); behavior-trees, utility-ai. Review, posters, OG, backlinks, multiplayer and game AI paths, roadmap, changelog.

## Review: v1.7 to v1.9 (2026-11-02)
- Lesson: confirm which server answers before trusting a run. Lighthouse and browser checks hit a leftover dev server on the port, and later a stale build after a failed `tsc`.
- Lesson: Lighthouse LCP moves to any image that outgrows the text. Check the LCP element after adding a hero image.
- Lesson: inline scripts under a CSP hash must not be reformatted; `index.html` is now excluded and a test compares the hash.

## Multiplayer group (v1.11.0)
- [x] latency-and-jitter, lag-compensation, dead-reckoning, deterministic-lockstep, interest-management. Review, posters, OG, links, extend the Multiplayer path, roadmap, changelog.

## Review: v1.10 to v1.11 (2026-11-02)
- Lesson: gate the push on the checks with `if`, not `;`. A failing build was pushed once because the commands were chained loosely; CD stopped it and production was unaffected.

## License and embeds (v1.12.0)
- [x] LICENSE.md split: CC BY 4.0 text and images, MIT code examples and prompts, all rights reserved simulations and site code, third party excluded.
- [x] /embed/<slug> outside the layout: simulation, controls, backlink; framable, noindex, no canonical, not in sitemap.
- [x] "Copy embed code" on sheets: iframe plus a visible link on the host page.
- [x] /license page, footer link, sitemap, llms.txt.
- [x] Signals: rel=license, Link header, JSON-LD, .md footer, llms.txt, robots comment, notice in JS bundles.
- [x] Verify: real iframe from another origin, headers, axe, tests.

## Review: v1.12.0 (2026-11-02)
- Lesson: a link inside an iframe is not a backlink for the host page, so the embed code carries a visible link too.
- Lesson: a failed `pnpm build` leaves the old `dist` in place, so stop on failure before testing or the checks read stale output.
- Earlier versions shipped as MIT; relicensing is not retroactive. A lawyer should review LICENSE.md.

## License follow-up (v1.12.5)
- [x] Open source declined: repo stays private, split license kept. Audit fixes applied, third-party notices completed, docs structure added.
