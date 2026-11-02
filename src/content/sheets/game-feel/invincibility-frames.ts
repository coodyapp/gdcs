import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "invincibility-frames",
  category: "game-feel",
  subcategory: "timing",
  title: "Invincibility Frames",
  hook: "after a hit, ignore damage for a short, clearly signalled window",
  summary:
    "Invincibility frames (i-frames) make a character ignore damage for a short window after a hit or during a dodge, with blinking to show it.",
  level: "core",
  tags: [
    "i-frames",
    "invulnerability",
    "damage",
    "dodge roll",
    "mercy invincibility",
  ],
  updated: "2026-11-02",
  prompt:
    "Implement invincibility frames for a TypeScript Three.js action game. Create a Health component with hp and an invulnerable timer in seconds. damage(amount, source) returns false and does nothing while invulnerable (unless source.bypassIFrames is true); otherwise it subtracts hp and starts a 1.0 s window. Add a dodge that sets invulnerable for 0.3 s starting 0.05 s into a 0.6 s roll. Blink the character mesh at 10 Hz while invulnerable (toggle material opacity, not visibility, so shadows stay). Write Vitest tests: hits every frame for 1 s at 60 fps with a 0.25 s window deal exactly 4 damage, and results match at 144 fps.",
  related: ["hitbox-hurtbox", "hit-stop", "screen-shake", "delta-time"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Without protection, a character standing in a stream of bullets or touching an enemy loses health every frame, and the player dies before they can react. **Mercy invincibility** gives a window after each hit, often 0.5–2 s, where further damage is ignored. The window gives the player time to escape and makes damage predictable: one mistake, one hit.",
    "Dodge rolls use the same mechanism on purpose. Part of the roll animation, not all of it, is invulnerable, so dodging through an attack is a timing skill. In that case the window is a range of animation frames, not a timer after damage.",
    "The window must be **visible**. The classic signal is blinking the sprite or mesh at 8–15 Hz, sometimes with a tint. Keep the hurtbox in place and let the damage check refuse the hit. Disabling collisions would also stop pickups and triggers (see [hitboxes and hurtboxes](/systems/collision/hitbox-hurtbox)).",
  ],
  formulas: [
    {
      label: "Damage accepted when",
      math: tex`t - t_{\text{last hit}} \ge \textcolor{#a3a3a3}{T_{iframes}}`,
    },
    {
      label: "Blink visibility",
      math: tex`\text{visible} = \lfloor 2 f \, t_{\text{left}} \rfloor \bmod 2 = 0`,
      note: "f is the blink rate in Hz (8–15 is typical).",
    },
  ],
  rules: [
    "Mercy window after damage: 0.6–1.5 s in action games, up to 2 s in platformers.",
    "Dodge-roll i-frames: roughly 0.2–0.4 s inside a 0.5–0.8 s roll, starting a few frames in.",
    "Blink at 8–15 Hz. Stop blinking a few frames before the window ends only if you also tell the player it is ending.",
    "Store the window per damage source type if needed, e.g. let environmental hazards bypass it to prevent standing in lava forever.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Health with a mercy window and blinking:",
      code: `const IFRAMES = 1.0 // seconds
const BLINK_HZ = 10

class Health {
  hp = 5
  invulnerable = 0

  damage(amount: number) {
    if (this.invulnerable > 0) return false // ignored
    this.hp -= amount
    this.invulnerable = IFRAMES
    return true
  }

  update(dt: number, mesh: THREE.Object3D) {
    this.invulnerable = Math.max(0, this.invulnerable - dt)
    const phase = Math.floor(this.invulnerable * BLINK_HZ * 2)
    mesh.visible = this.invulnerable === 0 || phase % 2 === 0
  }
}`,
    },
  ],
  mistakes: [
    "Giving no visual cue, so players cannot tell when they are safe and the rule feels random.",
    "Disabling the whole collider instead of ignoring damage, which also breaks pickups, triggers and enemy contact pushes.",
    "Blinking by toggling `visible` on a parent that also hides shadows or UI attached to the character.",
    "Frame-counted windows that last half as long at 120 fps.",
    "Letting the player chain i-frames forever, e.g. dodge-cancelling into another dodge with no recovery.",
  ],
  reading: [
    {
      title: "Game Programming Patterns — Update Method",
      url: "https://gameprogrammingpatterns.com/update-method.html",
    },
    {
      title: "Game Programming Patterns — State",
      url: "https://gameprogrammingpatterns.com/state.html",
    },
  ],
  visual:
    "Solid yellow balls are shots hitting the white player on a steady rhythm. A hit flashes the player red, empties one of the green health pips above it and fills the grey i-frame bar; while the bar drains the player turns grey and blinks, and shots pass through as grey wireframe outlines. Set the window to 0 to watch health melt, or shorten the gap between shots.",
}

export default sheet
