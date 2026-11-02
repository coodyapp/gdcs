import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "coyote-time",
  category: "game-feel",
  subcategory: "timing",
  title: "Coyote Time",
  hook: "let the player jump a few frames after leaving the ledge",
  summary:
    "Coyote time keeps a jump available for ~0.1 s after the character walks off an edge, so presses that feel on time are not eaten by the game.",
  level: "common",
  tags: [
    "coyote time",
    "jump",
    "platformer",
    "grace period",
    "input forgiveness",
  ],
  updated: "2026-11-02",
  prompt:
    "Add coyote time to my TypeScript Three.js platformer controller. Keep a coyoteTimer in seconds: refill it to 0.1 s every update the character is grounded, and count it down by dt while airborne. Allow a jump when grounded or coyoteTimer > 0; when the jump fires, set the timer to 0 and set vertical velocity to JUMP_SPEED. Do not refill on wall or ceiling contact. Expose COYOTE as a tunable constant. Write unit tests that step the controller at 30 and 144 fps: a press 0.05 s after walking off a ledge jumps, a press 0.15 s after does not, and pressing twice never yields two jumps.",
  related: ["input-buffering", "delta-time", "finite-state-machine"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Players judge a ledge by eye, and the button press reaches the game a few frames after they decide. A strict platformer only allows a jump while `grounded` is true, so a press that lands one or two frames after the feet leave the edge does nothing and the character drops. To the player it feels like the game ignored the input.",
    "Coyote time fixes this with a timer. While grounded, keep it full (e.g. `0.1` s). Once airborne, count it down with [delta time](/game-feel/timing/delta-time). A jump is allowed while `grounded || coyoteTimer > 0`. When the jump fires, set the timer to zero so it cannot be used twice.",
    "It is invisible when tuned well: the jump simply always seems to work at the edge. It pairs naturally with [input buffering](/game-feel/timing/input-buffering), which forgives presses that come slightly **too early** instead of too late.",
  ],
  formulas: [
    {
      label: "Jump allowed",
      math: tex`\text{canJump} = \text{grounded} \;\lor\; (t - t_{\text{left ground}}) < \textcolor{#05df72}{T_{\text{coyote}}}`,
    },
    {
      label: "Extra ledge distance",
      math: tex`d = v_{run}\,\textcolor{#05df72}{T_{\text{coyote}}}`,
      note: "At 6 u/s and 0.1 s the character can be 0.6 units past the edge and still jump.",
    },
  ],
  rules: [
    "Start with 0.08–0.15 s (about 5–9 frames at 60 fps). Over ~0.2 s it starts to feel like a mid-air jump.",
    "Only start the timer when the character walks off. Jumping should zero it, or the player gets a free second jump.",
    "Measure in seconds, not frames, so the window is the same at every frame rate.",
    "Many games also ignore gravity or cap the fall speed during the window so the jump still starts from near ledge height.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Coyote timer inside a character update:",
      code: `const COYOTE = 0.1 // seconds
let coyoteTimer = 0

function update(dt: number, jumpPressed: boolean) {
  if (player.grounded) coyoteTimer = COYOTE
  else coyoteTimer = Math.max(0, coyoteTimer - dt)

  if (jumpPressed && (player.grounded || coyoteTimer > 0)) {
    player.velocity.y = JUMP_SPEED
    coyoteTimer = 0 // consume it: no double jump
    player.grounded = false
  }
  player.velocity.y -= GRAVITY * dt
  player.position.addScaledVector(player.velocity, dt)
}`,
    },
  ],
  mistakes: [
    "Not clearing the timer on jump, which lets players jump again during the first frames of a jump.",
    "Counting frames instead of seconds, so the window shrinks to 40 ms on a 144 Hz monitor.",
    "Refilling the timer when the character touches walls or ceilings, which turns it into a wall-jump exploit.",
    "Making the window so long that walking off a cliff and then jumping looks like a double jump.",
  ],
  reading: [
    {
      title: "GDC Vault — Math for Game Programmers: Building a Better Jump",
      url: "https://www.gdcvault.com/play/1023559/Math-for-Game-Programmers-Building",
    },
    {
      title: "Game Programming Patterns — State",
      url: "https://gameprogrammingpatterns.com/state.html",
    },
  ],
  visual:
    "The white cube runs off the ledge (white line) and the player presses jump at the thick yellow line, a little late. The translucent strip is the grace window T: bright green when coyote time is on, faint grey when off. Runs alternate between on (the cube turns solid green and the jump works) and off (it turns into a red outline and falls into the red pit). Slide the press later than the window to see it fail even with coyote time.",
}

export default sheet
