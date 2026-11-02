import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "vectors",
  category: "mathematics",
  subcategory: "vectors",
  title: "Vector Basics",
  hook: "an arrow with a length and a direction, nothing more",
  summary:
    "Vectors store positions, offsets, velocities and directions. Learn add, subtract, scale, length, squared length, normalization and distance.",
  level: "core",
  tags: [
    "vector",
    "Vector3",
    "normalize",
    "magnitude",
    "distance",
    "linear algebra",
  ],
  updated: "2026-11-01",
  prompt:
    "Write `src/lib/vec.ts` in TypeScript with pure helpers on `[x, y, z]` tuples: add, sub, scale, dot, length, lengthSq, distance, distanceSq, and `normalize(v)` that returns [0, 0, 0] for vectors shorter than 1e-12 instead of NaN. Then write a Three.js `moveTowards(position: THREE.Vector3, target: THREE.Vector3, speed: number, dt: number)` that moves at most speed·dt along the normalized offset, snaps exactly onto the target when closer than that, and allocates nothing per call (reuse a module-level scratch vector). Add a `withinRange(a, b, r)` check that compares squared distance with r². Write Vitest tests: normalize returns length 1 for random vectors and stays finite for zero; moveTowards never overshoots; withinRange agrees with distance() <= r.",
  related: [
    "dot-and-cross-product",
    "trigonometry",
    "transforms-and-matrices",
    "steering-behaviors",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A vector is a list of numbers, `(x, y)` in 2D or `(x, y, z)` in 3D, read as an arrow: how far to go along each axis. The same type stores a **position** (an arrow from the origin), an **offset** between two points, a **velocity** (units per second) or a pure **direction** (length 1). Three.js gives you `THREE.Vector2` and `THREE.Vector3`; most methods mutate in place and return `this` so calls chain.",
    "**Adding** puts arrows tip to tail: `position += velocity · dt` is one vector add per frame. **Subtracting** gives the arrow from one point to another: `target - me` points at the target. **Scaling** by a number stretches the arrow, and a negative number flips it. Add and subtract are component-wise; there is no component-wise multiply in the maths sense (that is `multiply()` in Three.js and is rarely what you want).",
    "**Length** (magnitude) is Pythagoras: `√(x² + y² + z²)`. Dividing a vector by its length **normalizes** it to a unit direction, which separates **which way** from **how far**. **Distance** between two points is the length of their difference. When you only compare distances, compare the **squared** length and skip the square root.",
    "Vectors become really useful with the [dot and cross product](/mathematics/vectors/dot-and-cross-product), which measure angles and build perpendiculars, and with [trigonometry](/mathematics/trigonometry/trigonometry), which turns an angle into a direction and back.",
  ],
  formulas: [
    {
      label: "Add and scale",
      math: tex`\textcolor{#f5d547}{\vec a + \vec b} = (\textcolor{#fafafa}{a_x} + \textcolor{#a1a1aa}{b_x},\; \textcolor{#fafafa}{a_y} + \textcolor{#a1a1aa}{b_y},\; \textcolor{#fafafa}{a_z} + \textcolor{#a1a1aa}{b_z}), \qquad s\,\vec a = (s a_x,\, s a_y,\, s a_z)`,
    },
    {
      label: "Length and squared length",
      math: tex`\lVert \textcolor{#fafafa}{\vec a} \rVert = \sqrt{a_x^2 + a_y^2 + a_z^2}, \qquad \lVert \vec a \rVert^2 = \vec a \cdot \vec a`,
    },
    {
      label: "Normalize",
      math: tex`\hat a = \frac{\vec a}{\lVert \vec a \rVert}, \qquad \lVert \hat a \rVert = 1 \quad (\vec a \neq \vec 0)`,
      note: "Undefined for the zero vector: guard it and return zero or a default direction.",
    },
    {
      label: "Distance",
      math: tex`d(P, Q) = \lVert Q - P \rVert`,
    },
  ],
  rules: [
    "Compare squared distances for range checks: `a.distanceToSquared(b) < r * r` is exact and skips a square root.",
    "Normalize before using a vector as a direction (raycasts, steering, lookAt). Store the length separately if you need it.",
    "Guard normalization with an epsilon such as 1e-6: a stick at rest or two identical points give a zero vector.",
    "Diagonal input `(1, 1)` has length √2 ≈ 1.41. Normalize (or clamp the length to 1) so diagonal movement is not 41% faster.",
    "Reuse scratch vectors in hot loops. `new THREE.Vector3()` every frame for 1,000 entities is 60,000 garbage objects per second.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Move towards a target at a fixed speed without overshooting:",
      code: `const toTarget = new THREE.Vector3() // scratch, reused every call

function moveTowards(
  pos: THREE.Vector3,
  target: THREE.Vector3,
  speed: number,
  dt: number
) {
  toTarget.subVectors(target, pos)          // offset = target - pos
  const dist = toTarget.length()
  const step = speed * dt
  if (dist <= step || dist < 1e-6) {
    pos.copy(target)                        // arrive exactly
    return true
  }
  pos.addScaledVector(toTarget, step / dist) // normalize and scale in one go
  return false
}`,
    },
    {
      lang: "ts",
      caption: "Input to velocity, with no diagonal speed boost:",
      code: `const input = new THREE.Vector2(right - left, up - down)
if (input.lengthSq() > 1) input.normalize() // keep analog stick values < 1
velocity.set(input.x, 0, -input.y).multiplyScalar(maxSpeed)
player.position.addScaledVector(velocity, dt)

const inRange = player.position.distanceToSquared(enemy.position) < 8 * 8`,
    },
  ],
  mistakes: [
    "Normalizing a zero vector. Three.js quietly returns (0, 0, 0), other libraries return NaN, and NaN spreads through every later calculation.",
    "Forgetting that Three.js methods mutate: `a.add(b)` changes `a`. Use `.clone()` or a scratch vector when you need to keep the original.",
    "Mixing points and directions. Translating a direction (for example with `applyMatrix4`) moves it; use `transformDirection` for directions.",
    "Taking `Math.sqrt` inside a tight loop just to compare distances. Compare squared values instead.",
  ],
  reading: [
    {
      title: "Three.js docs — Vector3",
      url: "https://threejs.org/docs/#api/en/math/Vector3",
    },
    {
      title: "Scratchapixel — Geometry: points, vectors and normals",
      url: "https://www.scratchapixel.com/lessons/mathematics-physics-for-computer-graphics/geometry/points-vectors-and-normals.html",
    },
  ],
  visual:
    "The solid white arrow is a and the grey arrow with the wireframe head is b. The thick yellow arrow is a + b, and the faint dashed edges close the parallelogram: walking a then b lands on the same tip as b then a. Change b's angle and length and watch |a + b| shrink as the arrows oppose each other.",
}

export default sheet
