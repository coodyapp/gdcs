import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "screen-shake",
  category: "game-feel",
  subcategory: "camera",
  title: "Screen Shake",
  hook: "add trauma on impact, shake by trauma squared, let it decay",
  summary:
    "Trauma-based screen shake: hits add trauma (0–1) that decays over time, and the camera is offset by trauma² × smooth noise for impact.",
  level: "common",
  tags: ["screen shake", "camera shake", "trauma", "juice", "noise", "impact"],
  updated: "2026-11-02",
  prompt:
    "Implement trauma-based camera shake in TypeScript for a Three.js game. Keep trauma in [0, 1]; addTrauma(amount) adds and clamps; each frame subtract decay * dt (default 1/s). Compute shake = trauma ** 2 times a user intensity setting, and offset the camera from its follow position by maxOffset * shake * noise(t * freq, seed) on x and y, plus roll maxRoll * shake * noise(t * freq, 3), using a smooth 1D value noise with a seed per channel. Restore the base transform before applying the offset each frame. Write Vitest tests: trauma from 0.6 reaches 0 after 0.6 s at 30 and 144 fps, it never exceeds 1, and the noise is continuous.",
  related: [
    "camera-deadzone",
    "hit-stop",
    "invincibility-frames",
    "seeded-noise",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Screen shake sells impact: explosions, heavy landings, big hits. Shaking by a random offset each frame looks jittery, and stacking several shakes is hard to control. A cleaner model keeps a single **trauma** value between 0 and 1. Events add to it (a small hit +0.2, an explosion +0.6), it decays linearly over time, and the shake each frame is derived from it.",
    "Use `shake = trauma²` (or ³). Squaring makes small trauma nearly invisible and large trauma violent, so light hits stay subtle and stacked hits escalate. Multiply the shake by a maximum offset and angle, and by **smooth noise** sampled over time, one independent channel per axis. Noise gives continuous motion instead of teleporting the camera every frame.",
    "Apply the result as an offset on top of the camera's normal position (after the [deadzone follow](/game-feel/camera/camera-deadzone)), then remove it next frame. Rotation (roll) shake reads strongly in 2D; in 3D small yaw and pitch also work. Offer a setting to reduce or disable shake for accessibility.",
  ],
  formulas: [
    {
      label: "Trauma update",
      math: tex`\textcolor{#a1a1aa}{\tau} \leftarrow \operatorname{clamp}(\textcolor{#a1a1aa}{\tau} + \Delta\tau_{hit} - r\,\Delta t,\; 0,\; 1)`,
    },
    {
      label: "Offset per axis",
      math: tex`o_x = O_{max}\,\textcolor{#f5d547}{\tau^{2}}\,N_1(f\,t), \quad \theta = \Theta_{max}\,\textcolor{#f5d547}{\tau^{2}}\,N_3(f\,t)`,
      note: "N is smooth noise in −1..1 with an independent seed per axis; f is the shake frequency (10–25 Hz).",
    },
  ],
  rules: [
    "Trauma per event: 0.1–0.3 for small hits, 0.5–0.8 for explosions. Decay 0.8–1.5 per second.",
    "Max offset about 1–3% of the view height; max roll 2–5°.",
    "Noise frequency 10–25 Hz. Lower feels like rumble, higher like vibration.",
    "Always offer a shake intensity option, including off.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Trauma shake applied after the camera follow:",
      code: `const MAX_OFFSET = 0.3, MAX_ROLL = THREE.MathUtils.degToRad(3)
const DECAY = 1.0, FREQ = 15
let trauma = 0, time = 0 // noise1D: any smooth 1D noise in -1..1

export const addTrauma = (amount: number) =>
  (trauma = Math.min(1, trauma + amount))

function updateShake(dt: number, base: THREE.Vector3, settings = 1) {
  time += dt
  trauma = Math.max(0, trauma - DECAY * dt)
  const shake = trauma * trauma * settings
  const t = time * FREQ
  camera.position.copy(base) // follow result, never mutated
  camera.position.x += MAX_OFFSET * shake * noise1D(t, 1)
  camera.position.y += MAX_OFFSET * shake * noise1D(t, 2)
  camera.rotation.z = MAX_ROLL * shake * noise1D(t, 3)
}`,
    },
  ],
  mistakes: [
    "Using `Math.random()` per frame, which looks like jitter and depends on frame rate.",
    "Adding the shake offset to the follow position permanently, so the camera drifts away.",
    "Shaking linearly with trauma, so every tiny hit wobbles the screen.",
    "Shaking for gameplay events the player does not cause, until it becomes noise and fatigue.",
    "No accessibility toggle. Strong shake causes discomfort for many players.",
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
    "The white player takes a quick double hit, then a single one, on a loop; each hit flashes it red and sends out an yellow impact ring. The dashed grey frame stays still while the world shakes inside it. The meter on the right shows trauma τ as the left grey bar and the resulting shake τ² as the right yellow bar. Turn off squaring to see small trauma wobble too much, or switch to random noise to see the jitter it causes.",
}

export default sheet
