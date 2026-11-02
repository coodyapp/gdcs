import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "charged-particle-motion",
  category: "physics",
  subcategory: "electromagnetism",
  title: "Charged Particle Motion",
  hook: "B bends, E pushes, together they drift",
  summary:
    "The Lorentz force curls a charge around magnetic field lines and crossed E and B make it drift sideways. Integrate it with Boris, not Euler.",
  level: "advanced",
  tags: ["lorentz-force", "magnetism", "integration", "boris", "rk4"],
  updated: "2026-11-02",
  prompt:
    "Implement charged-particle motion in TypeScript for a Three.js scene. Write three allocation-free steppers that mutate {x,y,z,vx,vy,vz}: explicit Euler, classic RK4 (module-level scratch Float64Array) and the Boris push, each taking uniform E and B tuples, q/m and dt. Drive them from a 120 Hz fixed-step accumulator, keep a 240-point trail in a Float32Array ring written into an existing line geometry, and restart the particle when it leaves a ±5 × ±3.4 box. Expose larmorRadius(v, B, qm) and exbDrift(E, B). Tests: Boris keeps speed within 1e-12 over 20,000 steps in pure B; RK4 orbit radius matches v/(qm·B) to 1e-3; Euler speed grows; the mean x-velocity over 20 whole periods with E = 0.3ŷ, B = 1.5ẑ equals 0.2.",
  related: ["electric-field-lines", "fixed-timestep", "mercury-precession"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A moving charge in a magnetic field feels a force `q·v × B` that is always perpendicular to its velocity. It changes the direction of motion but never the speed, so in a uniform field the particle circles at the **Larmor radius** `r = mv⊥/(|q|B)` with a period that does not depend on speed.",
    "Add an electric field perpendicular to B and the circle becomes a **cycloid** that drifts sideways at `E/B` in the direction of `E × B`, the same for positive and negative charges. That drift is why plasmas move across magnetic fields and why the particle in the visual walks to the right instead of falling along E.",
    "Numerically this is a great integrator test. Explicit Euler spirals outward because each step adds a little speed; RK4 is very accurate but slowly loses energy; the **Boris push** splits the electric kick in two and applies the magnetic part as an exact rotation, so speed is conserved to round-off at any step size. Run it at a [fixed timestep](/systems/simulation/fixed-timestep) so the orbit does not depend on frame rate.",
  ],
  formulas: [
    {
      label: "Lorentz force",
      math: tex`m\frac{d\textcolor{#f5d547}{\mathbf{v}}}{dt} = q\left(\textcolor{#a1a1aa}{\mathbf{E}} + \textcolor{#f5d547}{\mathbf{v}} \times \mathbf{B}\right)`,
    },
    {
      label: "Larmor radius and cyclotron frequency",
      math: tex`r_L = \frac{m v_\perp}{|q| B}, \qquad \omega_c = \frac{|q| B}{m}`,
    },
    {
      label: "E × B drift",
      math: tex`\mathbf{v}_d = \frac{\textcolor{#a1a1aa}{\mathbf{E}} \times \mathbf{B}}{B^2}`,
      note: "Independent of charge sign and mass.",
    },
    {
      label: "Boris rotation",
      math: tex`\mathbf{t} = \frac{q\mathbf{B}\,\Delta t}{2m},\; \mathbf{v}' = \mathbf{v}^- + \mathbf{v}^- \times \mathbf{t},\; \mathbf{v}^+ = \mathbf{v}^- + \frac{2\,\mathbf{v}' \times \mathbf{t}}{1 + t^2}`,
      note: "v⁻ and the final velocity each get half an electric kick qEΔt/(2m).",
    },
  ],
  rules: [
    "Keep `ω_c·Δt` below ~0.1 for a smooth trail (≥ 60 steps per gyration); Boris stays stable up to ω_c·Δt ≈ 2 but the phase drifts.",
    "With q/m = 1 and B = 1.4 the period is 2π/1.4 ≈ 4.5 s; speed the sim up 2× for readable motion.",
    "Start the particle at the guiding centre offset `(v − E/B)/B` so the cycloid stays centred on screen.",
    "Pick E perpendicular to B to see pure drift; any E component along B accelerates the particle without limit.",
    "Need energy conservation over minutes of play (orbits, magnets, tractor beams)? Use Boris or another symplectic method, not RK4.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Allocation-free Boris push (call at a fixed rate):",
      code: `type P = { x: number; y: number; z: number; vx: number; vy: number; vz: number }
type V3 = readonly [number, number, number]

export function boris(p: P, E: V3, B: V3, qm: number, dt: number) {
  const h = 0.5 * qm * dt
  let vx = p.vx + h * E[0], vy = p.vy + h * E[1], vz = p.vz + h * E[2]
  const tx = h * B[0], ty = h * B[1], tz = h * B[2]
  const f = 2 / (1 + tx * tx + ty * ty + tz * tz)
  const px = vx + (vy * tz - vz * ty)
  const py = vy + (vz * tx - vx * tz)
  const pz = vz + (vx * ty - vy * tx)
  vx += f * (py * tz - pz * ty)
  vy += f * (pz * tx - px * tz)
  vz += f * (px * ty - py * tx)
  p.vx = vx + h * E[0]; p.vy = vy + h * E[1]; p.vz = vz + h * E[2]
  p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt
}`,
    },
  ],
  mistakes: [
    "Integrating v × B with explicit Euler: the orbit spirals outward and the particle gains energy from nothing.",
    "Assuming the particle drifts along E. In crossed fields it drifts along E × B, perpendicular to both.",
    "Getting the cross-product order wrong (B × v), which reverses the direction of rotation.",
    "Stepping with the render delta: the gyration radius then depends on frame rate.",
    "Allocating a new Vector3 per step for v × B inside the render loop.",
  ],
  reading: [
    {
      title:
        "OpenStax University Physics Vol. 2 — Motion of a Charged Particle in a Magnetic Field",
      url: "https://openstax.org/books/university-physics-volume-2/pages/11-3-motion-of-a-charged-particle-in-a-magnetic-field",
    },
    {
      title: "Gaffer On Games — Integration Basics",
      url: "https://gafferongames.com/post/integration_basics/",
    },
  ],
  visual:
    "The yellow charge leaves a solid white trail and the dashed yellow stub is its velocity v; faint grey arrows show the electric field E (pointing up) and grey dots show B coming out of the screen. Change E, B and speed, and switch the integrator to explicit Euler to watch the orbit spiral outward.",
}

export default sheet
