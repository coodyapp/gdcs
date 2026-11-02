import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "reflection-and-refraction",
  category: "threejs",
  subcategory: "materials",
  title: "Reflection and Refraction",
  hook: "light splits at a surface: some bounces, the rest bends",
  summary:
    "Light hitting a surface partly reflects and partly bends through. Snell's law sets the bend, Fresnel the split; past the critical angle all of it reflects.",
  level: "core",
  tags: [
    "optics",
    "fresnel",
    "snell",
    "ior",
    "glsl",
    "total internal reflection",
  ],
  updated: "2026-11-01",
  prompt:
    "Write a GLSL fragment shader for a Three.js ShaderMaterial that renders a glass-like surface from a samplerCube environment. In view space compute the unit incident vector I = normalize(fragPos − cameraPos) and the unit normal N (flip N if dot(N, I) > 0, i.e. the ray is leaving the medium, and use eta = ior instead of 1/ior). Sample R = reflect(I, N) and T = refract(I, N, eta); when refract returns the zero vector (total internal reflection) use only the reflection. Blend with Schlick: F0 = ((1 − ior)/(1 + ior))², F = F0 + (1 − F0)(1 − cosθ)⁵ with cosθ = clamp(dot(−I, N), 0, 1). Expose ior (default 1.5) as a uniform. Also write a TypeScript reflect/refract pair and a unit test that refract matches Snell's law and returns null above the critical angle.",
  related: [
    "pbr-materials",
    "normals",
    "fragment-shader",
    "raycasting",
    "dot-and-cross-product",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "When a ray hits the boundary between two materials, it splits. The **reflected** ray leaves at the same angle it arrived, mirrored about the surface normal. The **refracted** (transmitted) ray continues into the second material, bent toward or away from the normal depending on the two **indices of refraction** (IOR): air 1.0, water 1.33, glass 1.5, diamond 2.42.",
    "**Snell's law** gives the bend angle. **Fresnel** gives the split: how much energy reflects versus transmits. Head-on, glass reflects only about 4%. At grazing angles almost everything reflects, which is why a lake mirrors the far shore but you can see the bottom at your feet. Schlick's approximation is the cheap formula every real-time renderer uses.",
    "Going from a dense medium into a lighter one (glass → air, water → air), there is a **critical angle**. Beyond it Snell's law has no solution, nothing transmits, and all light reflects: **total internal reflection** (TIR). It is how optical fibres work, and why you see a silvery ceiling when looking up from underwater.",
    "In shaders, GLSL's built-in `reflect(I, N)` and `refract(I, N, eta)` do the vector maths. Both expect unit vectors, with `I` pointing **toward** the surface. `refract` returns a zero vector on TIR. In Three.js, `MeshPhysicalMaterial` with `transmission` and `ior` handles this for you.",
  ],
  formulas: [
    {
      label: "Reflection vector",
      math: tex`\textcolor{#fdc700}{\vec R} = \textcolor{#fafafa}{\vec I} - 2(\textcolor{#05df72}{\hat n}\cdot\textcolor{#fafafa}{\vec I})\,\textcolor{#05df72}{\hat n}`,
    },
    {
      label: "Snell's law",
      math: tex`n_1 \sin \textcolor{#fafafa}{\theta_1} = n_2 \sin \textcolor{#a3a3a3}{\theta_2}`,
    },
    {
      label: "Critical angle (n₁ > n₂)",
      math: tex`\theta_c = \arcsin\!\left(\frac{n_2}{n_1}\right)`,
      note: "Glass → air: 41.8°. Water → air: 48.8°.",
    },
    {
      label: "Schlick's Fresnel approximation",
      math: tex`\textcolor{#fdc700}{F}(\theta) = F_0 + (1 - F_0)(1 - \cos\theta)^5, \quad F_0 = \left(\frac{n_1 - n_2}{n_1 + n_2}\right)^2`,
      note: "Use the angle on the less dense side; under TIR, F = 1.",
    },
  ],
  rules: [
    "F0 for common dielectrics: water 0.02, glass and plastic 0.04, diamond 0.17. Metals are 0.5–1.0 and tinted.",
    "Always normalize `I` and `N` before `reflect`/`refract`; GLSL does not do it for you.",
    "`eta` in `refract` is n₁/n₂: 1/1.5 ≈ 0.667 entering glass from air, 1.5 when leaving it.",
    "If `dot(N, I) > 0` the ray is exiting the object: flip `N` and invert `eta`.",
    "Energy is conserved: transmitted = 1 − F (ignoring absorption), so reflections and refractions must not both be at full strength.",
  ],
  code: [
    {
      lang: "glsl",
      caption: "Glass from an environment cube map, with Fresnel and TIR:",
      code: `uniform samplerCube envMap;
uniform float ior;              // e.g. 1.5
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
  vec3 I = normalize(vWorldPos - cameraPosition);
  vec3 N = normalize(vWorldNormal);
  float eta = 1.0 / ior;                       // air → glass
  if (dot(N, I) > 0.0) { N = -N; eta = ior; }  // leaving the glass

  vec3 R = reflect(I, N);
  vec3 T = refract(I, N, eta);                 // vec3(0) on TIR
  float f0 = pow((1.0 - ior) / (1.0 + ior), 2.0);
  float F = f0 + (1.0 - f0) * pow(1.0 - clamp(dot(-I, N), 0.0, 1.0), 5.0);
  if (dot(T, T) == 0.0) F = 1.0;               // total internal reflection

  vec3 col = mix(textureCube(envMap, T).rgb, textureCube(envMap, R).rgb, F);
  gl_FragColor = vec4(col, 1.0);
}`,
    },
    {
      lang: "ts",
      caption: "Snell's law and Schlick on the CPU:",
      code: `export function snell(theta1: number, n1: number, n2: number) {
  const s = (n1 / n2) * Math.sin(theta1)
  return Math.abs(s) > 1 ? null : Math.asin(s)   // null = total internal reflection
}

export function schlick(cosTheta: number, n1: number, n2: number) {
  const f0 = ((n1 - n2) / (n1 + n2)) ** 2
  return f0 + (1 - f0) * (1 - cosTheta) ** 5
}`,
    },
  ],
  mistakes: [
    "Passing the view direction (surface → camera) as `I`. `reflect` and `refract` want the incoming direction (camera → surface).",
    "Using `eta = ior` when entering glass. It is n₁/n₂, so entering from air it is `1/ior`.",
    "Ignoring the zero vector from `refract` and sampling the environment with it, which gives a black or garbage pixel.",
    "Constant reflection strength instead of Fresnel. Water and glass look flat without bright grazing-angle edges.",
  ],
  reading: [
    {
      title: "Scratchapixel — Reflection, refraction and Fresnel",
      url: "https://www.scratchapixel.com/lessons/3d-basic-rendering/introduction-to-shading/reflection-refraction-fresnel.html",
    },
    {
      title: "OpenStax University Physics — Total internal reflection",
      url: "https://openstax.org/books/university-physics-volume-3/pages/1-4-total-internal-reflection",
    },
    {
      title: "Three.js docs — MeshPhysicalMaterial",
      url: "https://threejs.org/docs/#api/en/materials/MeshPhysicalMaterial",
    },
  ],
  visual:
    "The solid white arrow is the incoming ray and the green dashed line is the surface normal. The yellow dashed ray is the reflection and the solid grey ray is the refraction; each is brighter and thicker the more energy (Fresnel) it carries. Grey dashed lines mark the critical angle: sweep past it and the grey ray vanishes (total internal reflection). Swap the IORs to go from a light into a dense medium.",
}

export default sheet
