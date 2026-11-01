import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "fragment-shader",
  category: "threejs",
  subcategory: "rendering",
  title: "Fragment Shaders",
  hook: "a tiny program that runs once for every pixel",
  summary:
    "A fragment shader computes the colour of each pixel a triangle covers. Feed it UVs, normals and a time uniform and it paints anything.",
  level: "common",
  tags: ["shader", "glsl", "shadermaterial", "uniforms", "gpu"],
  updated: "2026-11-01",
  prompt:
    "Create a reusable Three.js ShaderMaterial in TypeScript called `makeEffectMaterial(effect: 'ripples' | 'plasma' | 'dissolve')`. Uniforms: uTime (seconds), uSpeed, uScale and uColor (THREE.Color). Write a minimal vertex shader that passes vUv, and one fragment shader with a `#define EFFECT` switch chosen at creation time (no runtime branching). Ripples: concentric sin rings from the centre; plasma: sum of three sin waves over uv and time; dissolve: hashed cell noise with discard and an orange edge band using smoothstep. Wrap time with mod to keep precision. Provide an `update(material, elapsed)` function that only writes uTime. Add a test that the generated shader source contains the chosen define and that update does not create new objects.",
  related: ["normals", "overdraw", "billboarding"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "After the vertex shader positions a triangle, the GPU rasterizes it into **fragments**, one per covered pixel (or per sample with MSAA). The fragment shader runs for each of them in parallel and outputs a colour. It cannot see its neighbours or keep state between frames; everything it knows comes from **varyings** (values interpolated from the vertices, like UVs and normals), **uniforms** (the same for every pixel in a draw, like time or a colour) and textures.",
    "In Three.js, `ShaderMaterial` lets you write both shaders in GLSL while Three.js injects the common matrices and attributes (`position`, `uv`, `normal`, `projectionMatrix`...). `RawShaderMaterial` injects nothing. To animate, update a uniform each frame, e.g. `material.uniforms.uTime.value = clock.elapsedTime`, never recompile the shader.",
    "The building blocks are small: `fract` for repetition, `step`/`smoothstep` for edges, `mix` for blending, `length(uv - 0.5)` for circles, `sin(x + uTime)` for motion and a hash or noise function for organic variation. A `discard` drops the fragment entirely, which is how dissolve and cut-out effects work.",
    "Cost scales with **pixels**, not objects: a full-screen effect at 1080p runs about two million times per frame. Keep loops short, avoid dependent texture reads where possible, and watch [overdraw](/performance/gpu/overdraw) from stacked transparent quads.",
  ],
  formulas: [
    {
      label: "Smooth edge",
      math: tex`\operatorname{smoothstep}(e_0, e_1, x) = t^2(3 - 2t),\; t = \operatorname{clamp}\!\left(\tfrac{x - e_0}{e_1 - e_0}, 0, 1\right)`,
    },
    {
      label: "Ripples",
      math: tex`c = \tfrac12 + \tfrac12\sin\!\big(k\,\lVert uv - \tfrac12\rVert - \omega t\big)`,
      note: "k sets ring density, ω the speed. Subtracting ωt moves rings outward.",
    },
    {
      label: "Fragment count",
      math: tex`N \approx W \cdot H \cdot \text{overdraw}`,
    },
  ],
  rules: [
    "Name uniforms `uSomething`, varyings `vSomething`; it saves hours of confusion.",
    "Pass `uTime` in seconds and wrap it (`mod(uTime, 1000.0)`) to keep `sin` precise on mobile.",
    "Use `smoothstep` with a width of `fwidth(x)` for edges that stay crisp at any zoom.",
    "Start with `precision highp float;` (Three.js adds it); mediump banding shows on large UV ranges.",
    "Output linear colour and let the renderer convert, or include `<colorspace_fragment>` in custom shaders.",
  ],
  code: [
    {
      lang: "ts",
      caption: "A plane with an animated shader:",
      code: `const material = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0x38bdf8) },
  },
  vertexShader: /* glsl */ \`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }\`,
  fragmentShader: /* glsl */ \`
    uniform float uTime;
    uniform vec3 uColor;
    varying vec2 vUv;
    void main() {
      float d = length(vUv - 0.5);
      float rings = 0.5 + 0.5 * sin(d * 40.0 - uTime * 4.0);
      gl_FragColor = vec4(uColor * rings, 1.0);
    }\`,
})
const plane = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), material)
renderer.setAnimationLoop((t) => {
  material.uniforms.uTime.value = t / 1000
  renderer.render(scene, camera)
})`,
    },
    {
      lang: "glsl",
      caption:
        "Dissolve: hash noise against a moving threshold, with a glowing edge.",
      code: `uniform float uTime;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  float n = hash(floor(vUv * 48.0));
  float cut = 0.5 + 0.5 * sin(uTime);           // 0..1
  if (n < cut) discard;                          // dissolved
  float edge = smoothstep(cut + 0.08, cut, n);   // 1 near the cut
  gl_FragColor = vec4(mix(vec3(0.6), vec3(1.0, 0.5, 0.1), edge), 1.0);
}`,
    },
  ],
  mistakes: [
    "Creating a new `ShaderMaterial` (and a recompile) to change a value instead of updating a uniform.",
    "Integer literals in GLSL ES: `1` is not `1.0`, and mixing them fails to compile.",
    "Branching per pixel on data that varies wildly; both branches may run. Prefer `mix` and `step`.",
    "Forgetting `transparent: true` when writing alpha < 1, so the alpha is ignored.",
    "Testing only on a desktop GPU; mobile precision and fill rate are far lower.",
  ],
  reading: [
    {
      title: "Three.js docs — ShaderMaterial",
      url: "https://threejs.org/docs/#api/en/materials/ShaderMaterial",
    },
    {
      title: "Khronos — GLSL ES 3.00 specification (PDF)",
      url: "https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf",
    },
  ],
  visual:
    "One plane, one ShaderMaterial, three fragment programs: every pixel you see is computed from its UV and the uTime uniform. Switch the effect, change the speed (it only scales the uniform), and raise the scale to see how cheap repetition is with fract and sin.",
}

export default sheet
