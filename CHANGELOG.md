# Changelog

All notable changes to GDCS. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html):

- **MAJOR**: breaking changes to public surfaces, such as sheet URLs, the `.md` / `llms.txt` / `feed.json` formats or the API.
- **MINOR**: new sheets, categories, learning paths or features.
- **PATCH**: fixes and content corrections.

The version shows in the site footer (from `package.json`). Releases are tagged `vX.Y.Z`.

## [1.12.0] - 2026-11-02

### Added

- Embeds: "Copy embed code" on every sheet, and `/embed/<slug>` pages other sites can frame, with a link back to the sheet.
- `/license` page, and `third-party-licenses.txt` with the license text of every production dependency.
- License information in `llms.txt`, `.md` files, `robots.txt`, JSON-LD, page headers and JavaScript files.

### Changed

- License: sheet text and images CC BY 4.0, code examples and prompts MIT, simulations and site code all rights reserved. Earlier versions were MIT.

## [1.11.0] - 2026-11-02

### Added

- 5 multiplayer sheets: latency, RTT and jitter; lag compensation; dead reckoning; deterministic lockstep; interest management.

### Changed

- The Multiplayer & netcode path now has 10 steps.

## [1.10.3] - 2026-11-02

### Changed

- The theme follows the device automatically, including live changes. Auto, Light and Dark are chosen in one place: the last column of the footer.

## [1.10.2] - 2026-11-02

### Changed

- New Coody glitch logo in the favicons, app icons and default social card, with a maskable icon for Android. `pnpm brand` rebuilds them from `src/assets/brand`.

## [1.10.1] - 2026-11-02

Tagged but never deployed: a type error in the asset script failed the build.

## [1.10.0] - 2026-11-02

### Added

- Code blocks have line numbers, a file icon and a wrap button.

### Changed

- Prompts are real Markdown: the sheet title as a heading and each instruction as a bullet, with highlighting. Copy buttons and `.md` files use the same format. The wording is unchanged.

## [1.9.1] - 2026-11-02

### Fixed

- "Related" and "In learning paths" cards on a sheet are now the same size.

## [1.9.0] - 2026-11-02

### Added

- 5 sheets: client-side prediction, snapshot interpolation and rollback netcode in a new Networking category; behavior trees and utility AI.
- 2 learning paths: Multiplayer & netcode, and Game AI.

## [1.8.0] - 2026-11-02

### Added

- Light mode. It follows the system setting until you choose, with no flash on load. Simulations, code and formulas stay on dark panels in both themes.
- Search filters show live counts for the current search, and choices with no results are disabled. A single topic opens its subtopics.
- Sort results by best match, easiest first, A to Z or recently updated. Matching words are underlined in titles, and the down arrow moves into the results.
- When filters hide every result, the page says how many and offers to search everything.

### Changed

- Powered by Coody opens in a new tab.
- Signup text and privacy policy now say new sheets and updates.

### Fixed

- Long formulas that scroll sideways can be reached by keyboard.

## [1.7.1] - 2026-11-02

### Fixed

- Home page on phones: the hero poster ships inside the HTML, so the largest paint needs no second request.
- Camera projection: "Yellow box distance" now works while "Move the box" is on. The box moves around the chosen distance.

## [1.7.0] - 2026-11-02

### Added

- Big search on the home page, merged with the category and level filters. Results show inline, `?q=` links to a search, Enter opens the top result, and typing anywhere on the page goes to it.
- Email signup in the hero, the same form as the footer.

### Changed

- Hero and footer fibers appear with the first paint: a poster of the first frame hands over to the live canvas, with no fade from empty. The poster stays for reduced motion, data saver and no WebGL.
- Turnstile loads when someone starts using a signup form, not when the form comes into view.

### Removed

- The hero search button and the signup dialog.

## [1.6.1] - 2026-11-02

### Fixed

- Footer links meet the 24 px minimum touch target.

## [1.6.0] - 2026-11-02

### Added

