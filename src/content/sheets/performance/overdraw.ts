import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "overdraw",
  category: "performance",
  subcategory: "gpu",
  title: "Overdraw",
  hook: "every layer on a pixel is paid for again",
  summary:
    "Overdraw is shading the same pixel more than once. Stacked transparent particles and big quads multiply fill cost; trim sprites and limit layers.",
  level: "common",
  tags: [
    "fill rate",
    "transparency",
    "particles",
    "fragment shader",
    "blending",
  ],
  updated: "2026-11-02",
  prompt:
    "Add an overdraw debug mode to my TypeScript + Three.js game. On a key toggle, render the scene into a WebGLRenderTarget with scene.overrideMaterial set to an additive ShaderMaterial that writes 1/32 per fragment (depthTest off), then draw a full-screen quad that maps layer count to a heat ramp (0 black, 1 grey, 2 green, 3–4 yellow, 5–7 hatched yellow, 8+ red). Read the target back with readRenderTargetPixels at a 64×64 downsample to report average and max overdraw in the HUD. Restore the original materials when toggled off. Write a test that renders two full-screen quads and checks the average is 2.",
  related: ["draw-calls", "texture-atlas", "frame-budget"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "The GPU runs the fragment shader for every pixel each triangle covers. When several surfaces cover the same pixel, it pays that cost again for each layer: that is **overdraw**. A frame with an average overdraw of 3 shades three times as many fragments as the screen has pixels.",
    "Opaque geometry is mostly protected by the depth buffer: draw front to back (Three.js sorts opaque objects that way) and hidden fragments are rejected by early depth testing before shading. **Transparent** surfaces can't use that trick. They must be blended back to front, every layer is shaded, and they usually don't write depth. Smoke, fire, foliage cards, UI panels and light glows stack up fast.",
    "Fill cost scales with **screen area**, not object count. One full-screen particle costs as much as millions of tiny ones, and a few large soft particles near the camera can cost more than the rest of the frame. It gets worse at high resolution and device pixel ratio, so phones with 3× screens suffer most.",
    "Fixes: fewer and smaller layers, sprite geometry trimmed to the visible shape instead of a full square, lower-resolution offscreen rendering for particles, `alphaTest` or cut-out materials instead of blending where acceptable, and a cap on how close particles may get to the camera. Fewer layers also helps [draw calls](/performance/gpu/draw-calls) and the [frame budget](/performance/cpu/frame-budget).",
  ],
  formulas: [
    {
      label: "Average overdraw",
      math: tex`\bar{o} = \frac{\text{fragments shaded}}{\text{pixels on screen}}`,
    },
    {
      label: "Fill cost",
      math: tex`T_{\text{fill}} \propto W \cdot H \cdot \text{dpr}^2 \cdot \bar{o} \cdot c_{\text{frag}}`,
      note: "Doubling device pixel ratio quadruples fill cost.",
    },
  ],
  rules: [
    "Keep average overdraw below ~2–3 and hot spots below ~8 layers on mobile.",
    "Trim particle sprites to a 6–8 sided polygon around the opaque area: this often removes 30–50% of fragments.",
    "Cap `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`.",
    "Fade out and cull particles that get within ~1 unit of the camera, where one quad can fill the screen.",
    "Use `depthWrite: false` for blended particles but keep `depthTest: true`, so opaque geometry still hides them.",
  ],
  code: [
    {
      lang: "ts",
      caption:
        "Overdraw debug view: every fragment adds 1/32 to a red channel.",
      code: `const overdrawMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthTest: false,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */ \`
    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }\`,
  fragmentShader: /* glsl */ \`
    void main() { gl_FragColor = vec4(1.0 / 32.0, 0.0, 0.0, 1.0); }\`,
})

// Debug toggle: render the scene with every material replaced.
scene.overrideMaterial = showOverdraw ? overdrawMaterial : null
// Brightness = layers; red 0.25 means 8 fragments shaded on that pixel.`,
    },
  ],
  mistakes: [
    "Counting particles instead of their screen coverage.",
    "Using full square quads for round, soft sprites, so the transparent corners are shaded for nothing.",
    "Leaving `transparent: true` on materials that are actually opaque, which turns off front-to-back sorting and early depth rejection.",
    "Stacking several full-screen post-processing passes or UI panels without counting them as layers.",
  ],
  reading: [
    {
      title: "Three.js docs — Material (transparent, depthWrite, blending)",
      url: "https://threejs.org/docs/#api/en/materials/Material",
    },
    {
      title: "Khronos OpenGL wiki — Early fragment test",
      url: "https://www.khronos.org/opengl/wiki/Early_Fragment_Test",
    },
    {
      title: "GPU Gems 3 — High-speed, off-screen particles",
      url: "https://developer.nvidia.com/gpugems/gpugems3/part-iv-image-effects/chapter-23-high-speed-screen-particles",
    },
  ],
  visual:
    "A heat map of a smoke column: each pixel's colour is how many particle quads were shaded there (white 1, green 2, yellow 3–4, yellow with diagonal hatching 5–7, red with cross-hatching 8+). Add particles or make them bigger to watch it turn red, and trim the corners to see the cost drop.",
}

export default sheet
