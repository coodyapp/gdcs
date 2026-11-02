import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "tangent-space",
  category: "threejs",
  subcategory: "rendering",
  title: "Tangent Space and the TBN Basis",
  hook: "a little frame at every point that lets normal maps travel",
  summary:
    "Tangent follows +U, bitangent follows +V, normal points out. The [T B N] matrix turns a normal-map sample into a world normal, whatever the mesh is doing.",
  level: "common",
  tags: ["tangent", "bitangent", "tbn", "normal map", "handedness", "uv"],
  updated: "2026-11-02",
  prompt:
    "In TypeScript, write `triangleTangents(p0, p1, p2, uv0, uv1, uv2)` that returns unit tangent and bitangent vectors by solving E1 = du1*T + dv1*B and E2 = du2*T + dv2*B, returning null when the UV determinant is near zero. Add `orthogonalize(t, n)` (Gram-Schmidt), `handedness(n, t, b)` returning -1 when dot(cross(n, t), b) < 0 and +1 otherwise, and `tangentToWorld(sample, t, b, n)` returning the normalized x*T + y*B + z*N. Use plain [x, y, z] tuples. Add a Vitest suite: a unit triangle with matching UVs gives T = +X and B = +Y; mirroring U gives handedness -1 and matches the `tangent` attribute written by Three.js BufferGeometry.computeTangents() on the same indexed triangle; frames from a skewed triangle and a tilted normal are orthonormal to 1e-6; the sample (0, 0, 1) always returns N.",
  related: [
    "normals",
    "pbr-materials",
    "dot-and-cross-product",
    "transforms-and-matrices",
    "fragment-shader",
    "barycentric-coordinates",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    'A normal map stores directions, but directions relative to what? If it stored world-space vectors, rotating the mesh would leave the lighting behind, and the map would fit only one object. So it stores them relative to the surface: `(0, 0, 1)` means "straight out" wherever the texel lands. Each surface point needs its own local axes to make sense of that, and that set of axes is **tangent space**.',
    "The axes come from the UVs and the [normal](/threejs/rendering/normals). The **tangent** T points where U increases, the **bitangent** B points where V increases, and N points out. Sample the map, turn `rgb` into `rgb * 2 - 1`, and the matrix `[T B N]` gives a direction in whichever space T, B and N are in. Rotate the mesh and T, B and N turn with it, so the detail stays attached. The same map can tile, go on another mesh, or sit on a skinned character.",
    "T and B of a triangle come from its edges and UV deltas: two edge equations with two unknowns. Per-vertex tangents average those results, so they drift off perpendicular to the smooth normal. **Gram-Schmidt** fixes T, subtracting its component along N with a [dot product](/mathematics/vectors/dot-and-cross-product), then B is rebuilt as a cross product.",
    "That cross product only ever produces one handedness, but mirrored UVs (a character's left arm reusing the right arm's texels) need the other. So tangents are stored as a `vec4`, and `tangent.w` is +1 or -1: `B = w * cross(N, T)`. In Three.js, `BufferGeometry.computeTangents()` writes exactly this attribute. It needs an **index** plus `position`, `normal` and `uv`, and `MeshStandardMaterial` uses the attribute as soon as you set a `normalMap`.",
  ],
  formulas: [
    {
      label: "Edges in terms of T and B",
      math: tex`E_1 = \Delta u_1\,\textcolor{#fafafa}{T} + \Delta v_1\,\textcolor{#fdc700}{B}, \quad E_2 = \Delta u_2\,\textcolor{#fafafa}{T} + \Delta v_2\,\textcolor{#fdc700}{B}`,
      note: "E1 = P1 - P0 and E2 = P2 - P0; the deltas are the matching UV differences.",
    },
    {
      label: "Solved for T and B",
      math: tex`\textcolor{#fafafa}{T} = \frac{\Delta v_2 E_1 - \Delta v_1 E_2}{d}, \quad \textcolor{#fdc700}{B} = \frac{\Delta u_1 E_2 - \Delta u_2 E_1}{d}, \quad d = \Delta u_1 \Delta v_2 - \Delta u_2 \Delta v_1`,
      note: "d = 0 means the triangle has no area in UV space, so skip it. Normalize both results.",
    },
    {
      label: "Gram-Schmidt",
      math: tex`\textcolor{#fafafa}{T'} = \operatorname{normalize}\big(\textcolor{#fafafa}{T} - \textcolor{#05df72}{N}\,(\textcolor{#05df72}{N}\cdot\textcolor{#fafafa}{T})\big)`,
    },
    {
      label: "Handedness",
      math: tex`w = \operatorname{sign}\big((\textcolor{#05df72}{N}\times\textcolor{#fafafa}{T'})\cdot\textcolor{#fdc700}{B}\big), \quad \textcolor{#fdc700}{B'} = w\,(\textcolor{#05df72}{N}\times\textcolor{#fafafa}{T'})`,
      note: "w = -1 on mirrored UVs. Only T, w and N need storing.",
    },
    {
      label: "Sample to world",
      math: tex`s = 2\,\text{rgb} - 1, \quad \textcolor{#ff6467}{n} = \operatorname{normalize}(s_x\textcolor{#fafafa}{T} + s_y\textcolor{#fdc700}{B} + s_z\textcolor{#05df72}{N})`,
      note: "For an orthonormal frame the inverse is the transpose: dot the vector with T, B and N to go back.",
    },
  ],
  rules: [
    "A flat texel is about `(128, 128, 255)`: it decodes to roughly `(0, 0, 1)`, so the lit normal is N.",
    "Load normal maps as data, with `colorSpace = THREE.NoColorSpace`. Decoding them as sRGB skews every direction.",
    "Three.js expects +Y (green up) maps. For a -Y map, set `material.normalScale.y = -1`.",
    "Start `normalScale` at `(1, 1)`. Values past about 2 look noisy and tilt normals away from the viewer.",
    "Without a `tangent` attribute, Three.js derives the frame from screen-space derivatives, which works but has faceted frames and can differ from the baker's result.",
    "Re-normalize T and N in the fragment shader: interpolated unit vectors get shorter.",
  ],
  code: [
    {
      lang: "ts",
      caption:
        "Three.js setup, and what the tangent calculation does per triangle.",
      code: `const geometry = new THREE.TorusGeometry(1, 0.35, 32, 96) // indexed, has normal + uv
geometry.computeTangents() // adds vec4 "tangent": xyz plus w = handedness

const normalMap = new THREE.TextureLoader().load("/textures/stone_normal.png")
normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping
const material = new THREE.MeshStandardMaterial({
  normalMap,
  normalScale: new THREE.Vector2(1, 1),
})
scene.add(new THREE.Mesh(geometry, material))

// Non-indexed geometry (IcosahedronGeometry, for one) must be welded first:
// const indexed = BufferGeometryUtils.mergeVertices(geometry)

const e1 = new THREE.Vector3(), e2 = new THREE.Vector3()
function triangleTangent(
  p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3,
  uv0: THREE.Vector2, uv1: THREE.Vector2, uv2: THREE.Vector2,
  outT: THREE.Vector3, outB: THREE.Vector3,
) {
  e1.subVectors(p1, p0); e2.subVectors(p2, p0)
  const du1 = uv1.x - uv0.x, dv1 = uv1.y - uv0.y
  const du2 = uv2.x - uv0.x, dv2 = uv2.y - uv0.y
  const d = du1 * dv2 - du2 * dv1
  if (Math.abs(d) < 1e-12) return false // no area in UV space
  outT.copy(e1).multiplyScalar(dv2).addScaledVector(e2, -dv1).divideScalar(d).normalize()
  outB.copy(e2).multiplyScalar(du1).addScaledVector(e1, -du2).divideScalar(d).normalize()
  return true
}`,
    },
    {
      lang: "glsl",
      caption:
        "The same thing by hand in a ShaderMaterial (uniform scale assumed).",
      code: `// Vertex
attribute vec4 tangent; // ShaderMaterial does not declare this one for you
varying vec2 vUv; varying vec3 vN; varying vec3 vT; varying float vW;
void main() {
  vUv = uv;
  vN = mat3(modelMatrix) * normal;
  vT = mat3(modelMatrix) * tangent.xyz;
  vW = tangent.w;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}

// Fragment
uniform sampler2D map; // the normal map
varying vec2 vUv; varying vec3 vN; varying vec3 vT; varying float vW;
void main() {
  vec3 N = normalize(vN);
  vec3 T = normalize(vT - N * dot(N, vT)); // Gram-Schmidt
  vec3 B = cross(N, T) * vW;               // handedness
  vec3 s = texture2D(map, vUv).rgb * 2.0 - 1.0;
  vec3 worldNormal = normalize(mat3(T, B, N) * s);
  gl_FragColor = vec4(worldNormal * 0.5 + 0.5, 1.0); // debug view
}`,
    },
  ],
  mistakes: [
    "Calling `computeTangents()` on non-indexed geometry, or before normals and UVs exist. It logs an error, adds nothing, and the material falls back to derivatives. Run `mergeVertices` or `computeVertexNormals` first.",
    "Dropping `tangent.w` and always using `cross(N, T)`. Mirrored islands then light backwards, with bumps turning into dents.",
    "Editing positions or normals and keeping the old tangents. Recompute them whenever the surface or its UVs change.",
    "Transforming T with the normal matrix. T lies along the surface, so it takes the model matrix, while N takes the inverse transpose.",
    "Baking a map against one tangent basis and rendering with another, which shows up as seams and pinched shading on low-poly meshes. Match the baker; `BufferGeometryUtils.computeMikkTSpaceTangents` covers bakers using MikkTSpace.",
  ],
  reading: [
    {
      title: "Three.js docs — BufferGeometry.computeTangents",
      url: "https://threejs.org/docs/#api/en/core/BufferGeometry.computeTangents",
    },
    {
      title: "Three.js docs — MeshStandardMaterial.normalMap",
      url: "https://threejs.org/docs/#api/en/materials/MeshStandardMaterial.normalMap",
    },
    {
      title: "Khronos — glTF 2.0 specification (tangent-space definition)",
      url: "https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html",
    },
  ],
  visual:
    "A smooth curved patch with a grid of frames: T is a solid white line along +U, B a dashed yellow line along +V, N a short solid green line, and the perturbed normal a long, thicker red line. Turn the normal map off and the detail vanishes because the geometry never changed; raise the strength and the red lines lean further from the green ones.",
}

export default sheet
