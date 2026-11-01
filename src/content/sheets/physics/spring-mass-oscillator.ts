import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "spring-mass-oscillator",
  category: "physics",
  subcategory: "mechanics",
  title: "Spring-Mass Oscillator",
  hook: "pull back in proportion, bleed energy, push in rhythm",
  summary:
    "Hooke's law, damping and a periodic push: the forced oscillator behind springy cameras, wobbly UI and suspension, and why driving at ω₀ explodes.",
  level: "core",
  tags: ["oscillation", "hookes-law", "damping", "resonance", "springs"],
  updated: "2026-11-01",
  prompt:
    "Write a TypeScript Spring class for a Three.js game that smooths a number (or THREE.Vector3) toward a target. Constructor takes frequency in Hz and damping ratio ζ; derive k = (2πf)² and c = 2ζ(2πf) with unit mass. Provide step(target, dt) using semi-implicit Euler and a reset(value). It must be called from a fixed 120 Hz loop. Edge cases: ζ = 0 (pure oscillation), ζ ≥ 1 (no overshoot), dt larger than 1/30 should be subdivided. Add unit tests: with ζ = 1 a step response never overshoots the target, and with ζ = 0 total energy ½kx² + ½v² stays within 1% over 10 s.",
  related: [
    "damped-pendulum",
    "fixed-timestep",
    "squash-and-stretch",
    "sound-waves",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A mass on a spring feels a restoring force `−k·x` that always points back to the rest position. Left alone it trades kinetic energy for elastic energy forever, oscillating at the **natural frequency** `ω₀ = √(k/m)`. A damper adds `−c·v`, which turns the swing into a decaying one.",
    "Push it with a periodic force `F₀ sin(ωt)` and, after the start-up transient dies out, the mass settles into motion at the **drive** frequency. Its amplitude depends on how close `ω` is to `ω₀`: far away the spring barely notices, near `ω₀` the response peaks, and with no damping it grows without bound. That peak is resonance.",
    "Games use this model constantly: spring-follow cameras, juicy UI that overshoots and settles, car suspension, ragdoll joints and [squash and stretch](/game-feel/motion/squash-and-stretch). The damping ratio `ζ` is the one number designers actually tune: below 1 it bounces, at 1 it snaps in without overshoot, above 1 it crawls.",
  ],
  formulas: [
    {
      label: "Equation of motion",
      math: tex`m\ddot{x} + c\dot{x} + kx = F_0 \sin(\omega t)`,
    },
    { label: "Natural frequency", math: tex`\omega_0 = \sqrt{k/m}` },
    {
      label: "Damping ratio",
      math: tex`\zeta = \dfrac{c}{2\sqrt{km}}`,
      note: "ζ < 1 bounces, ζ = 1 is critical (fastest settle, no overshoot), ζ > 1 is sluggish.",
    },
    {
      label: "Steady-state amplitude",
      math: tex`A = \dfrac{F_0}{\sqrt{(k - m\omega^2)^2 + (c\omega)^2}}`,
    },
    { label: "Stored elastic energy", math: tex`U = \tfrac{1}{2} k x^2` },
  ],
  rules: [
    "Tune springs by frequency and damping ratio, not by raw k and c: pick `ω₀` (2–8 Hz feels snappy for UI) and `ζ` (0.4–0.7 for a playful bounce, 1.0 for a camera), then derive `k = mω₀²` and `c = 2ζ√(km)`.",
    "Use semi-implicit (symplectic) Euler: update velocity first, then position with the new velocity. Explicit Euler gains energy and blows up.",
    "Step at a fixed rate (120 Hz is plenty) and keep `ω₀·dt` well under 1; stiff springs need smaller steps or an analytic/implicit solver.",
    "Resonance is sharp when damping is small: at ζ = 0.05 the peak is about 10× the static deflection `F₀/k`.",
  ],
  code: [
    {
      lang: "ts",
      caption: "A critically-tunable spring for any value (camera, UI, bone):",
      code: `export class Spring {
  x = 0
  v = 0
  constructor(public freqHz = 4, public zeta = 0.5) {}

  /** Advance toward target with a fixed step; call from a fixed-timestep loop. */
  step(target: number, dt: number) {
    const w = 2 * Math.PI * this.freqHz
    const k = w * w // m = 1
    const c = 2 * this.zeta * w
    const a = -k * (this.x - target) - c * this.v
    this.v += a * dt // semi-implicit: velocity first
    this.x += this.v * dt
    return this.x
  }
}

// const camY = new Spring(3, 1) // critically damped follow
// camera.position.y = camY.step(player.position.y, 1 / 120)`,
    },
  ],
  mistakes: [
    "Writing position before velocity (explicit Euler). The oscillation slowly gains energy and the spring eventually explodes.",
    "Scaling stiffness with frame time instead of using a fixed step, so the bounce looks different at 30 and 144 FPS.",
    "Tuning k and c by hand: doubling the mass silently changes both the frequency and the damping ratio.",
    "Driving an undamped spring at its own frequency (e.g. a periodic footstep shake) and watching the amplitude grow without limit.",
  ],
  reading: [
    {
      title: "OpenStax University Physics — Forced Oscillations",
      url: "https://openstax.org/books/university-physics-volume-1/pages/15-6-forced-oscillations",
    },
    {
      title: "Gaffer On Games — Integration Basics",
      url: "https://gafferongames.com/post/integration_basics/",
    },
  ],
  visual:
    "The orange block rides a cyan spring around the dashed rest line, and the orange trace above records its displacement over time. The default drive sits near resonance (ω ≈ ω₀); move the drive frequency away, or raise damping, and the steady amplitude in the readout drops.",
}

export default sheet
