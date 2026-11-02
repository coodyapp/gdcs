import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "projectile-motion",
  category: "physics",
  subcategory: "mechanics",
  title: "Projectile Motion",
  hook: "constant sideways speed, steadily changing vertical speed",
  summary:
    "Launch angle, speed and gravity fully determine a ballistic arc: x moves at constant speed while y accelerates downward.",
  level: "core",
  tags: ["kinematics", "gravity", "ballistics", "trajectory"],
  updated: "2026-11-02",
  prompt:
    "Implement a projectile trajectory preview in TypeScript with Three.js. Given launch speed v0 (m/s), angle θ (radians) and gravity g, compute x(t)=v0·cosθ·t and y(t)=v0·sinθ·t−½gt², sample 64 points until it returns to launch height (T=2v0·sinθ/g), and draw them with THREE.Line. Also return range R=v0²·sin2θ/g and peak height H=(v0·sinθ)²/(2g). Keep angles in radians, make the sampler a pure function, and add a unit test checking that 30° and 60° give the same range.",
  related: ["fixed-timestep", "projectile-data-lab", "keplers-laws"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A projectile is any body moving under gravity alone. Split its velocity into components: the horizontal part `v0·cos θ` never changes (no drag), while the vertical part `v0·sin θ` loses `g` metres per second every second.",
    "Because the two axes are independent, the path is a parabola. Flight time, peak height and range all follow from the launch speed, angle and gravity, so you can predict a landing point before the shot happens.",
    "In games this is how grenades, arrows, jump arcs and aim-assist trajectory previews are computed. It is also the reference you check a [fixed timestep](/systems/simulation/fixed-timestep) integrator against.",
  ],
  formulas: [
    {
      label: "Horizontal position",
      math: tex`\textcolor{#fafafa}{x(t)} = \textcolor{#fdc700}{v_0} \cos\theta \, t`,
    },
    {
      label: "Vertical position",
      math: tex`\textcolor{#fafafa}{y(t)} = \textcolor{#fdc700}{v_0} \sin\theta \, t - \tfrac{1}{2} g t^2`,
    },
    {
      label: "Flight time (flat ground)",
      math: tex`T = \frac{2 v_0 \sin\theta}{g}`,
    },
    {
      label: "Range",
      math: tex`R = \frac{v_0^2 \sin 2\theta}{g}`,
      note: "Maximum at 45° on flat ground, with no drag.",
    },
    { label: "Peak height", math: tex`H = \frac{(v_0 \sin\theta)^2}{2g}` },
  ],
  rules: [
    "Complementary angles (30° and 60°) land at the same spot; the steeper one stays in the air longer.",
    "Earth `g = 9.81 m/s²`. Many platformers use 2–3× that for snappier jumps.",
    "To hit a target, solve the range equation for θ. Two solutions mean a low and a high lob.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Sample an arc for a trajectory preview (Three.js):",
      code: `import * as THREE from "three"

export function trajectory(v0: number, angle: number, g = 9.81, samples = 64) {
  const vx = v0 * Math.cos(angle)
  const vy = v0 * Math.sin(angle)
  const T = (2 * vy) / g
  const points: THREE.Vector3[] = []
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * T
    points.push(new THREE.Vector3(vx * t, vy * t - 0.5 * g * t * t, 0))
  }
  return new THREE.BufferGeometry().setFromPoints(points) // draw with THREE.Line
}`,
    },
  ],
  mistakes: [
    "Mixing degrees and radians: `Math.sin(45)` is not sin 45°.",
    "Integrating with explicit Euler at a variable frame rate, which makes the landing point depend on FPS.",
    "Forgetting launch height: the flat-ground formulas assume the projectile lands at the height it started from.",
    "Adding drag later and still trusting the analytic range. Once there is drag, simulate numerically.",
  ],
  reading: [
    {
      title: "OpenStax University Physics — Projectile Motion",
      url: "https://openstax.org/books/university-physics-volume-1/pages/4-3-projectile-motion",
    },
  ],
  visual:
    "The yellow ball follows the solid white arc (its path x(t), y(t)) and the dashed yellow line is its instantaneous velocity v. Change the angle, launch speed and gravity to reshape the arc; the readout shows flight time and range.",
}

export default sheet
