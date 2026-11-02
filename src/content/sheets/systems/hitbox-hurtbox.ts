import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "hitbox-hurtbox",
  category: "systems",
  subcategory: "collision",
  title: "Hitboxes & Hurtboxes",
  hook: "attacks carry hitboxes, bodies carry hurtboxes, and they only meet on active frames",
  summary:
    "Attacks own hitboxes that exist only during active frames; characters own hurtboxes. An overlap is a hit, registered once per swing per target.",
  level: "core",
  tags: ["combat", "frame data", "collision", "melee", "overlap"],
  updated: "2026-11-02",
  prompt:
    "Implement melee hit detection for a Three.js action game in TypeScript. Each attack has frame data {startup, active, recovery} counted in fixed 60 Hz ticks and a hitbox (THREE.Box3) attached to a weapon bone offset; each fighter has a hurtbox Box3 updated each tick from its root. During active frames only, test the attacker's hitbox against hurtboxes on the opposing layer; keep a per-swing Set of already-hit fighter ids cleared at frame 0; queue hits and resolve them after all overlaps are gathered. Add a debug renderer (Box3Helper: hurtbox green, inactive hitbox gray, active red). Write Vitest tests: phase boundaries at the exact frames, a hitbox overlapping for 3 active frames yields one hit, a different target can still be hit in the same swing.",
  related: [
    "tunneling",
    "fixed-timestep",
    "finite-state-machine",
    "collision-detection",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Combat collision uses separate volumes from physics. A **hurtbox** is where a character can be hurt. It usually follows the body with a few simple boxes or capsules. A **hitbox** is where an attack deals damage. It is attached to the weapon or limb and exists **only during the attack's active frames**. A hit happens when an active hitbox overlaps an enemy hurtbox.",
    "Attacks are described by **frame data**: *startup* frames (wind-up, no hitbox), *active* frames (hitbox on), and *recovery* frames (hitbox off, attacker still committed). Count these in fixed simulation ticks, not animation time, so they stay exact at any frame rate. See [fixed timestep](/systems/simulation/fixed-timestep).",
    "A hitbox usually overlaps the target for several active frames in a row, so each swing keeps a **hit registry**: the set of targets already hit. Clear it when the swing starts and skip any target already in it. Multi-hit moves clear it on purpose every few frames. For very fast weapons, sweep the hitbox between frames, the same idea as [tunneling](/systems/collision/tunneling) prevention, so it can't skip past a thin hurtbox.",
  ],
  rules: [
    "Light attacks at 60 fps: about 4–7 startup, 2–4 active, 8–15 recovery frames. Heavy attacks: 12–20 startup, 4–8 active.",
    "Make hurtboxes slightly smaller than the visible body and hitboxes slightly larger than the weapon. Hits that look like they connected should connect.",
    "Use collision layers: player hitboxes test only enemy hurtboxes, so you never hit yourself or your teammates by accident.",
    "Resolve all overlaps for a tick first, then apply damage, knockback and hit-stop in one pass, so the order objects update in doesn't matter.",
    "Put a debug-draw toggle in from day one: hurtboxes green, inactive hitboxes gray, active hitboxes red.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Per-tick attack update with a once-per-swing registry:",
      code: `type Phase = "startup" | "active" | "recovery" | "done"

function phase(f: number, a: Attack): Phase {
  if (f < a.startup) return "startup"
  if (f < a.startup + a.active) return "active"
  if (f < a.startup + a.active + a.recovery) return "recovery"
  return "done"
}

function tickAttack(atk: AttackState, targets: Fighter[]) {
  if (atk.frame === 0) atk.alreadyHit.clear()   // new swing
  if (phase(atk.frame, atk.data) === "active") {
    atk.hitbox.copy(atk.data.box).translate(atk.owner.weaponTip)
    for (const t of targets) {
      if (atk.alreadyHit.has(t.id)) continue
      if (atk.hitbox.intersectsBox(t.hurtbox)) {
        atk.alreadyHit.add(t.id)
        queueHit(atk.owner, t, atk.data.damage)
      }
    }
  }
  atk.frame++
}`,
    },
  ],
  mistakes: [
    "Leaving the hitbox on for the whole animation, so wind-up and follow-through also deal damage.",
    "No hit registry: a 4-frame active window that overlaps for 3 frames deals triple damage.",
    "Driving active frames from animation time with a variable delta. At low frame rates the active window can be skipped entirely.",
    "Using the render mesh or physics collider as the hurtbox. Combat volumes should be simple, deliberate and tunable.",
  ],
  reading: [
    {
      title: "Three.js docs — Box3 (intersectsBox)",
      url: "https://threejs.org/docs/#api/en/math/Box3",
    },
    {
      title: "MDN — 2D collision detection",
      url: "https://developer.mozilla.org/en-US/docs/Games/Techniques/2D_collision_detection",
    },
  ],
  visual:
    "The white attacker swings on a loop. Its hitbox is a gray outline during wind-up and recovery and becomes a solid red box only on active frames. The target's green outline hurtbox turns red and fills in on a hit, and the red diamonds count hits from the current swing. The bar underneath is the frame data: short gray startup, tall red active, medium grey recovery, white playhead. Turn off one hit per swing and a single swing lands several hits.",
}

export default sheet
