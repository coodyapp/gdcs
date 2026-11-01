import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "raycasting",
  category: "threejs",
  subcategory: "rendering",
  title: "Raycasting",
  hook: "shoot an invisible line and ask what it touches first",
  summary:
    "A ray is an origin plus a direction. Raycasting returns the nearest surface it crosses, with hit point, distance and surface normal.",
  level: "core",
  tags: ["ray", "intersection", "picking", "line of sight", "hitscan"],
  updated: "2026-11-01",
  prompt:
    "Add raycast-based interaction to my Three.js scene in TypeScript. On pointerdown, convert the pointer to NDC (flip Y), call raycaster.setFromCamera, limit raycaster.far to 100, and intersect only an explicit `pickables` array (non-recursive). For the closest hit, log object name, world-space hit point, distance, and the world-space normal (transform face.normal by the object's normal matrix). Also write a reusable `groundCheck(origin, maxDistance)` that casts straight down and treats the hit as walkable if dot(normal, up) > 0.7. No per-frame allocations.",
  related: ["normals", "tunneling", "hitbox-hurtbox"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A ray is the half-line `P(t) = O + t·D` for `t ≥ 0`. A raycast tests that line against colliders or triangles and returns the **closest** hit: the point, the distance `t`, the object, and the surface normal at that point.",
    "Games use it everywhere: hitscan weapons, mouse picking, line-of-sight checks, ground detection under a character, camera collision, and placing objects on terrain. In Three.js, `THREE.Raycaster` does this against meshes. Physics engines offer faster versions against their own colliders.",
    "Raycasts are cheap individually but add up. Limit the distance, filter by layer or mask, and test against simple proxy shapes, or an acceleration structure such as a BVH, rather than every triangle of a detailed mesh.",
  ],
  formulas: [
    { label: "Ray", math: tex`P(t) = O + t\,\hat{D}, \quad t \ge 0` },
    {
      label: "Ray–plane hit",
      math: tex`t = \frac{(P_0 - O)\cdot \hat{n}}{\hat{D}\cdot \hat{n}}`,
      note: "No hit when the denominator is ~0 (parallel ray) or t < 0 (plane behind the origin).",
    },
    {
      label: "Ray–sphere hit",
      math: tex`t = -b - \sqrt{b^2 - c},\; b = (O-C)\cdot\hat{D},\; c = \lVert O-C\rVert^2 - r^2`,
      note: "A negative discriminant (b² − c < 0) means a miss.",
    },
  ],
  rules: [
    "Always normalize the direction; most APIs assume a unit vector, so `t` is in world units.",
    "Set `far` (max distance) to the gameplay range, not infinity.",
    "Ground checks: start the ray slightly above the feet and cast a little past them (e.g. 0.1–0.2 units) to tolerate small steps.",
    "Use layers/masks so the player's own collider doesn't block their shots.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Mouse picking with `THREE.Raycaster`:",
      code: `const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

window.addEventListener("pointerdown", (e) => {
  // Pixel → normalized device coordinates (-1..1)
  pointer.x = (e.clientX / innerWidth) * 2 - 1
  pointer.y = -(e.clientY / innerHeight) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  raycaster.far = 100
  const [hit] = raycaster.intersectObjects(pickables, false)
  if (hit) {
    console.log(hit.object.name, hit.point, hit.distance, hit.face?.normal)
  }
})`,
    },
    {
      lang: "pseudo",
      caption: "Engine-neutral ground check:",
      code: `origin    = feet + up * 0.1
hit       = raycast(origin, -up, maxDistance = 0.3, mask = WORLD)
grounded  = hit != null and dot(hit.normal, up) > 0.7   // walkable slope`,
    },
  ],
  mistakes: [
    "Forgetting the Y flip when converting mouse coordinates to NDC.",
    "Using `intersectObjects(scene.children, true)` every frame on detailed meshes. Raycast against simple proxies or a BVH instead.",
    "Starting the ray inside a collider. Many engines ignore or report odd hits for backfaces and inside starts.",
    "Expecting `face.normal` in world space. In Three.js it is in object space, so transform it with the object's normal matrix.",
  ],
  reading: [
    {
      title: "Three.js docs — Raycaster",
      url: "https://threejs.org/docs/#api/en/core/Raycaster",
    },
    {
      title: "Scratchapixel — Ray-sphere intersection",
      url: "https://www.scratchapixel.com/lessons/3d-basic-rendering/minimal-ray-tracer-rendering-simple-shapes/ray-sphere-intersection.html",
    },
  ],
  visual:
    "A ray sweeps from the white origin. The cyan segment ends at the first surface it hits; the orange dot is the hit point and the green arrow is that surface's normal. Turn off auto sweep to aim it yourself, and shorten max distance to see misses.",
}

export default sheet
