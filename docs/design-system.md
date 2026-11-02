# GDCS design system

**Coody brand rule:** the UI is **black, white and greys only**: near-black base, Inter (body), Cal Sans (headings), uppercase monospace HUD eyebrows, pill chips. **Green, yellow and red** appear only inside simulations and formulas, where they carry meaning. Whites and greys may also be used inside simulations.

Palette source: Tailwind/shadcn **neutral** (the same greys as coody.app, no blue tint) for UI and simulations, plus Tailwind **green-400, yellow-400 and red-400** for simulations only.

Contrast ratios are WCAG 2.x relative luminance, measured against `bg #0a0a0a` / `card #171717`. Colour-vision checks use Machado 2009 simulation in OKLab.

## 1. Surfaces and text

| Token             | Value                 | Use                              |
| ----------------- | --------------------- | -------------------------------- |
| `--bg`            | `#0a0a0a`             | page                             |
| `--surface-1`     | `#171717`             | cards                            |
| `--surface-2`     | `#262626`             | hover, popovers                  |
| `--surface-3`     | `#404040`             | active, menus                    |
| `--border`        | white 8%              | dividers, card edges             |
| `--border-strong` | white 16% / `#404040` | inputs, hover                    |
| `--border-ui`     | `#737373` (4.18:1)    | UI boundaries that must meet 3:1 |
| `--text`          | `#fafafa` (18.97)     | headings, body                   |
| `--text-2`        | `#a3a3a3` (7.85)      | secondary                        |
| `--text-3`        | `#a3a3a3` (7.85)      | meta, eyebrows                   |

Rules: never use pure `#fff` on `#000`. Show elevation by lightening the surface, not with shadows. neutral-500 (`#737373`) is **not** allowed for text. Body text weight ≥ 400. Antialiased font smoothing.

## 2. Simulation colours (Three.js visuals and formulas only)

| Token (`palette.*`)               | Hex                             | bg / card     | Meaning                              |
| --------------------------------- | ------------------------------- | ------------- | ------------------------------------ |
| `subject` / `primary`             | `#fafafa` white                 | 18.97 / 17.18 | the main subject, selection, ray     |
| `secondary` / `moving` / `energy` | `#fdc700` yellow                | 12.58 / 11.39 | the moving thing, energy, highlight  |
| `velocity` / `warning`            | `#fdc700` yellow, **dashed**    | 12.58 / 11.39 | velocity, trajectory                 |
| `tertiary`                        | `#a3a3a3` grey                  | 7.85 / 7.11   | secondary object (outline/wireframe) |
| `accel`                           | `#d4d4d4` light grey            | 13.36 / 12.09 | acceleration, torque                 |
| `success` / `positive`            | `#05df72` green                 | 11.13 / 10.08 | valid, goal, grounded, normals       |
| `force` / `error` / `negative`    | `#ff6467` red                   | 6.85 / 6.21   | force, error, contact, danger        |
| `object`, `guide`, `surface`      | `#737373`, `#a3a3a3`, `#262626` |               | props, helpers, floors               |

Rules:

1. Only three hues exist: green, yellow, red. Everything else is a white or grey step.
2. **Never use hue alone (WCAG 1.4.1).** Velocity = dashed yellow, force = solid red, a moving body = solid yellow. A secondary object is a grey outline or wireframe. Use labels in readouts. Red vs green also differ strongly in lightness (6.2 vs 11.6:1), so they stay distinguishable for colour-blind users.
3. **Formulas match visuals.** A variable gets the same colour in KaTeX (`\textcolor{...}`) as its element in the scene, using only `#fafafa`, `#a3a3a3`, `#d4d4d4`, `#fdc700`, `#05df72` or `#ff6467`.
4. Ramps (heat, speed, height) run dark grey → yellow → white, or green → yellow → red for "good → bad". Never rainbow.
5. Helpers and lines use unlit materials, so the colours stay true.

## 3. UI colour (Coody neutrals)

- Category identity comes from **labels and icons, not hue**. Every category uses the same neutral mark (`--color-ui-mark` `#a3a3a3`).
- Active and selected states use white (`--color-ui-strong`) or white tints (`white/8%` fill, `white/16%` border).
- The focus ring is 2px white, offset 2px (18.97:1).
- Copy confirmations, progress bars and checkmarks are white.

## 4. Components

- **Card**: `surface-1`, white-8% border, 2px top border in neutral grey (white on hover). On hover: `surface-2`, border 16%, accent 100%, arrow moves 2px. One link per card (stretched link). Copy button above the overlay. No long description in grids: title, hook, level pips, poster.
- **Focus**: `outline: 2px solid #fafafa; outline-offset: 2px` via `:focus-visible`. Never remove without a replacement. `scroll-padding-top` = header height (WCAG 2.4.11).
- **Buttons/chips**: primary = `#FAFAFA` fill with `#0a0a0a` text. Secondary = transparent with a 16% border. Active filter = white fill. Min height 32px, target ≥ 24×24.
- **Links in prose**: underline at white 40%, 100% on hover.
- **Copy feedback**: label → "Copied ✓" for 1.5s with a fixed width, plus `aria-live="polite"`, and say what was copied.

## 5. Navigation

- Top bar: logo · visible search with `⌘K` / `/` hint · About · Get updates. On mobile: logo · search icon · menu drawer (category accordion).
- Home: sticky category chips with scroll-spy. Filters (level, category) live in the URL.
- Sheet pages: left sidebar (all sheets, grouped, current highlighted) at ≥1024px. Right "On this page" TOC at ≥1280px. Breadcrumbs in HUD style. Prev/next, Related, and Builds on / Leads to.
- Command palette: fuzzy search over title, hook, tags, aliases. Recently viewed (localStorage). Full keyboard support.

## 6. Engagement (no dark patterns)

- Progressive disclosure: visual + one-line intuition + key formula first. Longer material follows.
- Learning paths with an "n of m" position. Visited ticks and recently viewed are stored **locally only**.
- Reading time and a thin progress bar on sheets.
- No modals, streaks, fake scarcity or email gates. "Get updates" is inline only.

## 7. Motion and performance

- 120–200 ms ease-out, transform/opacity only.
- `prefers-reduced-motion`: sims start paused, no hover lift, no scroll effects.
- Static posters in grids; WebGL only on the sheet page (and on hover/interaction). Pause sims offscreen and when the tab is hidden. DPR ≤ 2. Reserved aspect ratio (CLS 0).

## Sources

NN/g (mega menus, search visibility, breadcrumbs, cards, progressive disclosure, dark mode, mobile navigation) · Material dark theme · WCAG 2.2 Understanding docs (1.4.3, 1.4.11, 2.4.11, 2.4.13, 2.5.8, 2.3.3) · Radix Colors scale · Linear UI redesign · Okabe–Ito and Paul Tol CVD palettes · Machado 2009 CVD simulation · Sara Soueidan on focus indicators · web.dev Core Web Vitals / INP / prefers-reduced-motion · deceptive.design.
