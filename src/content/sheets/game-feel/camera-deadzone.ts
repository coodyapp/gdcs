import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "camera-deadzone",
  category: "game-feel",
  subcategory: "camera",
  title: "Camera Deadzone",
  hook: "let the player move inside a box before the camera follows",
  summary:
    "A camera deadzone is a box around the screen centre where the target moves freely. The camera only follows when the target pushes past its edge.",
  level: "common",
  tags: [
    "camera",
    "deadzone",
    "follow camera",
    "platformer camera",
    "smoothing",
  ],
  updated: "2026-11-02",
  prompt:
    "Implement a 2D-style follow camera for a TypeScript Three.js side-scroller. Keep a focus point; each frame clamp it per axis so the player stays inside a deadzone of 2.4 × 1.4 world units, then ease the camera toward that clamped point with a = 1 - Math.exp(-6 * dt). Add optional look-ahead (15% of view width in the velocity direction, itself smoothed) and a platform-snap mode that only updates the vertical target when the player is grounded. Apply shake as a separate offset after the follow. Write Vitest tests: the camera does not move while the target stays inside the zone, and the follow result after 1 s matches at 30 and 144 fps within 1%.",
  related: ["screen-shake", "acceleration-and-friction", "delta-time"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A camera locked to the player's position copies every small motion: idle bobbing, a step back and forth, the jitter of a jump. The whole screen moves with it, which is tiring to watch and can cause motion sickness. A **deadzone** (also called a camera window) is a rectangle around the camera's focus point. While the target stays inside, the camera stays still. When the target crosses an edge, the camera moves just enough to keep it on that edge.",
    "Per axis the rule is a clamp: `cam = clamp(cam, target − half, target + half)`. Combine it with exponential smoothing toward that clamped position (`1 − e^(−k·dt)`) so the camera eases into motion instead of being dragged rigidly.",
    "Platformers often use different rules per axis: a wide horizontal zone, and vertical follow that only updates when the player lands (platform snapping) so jumps do not bounce the view. Add look-ahead in the direction of motion to show more of what is coming. Keep [screen shake](/game-feel/camera/screen-shake) as an offset on top of the followed position, never inside the follow state.",
  ],
  formulas: [
    {
      label: "Deadzone clamp (per axis)",
      math: tex`\textcolor{#fafafa}{c'} = \operatorname{clamp}\!\left(\textcolor{#fafafa}{c},\; \textcolor{#fdc700}{p} - \tfrac{w}{2},\; \textcolor{#fdc700}{p} + \tfrac{w}{2}\right)`,
    },
    {
      label: "Smoothed follow",
      math: tex`c \leftarrow c' + (c - c')\,e^{-k\,\Delta t}, \qquad t_{1/2} = \frac{\ln 2}{k}`,
      note: "t½ is how long the camera takes to close half the remaining gap.",
    },
  ],
  rules: [
    "Horizontal deadzone: 10–25% of screen width. Vertical: smaller, or none with platform snapping.",
    "Smoothing rate k of 4–10 /s (half-life 70–170 ms) feels responsive without lag.",
    "Look-ahead: shift the focus 10–20% of screen width in the facing or velocity direction, smoothed.",
    "Update the camera after the player moves, in the same frame, to avoid one-frame jitter.",
  ],
  code: [
    {
      lang: "ts",
      caption: "2D deadzone follow with frame-rate independent smoothing:",
      code: `const ZONE = { w: 2.4, h: 1.4 } // world units
const K = 6 // smoothing rate, 1/s

const clamp = (x: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, x))

function updateCamera(dt: number) {
  const p = player.position
  const wantX = clamp(focus.x, p.x - ZONE.w / 2, p.x + ZONE.w / 2)
  const wantY = clamp(focus.y, p.y - ZONE.h / 2, p.y + ZONE.h / 2)
  const a = 1 - Math.exp(-K * dt)
  focus.x += (wantX - focus.x) * a
  focus.y += (wantY - focus.y) * a
  camera.position.set(focus.x, focus.y, camera.position.z)
}`,
    },
  ],
  mistakes: [
    "Smoothing with `lerp(cam, target, 0.1)` per frame, which follows faster at higher frame rates.",
    "Making the deadzone so large the player can reach the screen edge before the camera reacts.",
    "Following the player in Y during every jump, so the horizon bounces constantly.",
    "Applying shake or recoil to the follow state, so the camera drifts after every hit.",
  ],
  reading: [
    {
      title:
        "GDC Vault — Math for Game Programmers: Juicing Your Cameras With Math",
      url: "https://www.gdcvault.com/play/1023146/Math-for-Game-Programmers-Juicing",
    },
    {
      title: "Gaffer On Games — Fix Your Timestep!",
      url: "https://gafferongames.com/post/fix_your_timestep/",
    },
  ],
  visual:
    "Top-down view. The yellow ball is the target p wandering with small jitters; the thick white rectangle is what the camera c sees and the dashed white box is the deadzone. Its fill is faint green while the target moves inside it (camera still) and turns brighter yellow when the target pushes the camera. The trails compare the target's path (small faded yellow dots) with the much calmer camera path (larger white squares). Set the deadzone to 0 to see a hard-locked camera copy every wiggle.",
}

export default sheet
