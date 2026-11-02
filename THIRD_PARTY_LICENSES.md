# Third-party licenses and references

## Software

| Package                                           | License     |
| ------------------------------------------------- | ----------- |
| react, react-dom                                  | MIT         |
| react-router-dom                                  | MIT         |
| three                                             | MIT         |
| @react-three/fiber, @react-three/drei             | MIT         |
| katex (including KaTeX fonts)                     | MIT         |
| lucide-react                                      | ISC         |
| tailwindcss, tw-animate-css, clsx, tailwind-merge | MIT         |
| class-variance-authority                          | Apache-2.0  |
| @fontsource-variable/inter (Inter)                | SIL OFL 1.1 |
| Cal Sans                                          | SIL OFL 1.1 |

Full license texts: `public/third-party-licenses.txt`, served at https://gdcs.coody.app/third-party-licenses.txt. `pnpm notices` rebuilds it from `node_modules` and `licenses/`.

### Cloudflare security-audit skill

`.claude/skills/security-audit/` comes from https://github.com/cloudflare/security-audit-skill (commit c1c8a8c), MIT. Its license is in that folder. It is a development tool and is not part of the website.

### React Bits

`src/components/ghost-fibers.tsx` comes from [React Bits](https://reactbits.dev), used as part of this website under its MIT + Commons Clause license: https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md. Copyright (c) 2026 David Haz. The component may not be sold, sublicensed or redistributed on its own. This repository's own license does not apply to this file.

## Content

GDCS explanations, code samples, prompts and visualizations were written for this project, with AI assistance. Their license is in `LICENSE.md`. The physics simulations come from Coody's own physics.coody.app project.

These references informed the content and are linked from the relevant sheets under "Further reading". No text is reproduced from them.

- Three.js documentation and manual (threejs.org)
- Khronos Group: glTF PBR and OpenGL/WebGL specifications
- MDN Web Docs
- Gaffer On Games (Glenn Fiedler): fixed timesteps, integration, networked physics
- Red Blob Games (Amit Patel): pathfinding, grids, noise
- Box2D documentation (Erin Catto): collision and rigid-body dynamics
- Scratchapixel: rendering mathematics
- NVIDIA GPU Gems
- Craig Reynolds: steering behaviors for autonomous characters
- OpenStax University Physics
- Game Programming Patterns (Robert Nystrom)
- GDC Vault talks linked from individual sheets

## Additional software and references (v1.0.0)

| Package                                                | License |
| ------------------------------------------------------ | ------- |
| @base-ui/react                                         | MIT     |
| shadcn/ui components (copied into `src/components/ui`) | MIT     |
| shiki                                                  | MIT     |

- Sebastian Lague, Field-of-View project (https://github.com/SebLague/Field-of-View): conceptual reference for the field-of-view sheets. No code is reproduced.
