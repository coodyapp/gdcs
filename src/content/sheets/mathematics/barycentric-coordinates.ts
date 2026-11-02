import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "barycentric-coordinates",
  category: "mathematics",
  subcategory: "vectors",
  title: "Barycentric Coordinates and UVs",
  hook: "three weights that say where you are in a triangle",
  summary:
    "Describe a point in a triangle with three weights that sum to 1. GPUs blend UVs, normals and colours with them, and raycast hits use them to find the UV.",
  level: "common",
  tags: [
    "barycentric",
    "UV",
    "interpolation",
    "point in triangle",
    "perspective correct",
    "raycast",
  ],
  updated: "2026-11-02",
  prompt:
    "Write a TypeScript module with no dependencies that works on plain number arrays of any dimension: `barycentric(p, a, b, c, out?)` solving p = u·a + v·b + w·c with u + v + w = 1 using only dot products of the edges b - a, c - a and p - a, returning (1, 0, 0) instead of NaN when the triangle has zero area (test the denominator against a small epsilon scaled by the squared edge lengths); `pointInTriangle(p, a, b, c, eps = 1e-9)` that is true when all weights are >= -eps and always false for a zero-area triangle; `interpolate(weights, a, b, c, out)` for vertex attributes; and `interpolatePerspective(weights, attr, clipW)` that blends attr/w and 1/w and divides. Write Vitest tests: corners give (1,0,0), (0,1,0), (0,0,1); the centroid gives thirds; weights always sum to 1 and rebuild p; weights match signed sub-triangle area ratios; a point past an edge has one negative weight; collinear and coincident corners stay finite; the screen midpoint of an edge with clip w of 1 and 3 yields an attribute 0.25 of the way along.",
  related: [
    "raycasting",
    "texture-atlas",
    "normals",
    "lerp-and-smoothstep",
    "dot-and-cross-product",
    "tangent-space",
    "camera-projection",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Any point in a triangle's plane can be written as a weighted mix of its three corners: `P = u·A + v·B + w·C`, with `u + v + w = 1`. Those weights are its **barycentric coordinates**. Each one is an area ratio: `u` is the area of the sub-triangle opposite A (P, B, C) divided by the whole triangle's area. As P slides toward A that opposite sub-triangle grows, so `u` climbs to 1 exactly at A.",
    "The same weights blend anything stored per vertex, which is [lerp](/mathematics/interpolation/lerp-and-smoothstep) extended to three inputs. The rasterizer computes them for every pixel and uses them to fill in vertex colours, [normals](/threejs/rendering/normals) and UVs. **UVs** are that mapping at work: each vertex stores a 2D location in a texture, usually 0 to 1 across the image, and the pixels in between sample whatever location the weights produce. A [texture atlas](/performance/gpu/texture-atlas) is the same idea with each mesh's UVs pointing into its own small rectangle of a shared image.",
    "The weights also give you a **point-in-triangle test**: P is inside when all three are >= 0. Past an edge, the weight of the corner opposite that edge goes negative, because the sub-triangle has flipped over. They can be solved with [dot products](/mathematics/vectors/dot-and-cross-product) alone, as the code below shows.",
    "Weights measured on screen are not the right weights in 3D, since far parts of a triangle are squeezed by perspective. **Perspective-correct interpolation** fixes this: `attr/w` and `1/w` (with w the vertex's clip-space w) vary linearly across the screen, so the GPU blends those two and divides. In Three.js, a [raycast](/threejs/rendering/raycasting) hit on a mesh hands you the results directly: `hit.uv`, `hit.normal` and `hit.barycoord`, the weights for the corners `hit.face.a`, `b` and `c`.",
  ],
  formulas: [
    {
      label: "A point as three weights",
      math: tex`P = \textcolor{#05df72}{u}\,A + \textcolor{#fdc700}{v}\,B + \textcolor{#ff6467}{w}\,C, \qquad \textcolor{#05df72}{u} + \textcolor{#fdc700}{v} + \textcolor{#ff6467}{w} = 1`,
    },
    {
      label: "Weights are area ratios",
      math: tex`\textcolor{#05df72}{u} = \frac{\operatorname{area}(P,B,C)}{\operatorname{area}(A,B,C)}, \quad \textcolor{#fdc700}{v} = \frac{\operatorname{area}(A,P,C)}{\operatorname{area}(A,B,C)}, \quad \textcolor{#ff6467}{w} = \frac{\operatorname{area}(A,B,P)}{\operatorname{area}(A,B,C)}`,
      note: "Signed areas: a point past an edge gets a negative ratio.",
    },
    {
      label: "Blending a vertex attribute",
      math: tex`\mathrm{uv}_P = \textcolor{#05df72}{u}\,\mathrm{uv}_A + \textcolor{#fdc700}{v}\,\mathrm{uv}_B + \textcolor{#ff6467}{w}\,\mathrm{uv}_C`,
    },
    {
      label: "Perspective-correct blend",
      math: tex`f_P = \frac{\textcolor{#05df72}{u}\,f_A / w_A + \textcolor{#fdc700}{v}\,f_B / w_B + \textcolor{#ff6467}{w}\,f_C / w_C}{\textcolor{#05df72}{u} / w_A + \textcolor{#fdc700}{v} / w_B + \textcolor{#ff6467}{w} / w_C}`,
      note: "u, v, w are screen-space weights. w_A, w_B, w_C are each vertex's clip-space w, a different w.",
    },
  ],
  rules: [
    "Solve two weights and get the third as `1 - v - w`, so the sum is always 1 up to rounding.",
    "Inside test on 32-bit floats: use `>= -1e-6` rather than `>= 0` for coordinates near 1, or points on a shared edge can miss both triangles.",
    "Check the denominator first. It is zero for a triangle with no area; `THREE.Triangle.getBarycoord` returns `null` in that case.",
    "Renormalize interpolated normals: a blend of unit vectors is shorter than 1, about 0.58 at worst for three perpendicular ones.",
    "UV (0, 0) is the bottom-left of an image in Three.js by default, because `texture.flipY` is true. glTF textures load with `flipY = false`, as that format's UVs start at the top-left.",
    "UVs outside 0 to 1 are legal. The default `ClampToEdgeWrapping` repeats the border pixel; set `RepeatWrapping` to tile.",
    "Use a `flat` varying in GLSL (ES 3.00) to switch interpolation off, for IDs and other values that must not blend.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Dot-product solve and inside test on Vector3 scratch objects:",
      code: `const e0 = new THREE.Vector3()
const e1 = new THREE.Vector3()
const e2 = new THREE.Vector3()

/** Writes (u, v, w) into out for P = uA + vB + wC. False if the triangle is flat. */
function solveBarycentric(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, out: THREE.Vector3) {
  e0.subVectors(b, a)
  e1.subVectors(c, a)
  e2.subVectors(p, a)
  const d00 = e0.dot(e0)
  const d01 = e0.dot(e1)
  const d11 = e1.dot(e1)
  const d20 = e2.dot(e0)
  const d21 = e2.dot(e1)
  const denom = d00 * d11 - d01 * d01
  if (denom <= 1e-12 * d00 * d11) return false
  const v = (d11 * d20 - d01 * d21) / denom
  const w = (d00 * d21 - d01 * d20) / denom
  out.set(1 - v - w, v, w)
  return true
}

const isInside = (b: THREE.Vector3, eps = 1e-6) => b.x >= -eps && b.y >= -eps && b.z >= -eps`,
    },
    {
      lang: "ts",
      caption:
        "From a raycast hit to a texture pixel and a blended vertex colour:",
      code: `const raycaster = new THREE.Raycaster()
const tint = new THREE.Vector3()

function pickTexel(pointer: THREE.Vector2, camera: THREE.Camera, mesh: THREE.Mesh, width: number, height: number) {
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObject(mesh)[0]
  if (!hit?.uv || !hit.face || !hit.barycoord) return null

  // UV to pixel: row 0 of an image is its top, while v = 0 is the bottom.
  const x = Math.floor(hit.uv.x * width)
  const y = Math.floor((1 - hit.uv.y) * height)

  // Any other attribute: blend the hit face's three corners with barycoord.
  const colors = mesh.geometry.attributes.color as THREE.BufferAttribute
  const { a, b, c } = hit.face
  THREE.Triangle.getInterpolatedAttribute(colors, a, b, c, hit.barycoord, tint)
  return { x, y, tint }
}`,
    },
  ],
  mistakes: [
    "Mixing conventions. Here, as in `hit.barycoord`, each weight belongs to the corner in the same position (u to A, v to B, w to C). Ray-triangle code often returns `u` for B and `v` for C, with the first corner getting `1 - u - v`.",
    "Linearly blending attributes with screen-space weights on a tilted triangle. Textures swim and bend along the triangle's diagonal; divide by w as above.",
    "Reading `hit.uv` as the sampled location on a texture with `repeat` or `offset` set. It is the raw mesh value; call `texture.transformUv(uv)` on a copy to apply them.",
    "Assuming every mesh has UVs. `hit.uv` is undefined when the geometry has no `uv` attribute, and `hit.barycoord` is `null` on line and point hits.",
    "Solving weights on a skinny triangle without first checking for zero area, which divides by nearly zero and returns huge or NaN weights.",
  ],
  reading: [
    {
      title:
        "Three.js docs — Triangle (getBarycoord, getInterpolatedAttribute)",
      url: "https://threejs.org/docs/#api/en/math/Triangle",
    },
    {
      title: "Three.js docs — Raycaster (intersection results)",
      url: "https://threejs.org/docs/#api/en/core/Raycaster",
    },
    {
      title: "MDN — Using textures in WebGL (texture coordinates)",
      url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL",
    },
  ],
  visual:
    "The fill blends the corner colours by the weights: green circle A (u), yellow square B (v), red triangle C (w), each corner mark filling up as its weight grows. White lines from the point split the triangle into three sub-triangles, stepped from dark grey to white by weight, and the sub-triangle opposite a corner carries that corner's weight. The white-rimmed dot shows the sampled colour; past an edge it becomes a hollow red ring and that row's bar flips left of its tick in red. The three bars at top right, marked with the same corner shapes, track u, v and w live. Turn the auto path off to set u and v by hand.",
}

export default sheet
