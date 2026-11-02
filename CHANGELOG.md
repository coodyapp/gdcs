# Changelog

All notable changes to GDCS. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html):

- **MAJOR**: breaking changes to public surfaces, such as sheet URLs, the `.md` / `llms.txt` / `feed.json` formats or the API.
- **MINOR**: new sheets, categories, learning paths or features.
- **PATCH**: fixes and content corrections.

The version shows in the site footer (from `package.json`). Releases are tagged `vX.Y.Z`.

## [1.0.1] - 2026-11-02

### Fixed

- Pageviews were double-counted: Cloudflare already injects the Web Analytics beacon at the edge, so the site no longer loads its own copy.

## [1.0.0] - 2026-11-02

### Added

- shadcn/ui (Base UI) components: code block with Shiki highlighting, badge, breadcrumb, button, input, dialog, kbd, separator, tooltip, slider, switch, toggle group.
- Field of view, field-of-view visualization and stencil buffer sheets (AI › Perception, Three.js › Rendering).
- Privacy policy, a "Get updates" dialog (full screen on phones), and an inline footer signup with a back-to-top link.
- Semantic versioning shown in the footer.

### Changed

- Removed the top header. Typing anywhere opens search.
- Consent version stored on subscribe; unsubscribing deletes the record.

## [0.4.0] - 2026-11-01

### Added

- 12 Top-40 sheets (vectors, dot/cross product, trigonometry, transforms, local vs world space, Euler angles, lerp/smoothstep, Bézier, rigid bodies, inverse kinematics, reflection/refraction, PBR) and an Animation category.
- Learning paths with Course JSON-LD; static WebP posters with WebGL deferred until interaction (blocking time ~10 ms); Turnstile on signup.

### Changed

- Coody-neutral UI (black, white and greys). Simulations use only green, yellow and red. Every scene was reviewed for shape cues and formula colours.

## [0.3.0] - 2026-11-01

### Added

- Design system, ⌘K command palette, docs-style sheet layout (sidebar, table of contents, reading progress), level filters and the portable `<PoweredByCoody />` component.

## [0.2.0] - 2026-11-01

### Changed

- Moved from Cloudflare Pages to a single Worker (static assets, API, mailer and weekly cron) on the gdcs.coody.app custom domain.

### Fixed

- Hardened subscriptions: confirmation throttling, rolling daily cap, per-endpoint rate limits.

## [0.1.0] - 2026-11-01

### Added

- Initial launch: 55 visual cheat sheets (game dev + physics), prerendered pages, Markdown twins, llms.txt, JSON-LD, sitemap, feed and email updates.

[1.0.1]: https://github.com/coodyapp/gdcs/releases/tag/v1.0.1
[1.0.0]: https://github.com/coodyapp/gdcs/releases/tag/v1.0.0
