# Authoring a GDCS cheat sheet

Every sheet is **two files** named after its globally unique slug:

| File                                       | Purpose                                                            |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `src/content/sheets/<category>/<slug>.ts`  | Content (`Sheet` object, default export). Plain data, no React.    |
| `src/visuals/scenes/<category>/<slug>.tsx` | Interactive Three.js visual (`defineVisual(...)`, default export). |

Both are picked up automatically by `import.meta.glob`. Never edit a registry or another author's files.

Reference implementations to copy the shape of:

- `src/content/sheets/physics/projectile-motion.ts` + `src/visuals/scenes/physics/projectile-motion.tsx`
- `src/content/sheets/threejs/raycasting.ts` + `src/visuals/scenes/threejs/raycasting.tsx`

Types: `src/content/types.ts`. Visual kit: `src/visuals/kit.tsx` and `src/visuals/core.ts`.

## Content rules

- **All prose, code, prompts and visuals are original.** Write from your own knowledge and primary docs. Never copy text from other cheat-sheet sites.
- `summary`: **70–160 chars**. It is the meta description and card text.
- `title` ≤ 60 chars. `hook`: a short lowercase phrase, the "one-line idea".
- `what`: 2–4 paragraphs. Inline markup allowed: `` `code` ``, `**bold**`, `[label](/category/sub/slug)`. Internal links must be real sheet paths.
- `formulas`: use the tagged template `` tex`...` `` (import from `../../tex`). It is pre-rendered by KaTeX at build time and **invalid TeX fails the build**. Do not use `${}` inside it.
- `rules`: concrete numbers and starting values.
- `code`: 1–2 blocks. Prefer TypeScript + Three.js (`lang: "ts"`). Use `"pseudo"` for engine-neutral pseudocode and `"glsl"` for shaders. Keep each block under ~30 lines.
- `mistakes`: 3–5 bullets.
- `prompt`: a self-contained instruction for an AI coding assistant: stack (TypeScript/Three.js), inputs, exact behaviour, edge cases, a test to write. 120+ chars.
- `related`: slugs from the master list below only.
- `reading`: 1–3 reputable https links (official docs such as threejs.org, MDN, Khronos; Gaffer On Games, Red Blob Games, Box2D, Scratchapixel, GPU Gems, OpenStax). No other cheat-sheet sites.
- `visual`: 1–2 sentences telling the reader what each colour means and what to tweak.
- `updated: "2026-11-01"`.

## Design rules (docs/reference/design-system.md §2)

- The UI is black/white/grey. **Inside visuals, the only hues are green, yellow and red**, plus whites and greys. Use `palette.*` names, never raw hex: `subject` (white) main subject · `moving`/`energy` (yellow) moving thing · `velocity` (yellow, **dashed**) · `tertiary` (grey outline) secondary object · `accel` (light grey) · `success` (green) valid/goal/normals · `force`/`error` (red) force/error/contact.
- **Never rely on hue alone**: dashes, shapes, outline vs fill, labels.
- **Formulas match the visual**: `` tex`\textcolor{#fdc700}{v}` ``. Allowed hex: `#fafafa`, `#a3a3a3`, `#d4d4d4`, `#fdc700`, `#05df72`, `#ff6467`. Colour only the 1–3 variables shown in the visual.
- Ramps: dark grey → yellow → white, or green → yellow → red. Never a rainbow.
- The `visual` caption names each colour **and** its shape cue.

## Visual rules

