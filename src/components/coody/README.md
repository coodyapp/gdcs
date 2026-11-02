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
