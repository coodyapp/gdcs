# GDCS design system

Coody brand kept: near-black neutral base, Inter (body), Cal Sans (headings), uppercase monospace HUD eyebrows, pill chips. Colour is added for **meaning** (simulations, data, categories), never for decoration.

Contrast ratios are WCAG 2.x relative luminance, measured against `bg #0a0a0a` / `card #141416`. Colour-vision checks use Machado 2009 simulation in OKLab.

## 1. Surfaces and text

| Token             | Value                 | Use                              |
| ----------------- | --------------------- | -------------------------------- |
| `--bg`            | `#0a0a0a`             | page                             |
| `--surface-1`     | `#141416`             | cards                            |
| `--surface-2`     | `#1c1c1f`             | hover, popovers                  |
| `--surface-3`     | `#27272a`             | active, menus                    |
| `--border`        | white 8%              | dividers, card edges             |
| `--border-strong` | white 16% / `#3f3f46` | inputs, hover                    |
| `--border-ui`     | `#71717a` (4.10:1)    | UI boundaries that must meet 3:1 |
| `--text`          | `#FAFAFA` (18.97)     | headings, body                   |
| `--text-2`        | `#a1a1aa` (7.72)      | secondary                        |
| `--text-3`        | `#8b8b94` (5.86)      | meta, eyebrows                   |

Rules: never use pure `#fff` on `#000`. Show elevation by lightening the surface, not with shadows. zinc-500 (`#71717a`) is **not** allowed for text. Body text weight ≥ 400. Antialiased font smoothing.

## 2. Semantic accents (simulations, data, states)

All pass 4.5:1 as text on bg and card, so they also pass the 3:1 graphics threshold.

| Token            | Hex       | OKLCH           | bg / card     | Meaning                                                                           |
| ---------------- | --------- | --------------- | ------------- | --------------------------------------------------------------------------------- |
| `cyan`           | `#2DD4EF` | 80.1% 0.132 212 | 11.10 / 10.32 | primary subject, selection, ray, cursor, **focus ring**                           |
| `orange`         | `#FF9F43` | 78.5% 0.154 61  | 9.70 / 9.02   | energy, heat, impulse, moving thing, warnings                                     |
| `violet`         | `#B98CFF` | 73.0% 0.166 300 | 7.79 / 7.24   | secondary object, rotation, alternate axis                                        |
| `green`          | `#3EE09A` | 80.8% 0.166 160 | 11.63 / 10.81 | success, valid, grounded, goal, normals                                           |
| `yellow`         | `#F5D547` | 87.6% 0.157 96  | 13.66 / 12.70 | velocity, trajectory, highlighted path                                            |
| `pink`           | `#F383C4` | 75.3% 0.156 346 | 8.35 / 7.76   | acceleration, torque, tertiary object                                             |
| `red`            | `#F65A5A` | 67.4% 0.192 24  | 6.16 / 5.72   | force, error, penetration, contact                                                |
| `blue` (UI only) | `#5B9DFF` | 69.7% 0.160 258 | 7.27 / 6.76   | Systems category, links. **Not in sims** (collapses with violet under protanopia) |

Rules:

1. **Assignment order** for series: cyan → orange → violet → green → yellow → pink. Red is reserved for force, error and contact.
2. **Never use hue alone (WCAG 1.4.1).** Force = solid arrow, velocity = dashed, acceleration = double head. Primary = solid, secondary = outline/hatched. Use labels in readouts.
3. Don't separate **cyan/pink** or **orange/yellow** by colour alone in one view. Add a dash, shape or label.
4. **Formulas match visuals.** A variable gets the same colour in KaTeX (`\textcolor{...}`) as its vector in the scene.
5. Helpers/lines use unlit materials (`MeshBasicMaterial`/`LineBasicMaterial`), so the colours stay true. Lit meshes use the same hue.
6. Red/green min ΔE: deuteranopia 12.7, protanopia 27.4. Never pair them as the only signal anyway.

## 3. Category accents

Small doses only: eyebrow dot, 2px card top border, icon, active nav underline. Always next to the category name.

| Category             | Accent                                                     |
| -------------------- | ---------------------------------------------------------- |
| Three.js & Rendering | cyan                                                       |
| Mathematics          | violet                                                     |
| Game Feel            | pink                                                       |
| Systems              | blue                                                       |
| AI                   | green                                                      |
| Performance          | yellow                                                     |
| Physics              | orange                                                     |
| Animation (new)      | red-free choice: violet-pink mix `#E08CF0` (verify on add) |

Tints: chip fill `color-mix(in oklch, var(--cat) 12%, transparent)`, border 30%, text 100%.

## 4. Components

- **Card**: `surface-1`, white-8% border, 2px top border in the category colour at 60%. On hover: `surface-2`, border 16%, accent 100%, arrow moves 2px. One link per card (stretched link). Copy button above the overlay. No long description in grids: title, hook, level pips, poster.
- **Focus**: `outline: 2px solid var(--cyan); outline-offset: 2px` via `:focus-visible` (9.2:1). Never remove without a replacement. `scroll-padding-top` = header height (WCAG 2.4.11).
- **Buttons/chips**: primary = `#FAFAFA` fill with `#0a0a0a` text. Secondary = transparent with a 16% border. Active filter = category tint + ✓ icon. Min height 32px, target ≥ 24×24.
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
