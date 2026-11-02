import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "damped-pendulum",
  category: "physics",
  subcategory: "mechanics",
  title: "Damped Pendulum",
  hook: "a sine-shaped pull back to the bottom, minus friction",
  summary:
    "A swinging weight pulled by sin θ: its period is only 2π√(L/g) for small swings, and damping decays the arc. Grapples, lamps and ropes in games.",
  level: "common",
  tags: ["pendulum", "oscillation", "damping", "nonlinear", "integration"],
  updated: "2026-11-02",
  prompt:
    "Implement a damped pendulum for a Three.js scene in TypeScript. State: angle θ (radians) and angular velocity ω. Each fixed 1/240 s step apply semi-implicit Euler to θ'' = −(g/L)·sin θ − b·θ'. Expose step(dt), reset(θ0), applyImpulse(j) and bobPosition(out: THREE.Vector3) relative to a pivot. Handle θ0 up to 179° and L > 0 validation. Write unit tests: for θ0 = 0.01 rad and b = 0 the measured period matches 2π√(L/g) within 0.5%, and for θ0 = 60° it is about 7% longer.",
  related: [
    "spring-mass-oscillator",
    "fixed-timestep",
    "delta-time",
    "projectile-motion",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A pendulum is a weight on a rigid rod or taut string. Gravity's component along the arc is `−g·sin θ`, so the angular equation is `θ'' = −(g/L)·sin θ`. Only for small angles, where `sin θ ≈ θ`, does it become a simple harmonic oscillator with period `2π√(L/g)` that is independent of amplitude.",
    "Release it from 60° and the real period is about 7% longer than that formula: the restoring force near the top is weaker than the linear model assumes, so a wide swing lags. A damping term `−b·θ'` (air drag, pivot friction) makes the amplitude shrink by `e^(−bt/2)`.",
    "In games the same equation drives grappling hooks, swinging lamps, chains, hanging signs and rope bridges. Integrate the full `sin θ` version in a [fixed timestep](/systems/simulation/fixed-timestep) loop; the small-angle shortcut breaks down exactly in the big, dramatic swings players notice.",
  ],
  formulas: [
    {
      label: "Equation of motion",
      math: tex`\ddot{\theta} = -\dfrac{g}{L}\sin\textcolor{#f5d547}{\theta} - b\,\dot{\theta}`,
    },
    {
      label: "Small-angle period",
      math: tex`\textcolor{#fafafa}{T_0} = 2\pi\sqrt{L/g}`,
    },
    {
      label: "Large-angle correction",
      math: tex`T \approx T_0\left(1 + \dfrac{\theta_0^2}{16} + \dfrac{11\,\theta_0^4}{3072}\right)`,
      note: "θ₀ in radians; within 0.1% up to about 70°.",
    },
    {
      label: "Amplitude decay (light damping)",
      math: tex`\theta_{\max}(t) \approx \theta_0\, e^{-bt/2}`,
    },
  ],
  rules: [
    "A 1 m pendulum on Earth ticks about once per second each way (T ≈ 2.0 s).",
    "The period scales with √L: four times the rope length doubles the swing time. Mass does not appear at all.",
    "Simulate the angle, not x/y, for a rigid rod; for a rope that can go slack, use a Verlet particle with a distance constraint instead.",
    "Use semi-implicit Euler at 120–240 Hz; explicit Euler makes an undamped pendulum swing higher every cycle.",
  ],
  code: [
    {
      lang: "ts",
      caption: "A swinging lamp: integrate θ, then place the mesh (Three.js):",
      code: `import * as THREE from "three"

export function makePendulum(pivot: THREE.Vector3, length: number, theta0: number) {
  let theta = theta0
  let omega = 0
  return {
    /** Fixed-step update; b is damping in 1/s. */
    step(dt: number, g = 9.81, b = 0.2) {
      omega += (-(g / length) * Math.sin(theta) - b * omega) * dt
      theta += omega * dt
    },
    place(bob: THREE.Object3D) {
      bob.position.set(
        pivot.x + length * Math.sin(theta),
        pivot.y - length * Math.cos(theta),
        pivot.z
      )
    },
    push(impulse: number) { omega += impulse / length }, // e.g. on hit
  }
}`,
    },
  ],
  mistakes: [
    "Using `θ` instead of `sin θ` for big swings: the motion looks too regular and too fast.",
    "Integrating with explicit Euler: with zero damping the amplitude grows until the pendulum loops over the top.",
    "Expressing damping per frame (`omega *= 0.99`), which makes the decay rate depend on frame rate. Use `exp(−b·dt)` or the `−b·ω` term.",
    "Mixing degrees and radians in `Math.sin`.",
  ],
  reading: [
    {
      title: "OpenStax University Physics — Pendulums",
      url: "https://openstax.org/books/university-physics-volume-1/pages/15-4-pendulums",
    },
    {
      title: "OpenStax University Physics — Damped Oscillations",
      url: "https://openstax.org/books/university-physics-volume-1/pages/15-5-damped-oscillations",
    },
  ],
  visual:
    "The solid yellow bob on the white rod is the full nonlinear pendulum (angle θ); the faint, translucent white ghost on a thin rod follows the small-angle model (period T₀) from the same release angle. At 60° the ghost pulls ahead each swing; drop the release angle below 15° and they move together. Damping shrinks both arcs inside the thin grey release arc.",
}

export default sheet
