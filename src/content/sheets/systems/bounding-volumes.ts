import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "bounding-volumes",
  category: "systems",
  subcategory: "collision",
  title: "Bounding Volumes",
  hook: "wrap a complex mesh in a cheap shape and reject early",
  summary:
    "AABB, OBB and bounding sphere: a simple shape around a complex mesh for fast rejection, trading tightness against test cost and rotation update cost.",
  level: "core",
  tags: [
    "aabb",
    "obb",
    "bounding sphere",
    "broad phase",
    "collision",
    "culling",
  ],
  updated: "2026-11-02",
  prompt:
    "Write a TypeScript Three.js module that keeps a world-space AABB and bounding sphere for each moving mesh without allocating per frame. Compute the local Box3 and Sphere once from the geometry. Each frame after updateMatrixWorld, re-fit the world AABB from the local box with the abs-matrix (Arvo) method, never from last frame's world box, and update the sphere with Sphere.applyMatrix4 so non-uniform scale stays conservative. Expose mayOverlap(a, b): a squared-distance sphere test first, then a per-axis AABB test, returning true only as a 'maybe' for the exact narrow phase. Write tests: the re-fit equals Box3.applyMatrix4 for random rotation, translation and scale; repeated re-fits at a fixed rotation do not grow; touching volumes count as overlapping.",
  related: [
    "collision-detection",
    "frustum-culling",
    "spatial-partitioning",
    "hitbox-hurtbox",
    "transforms-and-matrices",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A character mesh may have 50,000 triangles, and testing them against anything is far too slow to do for every pair of objects. A **bounding volume** is a simple shape that fully encloses the mesh. If two volumes do not overlap, the meshes inside cannot touch, so one cheap test throws out all that work. An overlap only means **maybe**: it sends the pair on to a more exact test.",
    "Three shapes cover most needs. A **sphere** is a centre and a radius: the cheapest test, unaffected by rotation, but usually the loosest. An **AABB** (axis-aligned bounding box) stays aligned to the world axes: its test is a few comparisons, but it must be re-fitted when the object rotates, and it grows and shrinks as it does. An **OBB** (oriented bounding box) rotates with the object and stays tight, but its test is a separating-axis check of up to 15 axes.",
    "The trade is **tightness** against **test cost** against **update cost**. Empty space inside a volume produces false positives, and each one costs a trip to the expensive test. So a tighter volume can pay for a dearer test on long, thin or rotating objects, while round or small objects are fine with a sphere. A common pipeline chains them: sphere, then AABB, then OBB or mesh.",
    "The same volumes drive [frustum culling](/threejs/rendering/frustum-culling), and they are what [spatial partitioning](/performance/world/spatial-partitioning) structures bin to find candidate pairs. In Three.js, `Box3` and `Sphere` are built in, and `OBB` lives in `three/addons/math/OBB.js`.",
  ],
  formulas: [
    {
      label: "AABB overlap, per axis",
      math: tex`\textcolor{#05df72}{a}_{\min,i} \le \textcolor{#fdc700}{b}_{\max,i} \;\land\; \textcolor{#fdc700}{b}_{\min,i} \le \textcolor{#05df72}{a}_{\max,i} \quad \forall i \in \{x,y,z\}`,
      note: "One axis without overlap proves the boxes are apart, so exit early.",
    },
    {
      label: "Re-fit an AABB from a rotated local box (Arvo)",
      math: tex`c' = R\,c + t, \qquad \textcolor{#05df72}{e'_i} = \sum_{j} \lvert R_{ij} \rvert \, h_j`,
      note: "c and h are the local centre and half extents, R the rotation (or rotation and scale), t the translation.",
    },
    {
      label: "Sphere overlap",
      math: tex`\lVert \textcolor{#fdc700}{c_b} - \textcolor{#05df72}{c_a} \rVert^2 \le (r_a + r_b)^2`,
      note: "Comparing squares avoids the square root. Square the sum of the radii, not each radius.",
    },
    {
      label: "Empty space (tightness)",
      math: tex`\text{empty} = 1 - \frac{V_{\text{object}}}{V_{\text{volume}}}`,
    },
  ],
  rules: [
    "Sphere: 1 squared-distance check, and rotation never changes it. Good first filter for round or small objects.",
    "AABB: up to 6 comparisons per test, plus about 18 multiplies to re-fit from a local box when rotated. Static objects can skip the re-fit entirely.",
    "OBB: up to 15 separating axes per test, and updating it is only copying the object's transform. Use it for long, thin rotating things such as swords, vehicles and bridges.",
    "A long object's AABB can swing several times in volume as it spins: the hammer in the visual goes from 4.7 to 36 u³, or 69% to 96% empty. If that hurts rejection, move up to an OBB.",
    "Pad a volume by the distance its object can travel between updates (a fat AABB), so it can be refreshed less often without missing a hit.",
  ],
  code: [
    {
      lang: "ts",
      caption:
        "Re-fit a world AABB from the local box. The original form of Arvo's method, which also handles scale:",
      code: `function refitAabb(local: THREE.Box3, m: THREE.Matrix4, out: THREE.Box3) {
  const e = m.elements // column-major: e[col * 4 + row]
  for (let i = 0; i < 3; i++) {
    let min = e[12 + i] // start from the translation
    let max = e[12 + i]
    for (let j = 0; j < 3; j++) {
      const a = e[j * 4 + i] * local.min.getComponent(j)
      const b = e[j * 4 + i] * local.max.getComponent(j)
      min += Math.min(a, b)
      max += Math.max(a, b)
    }
    out.min.setComponent(i, min)
    out.max.setComponent(i, max)
  }
  return out
}`,
    },
    {
      lang: "ts",
      caption: "Cheapest test first, and an overlap is only a maybe:",
      code: `function overlapAabb(a: THREE.Box3, b: THREE.Box3) {
  return (
    a.min.x <= b.max.x && b.min.x <= a.max.x &&
    a.min.y <= b.max.y && b.min.y <= a.max.y &&
    a.min.z <= b.max.z && b.min.z <= a.max.z
  )
}

function overlapSphere(a: THREE.Sphere, b: THREE.Sphere) {
  const r = a.radius + b.radius
  return a.center.distanceToSquared(b.center) <= r * r
}

interface Bounds { sphere: THREE.Sphere; box: THREE.Box3 }

const maybeTouching = (a: Bounds, b: Bounds) =>
  overlapSphere(a.sphere, b.sphere) && overlapAabb(a.box, b.box)`,
    },
  ],
  mistakes: [
    "Re-fitting from last frame's world AABB. The error compounds, and within seconds the box wraps far more than the object. Always start from the constant local box.",
    "Writing the sphere test as `d² <= ra² + rb²`. The right side must be `(ra + rb)²`, or close pairs get missed.",
    "Treating an overlap as a hit. A volume overlap is a maybe, so gameplay reacting to it will register hits in empty corners.",
    "Skipping the 9 edge cross-product axes in an OBB test. The 6 face axes alone report false overlaps for boxes that cross edge to edge.",
    "Stale bounds. Three.js caches geometry bounds until you recompute them, so edited vertices leave them out of date, and geometry bounds ignore skinning. Animated characters need a padded volume or `SkinnedMesh.computeBoundingBox()`.",
  ],
  reading: [
    {
      title: "Three.js docs: Box3",
      url: "https://threejs.org/docs/#api/en/math/Box3",
    },
    {
      title: "MDN: 3D collision detection",
      url: "https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_collision_detection",
    },
  ],
  visual:
    "The white hammer spins inside its bounding volume, drawn as a thin green wireframe; the yellow cube circling it carries a thin yellow wireframe of the same type. On overlap both turn red with thick lines and a translucent fill. The bar at the bottom is live tightness: its white part is the share of the volume the hammer fills, and the rest of the grey outline is empty space. Switch between AABB, OBB and sphere, and turn off auto spin to set an angle.",
}

export default sheet
