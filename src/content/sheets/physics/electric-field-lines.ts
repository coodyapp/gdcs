import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "electric-field-lines",
  category: "physics",
  subcategory: "electromagnetism",
  title: "Electric Field Lines",
  hook: "add every charge's push, then follow the arrows",
  summary:
    "Coulomb fields add as vectors; tracing streamlines along the net field draws lines that leave positive charges, end on negative ones and never cross.",
  level: "common",
  tags: [
    "electrostatics",
    "coulomb",
    "vector-field",
    "streamlines",
    "superposition",
  ],
  updated: "2026-11-01",
  prompt:
    "Write a TypeScript module for Three.js that draws 2D electric field lines for a list of point charges {x, y, q} (k = 1). Implement fieldAt(charges, x, y, out) with a softened r² (min 0.12) that writes into a reusable object, and traceLines(charges, linesPerUnitCharge = 12) that seeds round(12·|q|) lines on a 0.36-unit circle around each positive charge (or every charge if none is positive), steps 0.11 units along the normalised field (backwards for negative seeds), and stops near another charge (< 0.42), outside radius 6, after 110 steps or when |E| < 1e-4. Return flat Float32Arrays for THREE.Line. Add tests: the field at a dipole's midpoint points from + to −, falls as 1/r² from a single charge, and a line from + ends on −.",
  related: [
    "charged-particle-motion",
    "em-wave-propagation",
    "particle-system",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Every point charge creates a field that points straight away from it (or toward it, if negative) and weakens with the **square** of distance. With several charges you simply add the vectors: that is superposition, and it is the whole trick.",
    "A **field line** is a curve that is tangent to the net field everywhere. You draw one by starting just outside a positive charge and repeatedly taking a small step along the normalised field direction until the line reaches a negative charge or leaves the screen. Start a number of lines proportional to each charge and the line density shows field strength.",
    "Game uses: magnet and force-field abilities, homing projectiles that follow a potential, flow fields for crowds and particles (the same tracing as a [particle system](/systems/patterns/particle-system) advecting through a vector field), and debug views of any vector field. The same field drives the [charged particle motion](/physics/electromagnetism/charged-particle-motion) sheet.",
  ],
  formulas: [
    {
      label: "Field of point charges (superposition)",
      math: tex`\mathbf{E}(\mathbf{r}) = k \sum_i q_i \frac{\mathbf{r} - \mathbf{r}_i}{\lVert \mathbf{r} - \mathbf{r}_i \rVert^{3}}`,
      note: "k = 1/(4πε₀) ≈ 8.99 × 10⁹ N·m²/C². Scenes usually set k = 1.",
    },
    { label: "Force on a test charge", math: tex`\mathbf{F} = q\,\mathbf{E}` },
    {
      label: "Streamline step",
      math: tex`\mathbf{p}_{n+1} = \mathbf{p}_n \pm h\,\frac{\mathbf{E}(\mathbf{p}_n)}{\lVert \mathbf{E}(\mathbf{p}_n) \rVert}`,
      note: "+ from positive seeds, − when tracing backwards from negative seeds.",
    },
    {
      label: "Softened distance",
      math: tex`r^2 \rightarrow \max(r^2, \varepsilon)`,
      note: "Caps the field near a charge so nothing divides by zero.",
    },
  ],
  rules: [
    "Seed `≈ 12 × |q|` lines per charge, evenly spaced on a circle of radius ~0.3–0.4 units around it.",
    "Step size around 0.1 units and 80–120 steps per line; stop within ~0.4 units of another charge or 6 units from the origin.",
    "Like charges produce a **null point** between them where E = 0; stop tracing when |E| falls below ~1e-4.",
    "Normalise the step: stepping by raw E makes lines jump past charges where the field is huge.",
    "Trace once when charges change and cache the polylines; only animate markers along them per frame.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Field from point charges and one traced line (k = 1):",
      code: `type Charge = { x: number; y: number; q: number }

export function fieldAt(cs: Charge[], x: number, y: number) {
  let ex = 0, ey = 0
  for (const c of cs) {
    const dx = x - c.x, dy = y - c.y
    const r2 = Math.max(dx * dx + dy * dy, 0.12) // softening
    const s = c.q / (r2 * Math.sqrt(r2))
    ex += dx * s; ey += dy * s
  }
  return { ex, ey }
}

export function trace(cs: Charge[], seed: Charge, angle: number, h = 0.1) {
  const dir = seed.q > 0 ? 1 : -1
  let x = seed.x + 0.35 * Math.cos(angle), y = seed.y + 0.35 * Math.sin(angle)
  const pts = [x, y, 0]
  for (let i = 0; i < 100; i++) {
    const { ex, ey } = fieldAt(cs, x, y)
    const len = Math.hypot(ex, ey)
    if (len < 1e-4) break // null point
    x += (dir * h * ex) / len; y += (dir * h * ey) / len
    pts.push(x, y, 0)
    if (cs.some((c) => c !== seed && Math.hypot(x - c.x, y - c.y) < 0.4)) break
  }
  return pts // feed to THREE.BufferGeometry / drei <Line>
}`,
    },
  ],
  mistakes: [
    "Not normalising the step, so lines overshoot charges and wander off where the field is strong.",
    "Seeding a fixed number of lines per charge, which hides the fact that a 2q charge has twice the flux.",
    "Seeding from both charges of a dipole, which draws every line twice (once each way).",
    "Dividing by r² without softening: a seed that lands on a charge produces NaN and an invisible line.",
    "Re-tracing every line every frame when nothing moved; trace on change and cache.",
  ],
  reading: [
    {
      title: "OpenStax University Physics Vol. 2 — Electric Field Lines",
      url: "https://openstax.org/books/university-physics-volume-2/pages/5-6-electric-field-lines",
    },
  ],
  visual:
    "Cyan spheres are positive charges, rose spheres negative and grey neutral; yellow lines are traced field lines with orange markers flowing along E. Slide the right charge through zero to flip a dipole into two like charges, and change spacing and line density.",
}

export default sheet
