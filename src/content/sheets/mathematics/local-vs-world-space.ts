import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "local-vs-world-space",
  category: "mathematics",
  subcategory: "transforms",
  title: "Local vs World Space",
  hook: "every position is relative to someone",
  summary:
    "A child's position is stored relative to its parent. Chain the parent matrices to reach world space, or invert the chain to come back.",
  level: "core",
  tags: ["local space", "world space", "scene graph", "parent", "localToWorld"],
  updated: "2026-11-01",
  prompt:
    "In TypeScript with Three.js, write a `Socket` helper for attaching items to a character: `mount(item, socket)` re-parents the item so it keeps its current world pose (use socket.attach), `drop(item, scene)` re-parents it back to the scene keeping its world pose, and `muzzleWorld(gun, out)` returns the world position of the local point (0, 0, 0.8) on the gun without allocating. Make sure matrixWorld is up to date before converting (updateWorldMatrix(true, false)). Also write `toLocalDirection(obj, worldDir, out)` that rotates a world direction into the object's space without applying translation. Add Vitest tests: localToWorld then worldToLocal returns the original point within 1e-6 for a rotated, scaled, nested hierarchy; attach keeps the world position while add changes it.",
  related: [
    "transforms-and-matrices",
    "euler-angles",
    "quaternions",
    "inverse-kinematics",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A scene graph is a tree. Each object's `position`, `rotation` and `scale` are **local**: measured in its parent's coordinate frame. A wheel at `(1.2, 0, 0)` sits 1.2 units along the car's own X axis, wherever the car is and however it is turned. Move or rotate the parent and every child comes along for free.",
    "**World space** is the frame of the scene root. To get there, multiply up the chain: `world = parent.matrixWorld · child.matrix`. Going back the other way uses the inverse. In Three.js, `obj.localToWorld(v)` and `obj.worldToLocal(v)` do this for points, and `getWorldPosition`, `getWorldQuaternion` and `getWorldDirection` read the composed result.",
    "Re-parenting is where bugs hide. `parent.add(child)` keeps the child's **local** numbers, so it jumps to a new place in the world. `parent.attach(child)` keeps its **world** pose by rewriting the local transform with the new parent's inverse. Pick-ups, sockets and dropping items almost always want `attach`.",
    "Use local space for anything that should ride along (turrets, held items, muzzle flashes), world space for physics, AI and gameplay queries, and convert only at the boundary. The maths is in [transforms and matrices](/mathematics/transforms/transforms-and-matrices).",
  ],
  formulas: [
    {
      label: "Local → world",
      math: tex`\textcolor{#fdc700}{p_{\text{world}}} = M_{\text{parent}}^{\text{world}}\;\textcolor{#fdc700}{p_{\text{local}}}`,
      note: "The yellow point is the same place in both frames; only its coordinates change.",
    },
    {
      label: "World → local",
      math: tex`p_{\text{local}} = \left(M_{\text{parent}}^{\text{world}}\right)^{-1} p_{\text{world}}`,
    },
    {
      label: "World matrix of a chain",
      math: tex`M^{\text{world}}_{\text{child}} = M_{\text{root}}\cdots M_{\text{parent}}\,M_{\text{child}}`,
    },
    {
      label: "attach() keeps the world pose",
      math: tex`M_{\text{child}}' = \left(M^{\text{world}}_{\text{new parent}}\right)^{-1} M^{\text{world}}_{\text{child}}`,
    },
  ],
  rules: [
    "`localToWorld` and `worldToLocal` mutate the vector you pass in; clone or use a scratch vector.",
    "Both read `matrixWorld`. If you moved something this frame, call `obj.updateWorldMatrix(true, false)` first.",
    "Directions: use `transformDirection` (or rotate by the world quaternion), never `localToWorld`, which adds the position.",
    "Keep hierarchies shallow (≈ 3–5 levels) for gameplay objects; every level is another matrix multiply per frame.",
    "Avoid non-uniform scale on parents of rotated children: the children shear.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Converting between frames and re-parenting in Three.js:",
      code: `const tmp = new THREE.Vector3()

// Where is the muzzle (local to the gun) in the world?
gun.updateWorldMatrix(true, false)
const muzzle = gun.localToWorld(tmp.set(0, 0, 0.8))

// Where is the enemy relative to the turret? (x > 0: to its right)
const rel = turret.worldToLocal(tmp.copy(enemy.position))

// Pick up: keep the sword exactly where it is in the world.
hand.attach(sword)   // rewrites sword.position/quaternion for the new parent
// hand.add(sword)   // keeps local numbers → sword jumps

// Drop it back into the world, still in place.
scene.attach(sword)

// World-space facing direction (local +Z).
const forward = player.getWorldDirection(new THREE.Vector3())`,
    },
  ],
  mistakes: [
    "Using `add` when re-parenting and watching the item teleport. Use `attach`.",
    "Comparing a child's local `position` with another object's world position.",
    "Calling `worldToLocal` before the parent's `matrixWorld` is updated, getting last frame's answer.",
    "Converting a direction with `localToWorld`, which adds the parent's position to it.",
    "Forgetting that `localToWorld(v)` modifies `v` in place and then reusing `v` as if it were unchanged.",
  ],
  reading: [
    {
      title: "Three.js docs — Object3D",
      url: "https://threejs.org/docs/#api/en/core/Object3D",
    },
    {
      title: "Three.js manual — Scene graph",
      url: "https://threejs.org/manual/#en/scenegraph",
    },
  ],
  visual:
    "The grey arm is the parent and spins around its own Y; its thick local axes (X red, Y green, Z white) turn with it while the thin faint world axes stay put. The solid white cube is the child. The yellow ball is a fixed world point, with a grey dashed line from the parent origin. Switch the child to the world with add() or attach(): the grey outline marks where it would have stayed as a child.",
}

export default sheet
