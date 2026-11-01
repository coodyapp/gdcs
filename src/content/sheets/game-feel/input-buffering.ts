import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "input-buffering",
  category: "game-feel",
  subcategory: "timing",
  title: "Input Buffering",
  hook: "remember a press for a moment and fire it when it becomes legal",
  summary:
    "Input buffering stores a press for ~0.1 s and performs it as soon as the action becomes possible, so slightly early inputs still count.",
  level: "common",
  tags: [
    "input buffer",
    "jump buffer",
    "combo",
    "responsiveness",
    "input forgiveness",
  ],
  updated: "2026-11-01",
  prompt:
    "Implement a jump input buffer for a TypeScript Three.js platformer. When jump is pressed, set bufferTimer = 0.12 s; count it down by dt each update. On any update where the character can jump (grounded or coyote time left) and bufferTimer > 0, jump and clear both timers. Clear the buffer on death or pause. Read raw key presses into a per-frame `pressed` flag so the controller never acts inside event handlers. Write Vitest tests at 30, 60 and 144 fps: a press 0.08 s before landing jumps on the landing frame, a press 0.2 s before does not, and one press never gives two jumps.",
  related: ["coyote-time", "finite-state-machine", "delta-time"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Players press buttons slightly **before** an action is allowed: jump a few frames before landing, attack while the previous swing is still recovering, dodge just before a stun ends. If the game only checks the button on the exact frame it is legal, those presses vanish and the controls feel sticky.",
    "An input buffer records the press with a timestamp, or a countdown timer, and keeps checking it for a short window. The first frame the action becomes legal inside that window, it fires and the buffer is cleared. Presses older than the window are discarded, so a stale press does not trigger something the player no longer wants.",
    "The jump buffer is the mirror image of [coyote time](/game-feel/timing/coyote-time): coyote time forgives late presses, buffering forgives early ones. Fighting and action games extend the idea to a short queue of commands so combos chain on the first legal frame.",
  ],
  formulas: [
    {
      label: "Buffered action fires when",
      math: tex`\text{legal}(t) \;\land\; t - t_{press} \le T_{buffer}`,
    },
  ],
  rules: [
    "Jump buffers of 0.1–0.15 s (6–9 frames at 60 fps) feel natural. Attack and dodge buffers are often 0.15–0.3 s.",
    "Buffer one action per type, and let a newer press overwrite an older one.",
    "Clear the buffer when it is consumed, and on state changes such as death, pause or cutscenes.",
    "Store time in seconds (or a timestamp), never in frames, so the window does not shrink at high refresh rates.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Jump buffer next to a coyote timer:",
      code: `const BUFFER = 0.12 // seconds
let bufferTimer = 0

function update(dt: number, jumpPressed: boolean) {
  if (jumpPressed) bufferTimer = BUFFER
  else bufferTimer = Math.max(0, bufferTimer - dt)

  const canJump = player.grounded || coyoteTimer > 0
  if (bufferTimer > 0 && canJump) {
    player.velocity.y = JUMP_SPEED
    bufferTimer = 0
    coyoteTimer = 0
  }
}`,
    },
    {
      lang: "pseudo",
      caption: "A tiny action buffer for combos:",
      code: `on press(action):  buffered = { action, time: now }
every frame:
  if buffered and now - buffered.time > WINDOW: buffered = null
  if buffered and canPerform(buffered.action):
      perform(buffered.action); buffered = null`,
    },
  ],
  mistakes: [
    "Reading input in an event handler and acting on it immediately, bypassing the buffer and the state checks.",
    "Never expiring the buffer, so a jump pressed mid-air fires a second later and feels like a glitch.",
    "Buffering in frames, which cuts the window from 100 ms to 42 ms on a 144 Hz display.",
    "Not clearing the buffer when it fires, causing a double jump on the next frame.",
  ],
  reading: [
    {
      title: "Game Programming Patterns — Command",
      url: "https://gameprogrammingpatterns.com/command.html",
    },
    {
      title: "MDN — KeyboardEvent",
      url: "https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent",
    },
  ],
  visual:
    "The cube presses jump in mid-air at the yellow line. The strip below is a zoomed timeline: yellow is the press, white is touchdown, the cyan bar is the buffer window and the grey playhead is now. Runs alternate between buffer on (the press survives until touchdown, the cube turns green and hops again) and off (the press is dropped, it lands red and stops). Push the press earlier than the window to see it expire.",
}

export default sheet