- 8 sheets that finish the Top-40: collision detection, bounding volumes, impulse and momentum, moment of inertia, tangent space, camera projection, probability and weighted random, barycentric coordinates.
- `useLiveReadout` in the visual kit, so the line under the controls can show values that change during the animation.

### Changed

- New sheets added to the learning paths and linked from related sheets.

## [1.5.0] - 2026-11-02

### Added

- `SiteCredits`, a reusable component next to `PoweredByCoody`: "Built in" with the Brazilian flag, the Newton quote, the year and Back to top. Used in the footer.
- Cloudflare's `security-audit` skill in `.claude/skills/`.

## [1.4.1] - 2026-11-02

### Fixed

- Heading order on the learning paths page.

## [1.4.0] - 2026-11-02

### Changed

- Ghost Fibers now sits above the footer in place of the Gradient ASCII band, which is removed. The footer itself is plain.
- Hero: tagline removed, version in small type after the title, and the sheet count is larger and counts up.
- Footer: new column with the year, coody.app and Back to top.
- Filter bar: two rows that wrap instead of scrolling, so nothing overlaps or hides. Clear filters is always visible and disabled until a filter is active.
- Learning path cards use icons instead of images.
- Sheet cards have a proper footer with the level and a labelled Copy prompt action.

## [1.3.1] - 2026-11-02

### Changed

- Clear filters moved into the filter bar.
- Privacy contact is now hi@coody.app.
- Footer keeps only its top line, with "Powered by" inside the footer.

### Fixed

- Filter bar separator is centred next to the level filters.

## [1.3.0] - 2026-11-02

### Changed

- Footer has the hero's Ghost Fibers behind it, with no dividing lines. The fibers run off the bottom of the screen, so the page reads as endless.

## [1.2.1] - 2026-11-02

### Fixed

- ASCII band fills its space above the footer instead of a thin line under a gap.

## [1.2.0] - 2026-11-02

### Added

- Hero background: Ghost Fibers from React Bits, in Coody neutrals. Replaces the grid and the simulation wall.
- Low-opacity Gradient ASCII band before the footer.
- Version next to the tagline in the hero and footer.

### Changed

- Filter bar stays in place on the page instead of following the scroll, and is taller with more padding.
- Footer: centred year above "Powered by"; "Back to top" moved into the link columns.

### Removed

- Topics from the home page, including the filter.

## [1.1.3] - 2026-11-02

### Fixed

- Analytics beacon reports to the same-origin endpoint; the cross-origin one rejected it with a CORS error.

## [1.1.2] - 2026-11-02

### Changed

- Pages opt out of Cloudflare's injected bot-detection script with `no-transform`. It was the heaviest script on the page and nothing here uses its signal. Replaces the 1.1.0 nonce. The Worker now compresses pages, and the analytics beacon is a script tag.

### Fixed

- "Powered by" label contrast (the 1.1.1 fix did not apply).

## [1.1.1] - 2026-11-02

### Changed

- Home shows three sheets per category, fundamentals first, each linking to the full list. The page is much lighter and shorter.

### Fixed

- "Powered by" label contrast in the footer now meets WCAG AA.

## [1.1.0] - 2026-11-02

### Added

- Per-sheet social images (`/og/<slug>.jpg`, built with `pnpm og`).
- Phone menu: one small button with search and navigation.
- Hero wall of simulations: monochrome until touched.

### Changed

- Palette now uses the exact neutral greys of coody.app (it had drifted to blue-tinted zinc). Simulations use Tailwind green, yellow and red 400. All posters regenerated.
- UI rebuilt on shadcn components: card, item, progress, command, accordion, sheet, field, alert, empty, skeleton, spinner, scroll area.
- Filters and topics fit one line each; topics expand on demand.
- Learning path cards share the sheet card's anatomy, with the first steps as artwork.
- New footer with link columns; the X link is gone.
- Tighter type scale, margins and padding across all pages.

### Fixed

- Content Security Policy now passes Cloudflare's bot protection script through a per-request nonce, so it no longer logs a console error. Pages run through the Worker; hashed files and images still skip it. Reverted in 1.1.2: letting the script run cost too much main-thread time.

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
