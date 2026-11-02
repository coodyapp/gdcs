# `<PoweredByCoody />`

The standard "Powered by Coody" mark with the brand glitch, shared by Coody projects.

**Portable:** React ≥ 18, one CSS file and the logo asset. No Tailwind and no other dependencies. Copy this folder into any project (Vite resolves the `.webp` import and the CSS import).

```tsx
import { PoweredByCoody } from "@/components/coody/powered-by"

<PoweredByCoody source="gdcs" />                 // caption + 28px mark, links to coody.app?utm_source=gdcs
<PoweredByCoody label="" height={20} />          // mark only
<PoweredByCoody align="end" label="Built by" />  // right-aligned, custom caption
```

Theme with CSS variables on a parent or `className`:
`--coody-pb-color` (default `currentColor`), `--coody-pb-muted` (caption), `--coody-pb-focus` (focus ring, default `#2dd4ef`).

Accessibility:

- The link's accessible name is "Powered by Coody". The images are decorative.
- The focus ring is 2px, offset 4px.
- With `prefers-reduced-motion`, the glitch is off. Hovering replays it.

The logo is white, so use it on dark surfaces. For light themes, add a dark logo variant.

# `<SiteCredits />`

The standard footer credits for Coody projects: "Built in" with the Brazilian flag, a quote, the year with coody.app, and Back to top.

**Portable:** React ≥ 18 and one CSS file. No Tailwind and no other dependencies. It inherits colour and font size from its parent.

```tsx
import { SiteCredits } from "@/components/coody/site-credits"

<SiteCredits />                                  // the defaults
<SiteCredits quote="" />                         // no quote
<SiteCredits owner="drive.coody.app" ownerHref="https://drive.coody.app" topTarget="content" />
```

Theme with CSS variables: `--coody-credits-hover`, `--coody-credits-focus`, `--coody-credits-gap`.

Back to top scrolls smoothly (instantly with reduced motion) and moves focus to `topTarget`, so it needs an element with that id and `tabIndex={-1}`.
