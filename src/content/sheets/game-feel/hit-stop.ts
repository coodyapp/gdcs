import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "hit-stop",
  category: "game-feel",
  subcategory: "timing",
  title: "Hit Stop",
  hook: "freeze both fighters for a few frames when a blow lands",
  summary:
    "Hit stop pauses the attacker and target for a few frames on impact. The brief freeze sells weight and gives the eye time to read the hit.",
  level: "common",
  tags: ["hit stop", "hit lag", "freeze frame", "impact", "combat feel"],
  updated: "2026-11-02",
  prompt:
    "Add hit stop to my TypeScript Three.js brawler. Each fighter has hitStop seconds; on a hit, both attacker and target get hitStop = max(current, 0.06 + 0.004 * damage), capped at 0.2 s. In update(realDt), consume hitStop from real time and pass the remaining game dt (0 while frozen, the leftover on the last frozen frame) to animation and physics. While frozen, jitter the target's mesh ±0.05 units on x without moving its physics body, and keep particles and UI on unscaled time. Write a Vitest test that at 30 and 144 fps a 0.12 s hit stop removes exactly 0.12 s of game time.",
  related: [
    "screen-shake",
    "invincibility-frames",
    "hitbox-hurtbox",
    "input-buffering",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "When a hit connects, many action and fighting games stop the attacker and the target for a short moment, typically 3–10 frames, before the knockback plays. The pause reads as resistance, like a blade biting into something solid, and makes heavy attacks feel heavier than light ones even when their animations are similar.",
    "Implement it as a timer that zeroes the **game** delta time for the frozen objects. Freeze only the participants and let effects (sparks, screen flash, [screen shake](/game-feel/camera/screen-shake)) keep running so the moment stays alive. A small jitter on the target during the freeze adds to the effect.",
    "Scale the duration with the hit: light jab ~50 ms, heavy strike ~120–200 ms, finishing blow longer. Because inputs keep arriving during the freeze, pair it with an [input buffer](/game-feel/timing/input-buffering) so combo presses made during the stop are not lost.",
  ],
  formulas: [
    {
      label: "Game time during hit stop",
      math: tex`\textcolor{#05df72}{\Delta t_{game}} = \begin{cases} 0 & t_{stop} > 0 \\ \Delta t \cdot s_{time} & \text{otherwise} \end{cases}`,
    },
    {
      label: "Duration from damage",
      math: tex`T_{stop} = \min(T_{max},\; T_{base} + k \cdot \text{damage})`,
    },
  ],
  rules: [
    "Start at 60–100 ms for normal hits, up to ~200 ms for heavy or critical hits. Past ~300 ms it reads as lag.",
    "Count the timer down with real (unscaled) `dt`, not the game `dt` it is freezing.",
    "Do not stack durations from several simultaneous hits. Take the max of the remaining time and the new one.",
    "Keep UI, audio and particles on unscaled time so the world does not feel frozen.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Per-entity hit stop that does not lose leftover time:",
      code: `class Fighter {
  hitStop = 0 // seconds of freeze left

  onHit(duration: number) {
    this.hitStop = Math.max(this.hitStop, duration)
  }

  update(realDt: number) {
    let dt = realDt
    if (this.hitStop > 0) {
      const used = Math.min(this.hitStop, realDt)
      this.hitStop -= used
      dt = realDt - used // 0 while frozen, leftover on the last frame
    }
    this.animation.update(dt)
    this.body.integrate(dt)
  }
}`,
    },
  ],
  mistakes: [
    "Freezing the whole game loop, including input and audio, so the pause feels like a frame drop.",
    "Counting the freeze in frames, which halves its length on a 120 Hz display.",
    "Using the same duration for every attack, so light and heavy hits feel the same.",
    "Letting hit stop and knockback both run, so the target slides during the freeze.",
  ],
  reading: [
    {
      title:
        "GDC Vault — Math for Game Programmers: Juicing Your Cameras With Math",
      url: "https://www.gdcvault.com/play/1023146/Math-for-Game-Programmers-Juicing",
    },
    {
      title: "Game Programming Patterns — Game Loop",
      url: "https://gameprogrammingpatterns.com/game-loop.html",
    },
  ],
  visual:
    "Both rows play the same attack on the same clock. The top row (green post) freezes the white attacker and the grey target for the hit-stop duration, with the target flashing red on contact, an yellow diamond spark at the impact and a jitter; the bottom row (grey post) has no hit stop and the blow slides past. The thin bar under each row is game time (green on top, grey below), so the top one visibly lags. Lower the playback speed to count the frozen frames.",
}

export default sheet