- `defineVisual<V>({ params, camera, readout, Scene, orbit? })`. At most 4 params (range/toggle/select). Defaults must already show the concept clearly.
- Use `palette` colours only (`primary` cyan = main subject, `secondary` orange = moving thing/hit, `positive` green = OK/normal, `negative` red = bad/penetration, `warning` yellow = velocity/forces, `object` = solid props, `guide` = helpers).
- Values that change during the animation: `useLiveReadout(() => text)` updates the line under the controls (`readout(v)` only runs when a param changes).
- 3D scenes set `gridY` to the height of their ground, and the stage draws a faint horizontal grid there, aligned with the world axes. Rest the content on it, and keep the camera clearly above it. 2D scenes (flat diagrams, side-on or top-down views) leave `gridY` out and get no grid. Do not draw your own reference grid.
- Time: `useClock()` (ref, preferred) or `useAnimationTime()` (state). Numerical sims use `useFixedStep(step, hz)`. All of them respect pause/reset (`useVisual().resetKey`).
- Performance: no allocations inside `useFrame` (pre-allocate vectors with `useMemo`), keep < ~2k instances/particles, and use `<Line>` from drei for lines. Scenes must run at 60 fps on a laptop and look good in a **16:10 compact card with no controls** (the defaults are what cards show).
- Keep the subject within about 6 units of the origin, and pick a `camera.position`/`target` that frames it. Cards are not orbitable.
- Text labels: avoid drei `<Text>`/`<Html>` (heavy). Encode meaning with colour + the `visual` caption + `readout`.
- Put pure math/logic (easing functions, solvers, A*, PRNG…) in `src/lib/<topic>.ts` with a `*.test.ts` next to it when non-trivial. Visuals import from there.

## Verify (do not run `pnpm build`, which others are running)

```bash
pnpm exec tsc -b                          # types
pnpm exec vp check --fix                  # format + lint
pnpm exec vp test --run src/content       # content contract (your sheets must pass)
# visual check (dev server already running on :5199):
node $TOOLS/shot.mjs http://localhost:5199/<category>/<sub>/<slug> /tmp/x.png 1280 3000
```

Then look at the screenshot. There must be no console errors and the concept must be readable.

## Master sheet list (slug → category/subcategory)

threejs/rendering: raycasting, normals, tangent-space, camera-projection, level-of-detail, frustum-culling, fragment-shader, billboarding, z-fighting
mathematics/vectors: vectors, dot-and-cross-product, barycentric-coordinates · mathematics/trigonometry: trigonometry · mathematics/transforms: transforms-and-matrices, local-vs-world-space, euler-angles
mathematics/rotations: quaternions · mathematics/interpolation: easing, lerp-and-smoothstep, bezier-curves · mathematics/procedural: seeded-noise, probability-and-weighted-random
threejs/materials: reflection-and-refraction, pbr-materials · animation/kinematics: inverse-kinematics
game-feel/timing: delta-time, coyote-time, input-buffering, hit-stop, invincibility-frames
game-feel/motion: acceleration-and-friction, squash-and-stretch · game-feel/camera: camera-deadzone, screen-shake
systems/patterns: object-pooling, particle-system · systems/simulation: fixed-timestep · systems/collision: collision-detection, bounding-volumes, hitbox-hurtbox, tunneling
ai/navigation: a-star-pathfinding · ai/steering: steering-behaviors · ai/decision: finite-state-machine, behavior-trees, utility-ai
networking/fundamentals: latency-and-jitter · networking/netcode: client-side-prediction, snapshot-interpolation, rollback-netcode, lag-compensation, dead-reckoning, deterministic-lockstep, clock-synchronization, floating-point-determinism · networking/scaling: interest-management, state-sync-and-delta-compression, quantization, bandwidth-budgeting
performance/cpu: frame-budget, time-slicing · performance/gpu: draw-calls, overdraw, texture-atlas · performance/world: spatial-partitioning, chunk-streaming
physics/mechanics: rigid-body-dynamics, impulse-and-momentum, moment-of-inertia, projectile-motion, spring-mass-oscillator, damped-pendulum, keplers-laws, solar-system, balancing-torque, projectile-data-lab, sound-waves, buoyancy
physics/electromagnetism: electric-field-lines, charged-particle-motion, em-wave-propagation
physics/thermodynamics: heat-diffusion, ideal-gas, boltzmann-distribution
physics/quantum-mechanics: particle-in-box, quantum-tunneling, schrodinger-2d
physics/relativity: mass-effect, gravitational-waves, mercury-precession
