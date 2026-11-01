import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "em-wave-propagation",
  category: "physics",
  subcategory: "electromagnetism",
  title: "EM Wave Propagation",
  hook: "leapfrog E and B on a staggered grid",
  summary:
    "Light is E and B regenerating each other. A 1D Yee grid (FDTD) leapfrogs them in time, slows them in glass and blows up past the Courant limit.",
  level: "advanced",
  tags: ["maxwell", "fdtd", "yee-grid", "courant", "waves"],
  updated: "2026-11-01",
  prompt:
    "Write a 1D FDTD (Yee) electromagnetic solver in TypeScript for a Three.js visual. Use normalised units (c = 1, Δx = 1) with Float64Array Ey on n nodes, Hz on n−1 half nodes and a per-node relative permittivity array. stepFdtd(grid, S, sourceIndex, source(t)) updates H then E, adds a soft source, applies first-order Mur boundaries at both ends and allocates nothing. Render Ey along y and Hz along z by writing into existing line geometries each frame, clamping non-finite values. Tests: at S = 1 a matched Gaussian pulse moves exactly one cell per step; at S = 0.5 the energy after the pulse exits is < 2% of the start (Mur absorbs); at S = 1.1 energy exceeds 1e6 within 400 steps.",
  related: ["electric-field-lines", "sound-waves", "fixed-timestep"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "An electromagnetic wave is a changing electric field that creates a changing magnetic field, which creates the electric field again. In a plane wave E and B are perpendicular to each other and to the direction of travel, in phase, and move at `c = 1/√(με)`.",
    "The **finite-difference time-domain** (FDTD) method solves Maxwell's curl equations directly. Kane Yee's trick is to store E and H on grids offset by half a cell in space and half a step in time, so every derivative is a centred difference. Each step updates H from the spatial change of E, then E from the spatial change of H: a leapfrog.",
    "The scheme is explicit, so it has a stability limit. The **Courant number** `S = cΔt/Δx` must not exceed 1 in 1D (1/√2 in 2D, 1/√3 in 3D); above it, errors grow every step until the grid fills with garbage. Inside a dielectric with permittivity εr the wave slows by `√εr`, its wavelength shrinks, and part of it reflects at the boundary.",
    "The same leapfrog pattern runs water ripples, audio propagation and [sound waves](/physics/mechanics/sound-waves) in games; it is the grown-up version of the [fixed timestep](/systems/simulation/fixed-timestep) rule that stability depends on step size.",
  ],
  formulas: [
    {
      label: "Maxwell's curl equations (1D, Ey and Hz)",
      math: tex`\varepsilon\frac{\partial E_y}{\partial t} = -\frac{\partial H_z}{\partial x}, \qquad \mu\frac{\partial H_z}{\partial t} = -\frac{\partial E_y}{\partial x}`,
    },
    {
      label: "Yee update (normalised: c = 1, Δx = 1)",
      math: tex`H_{i+\frac12}^{n+\frac12} = H_{i+\frac12}^{n-\frac12} - S\,(E_{i+1}^n - E_i^n), \quad E_i^{n+1} = E_i^n - \frac{S}{\varepsilon_r}\,(H_{i+\frac12}^{n+\frac12} - H_{i-\frac12}^{n+\frac12})`,
    },
    {
      label: "Courant stability",
      math: tex`S = \frac{c\,\Delta t}{\Delta x} \le \frac{1}{\sqrt{d}}`,
      note: "d = number of spatial dimensions.",
    },
    {
      label: "Speed and wavelength in a dielectric",
      math: tex`v = \frac{c}{\sqrt{\varepsilon_r}}, \qquad \lambda = \frac{\lambda_0}{\sqrt{\varepsilon_r}}`,
    },
    {
      label: "Mur absorbing boundary (first order)",
      math: tex`E_0^{n+1} = E_1^{n} + \frac{S-1}{S+1}\left(E_1^{n+1} - E_0^{n}\right)`,
    },
  ],
  rules: [
    "Resolve the shortest wavelength (inside the densest material) with at least 10–20 cells, or numerical dispersion slows short waves.",
    "Use S ≈ 0.9 of the limit; in 1D, S = 1 is the 'magic time step' where a pulse moves exactly one cell per step with zero dispersion.",
    "Ramp a sinusoidal source over 1–2 periods; switching it on instantly launches a broadband spike.",
    "A soft source (add to E) lets reflected waves pass through it; a hard source (overwrite E) reflects them.",
    "Without an absorbing boundary the grid ends are perfect mirrors and you get standing waves.",
  ],
  code: [
    {
      lang: "ts",
      caption: "One 1D Yee step with a soft source and Mur boundaries:",
      code: `export function step(ey: Float64Array, hz: Float64Array, eps: Float64Array,
                     S: number, src: number, value: number, mur: Float64Array) {
  const n = ey.length
  mur[0] = ey[0]; mur[1] = ey[1]; mur[2] = ey[n - 1]; mur[3] = ey[n - 2]
  for (let i = 0; i < n - 1; i++) hz[i] -= S * (ey[i + 1] - ey[i])
  for (let i = 1; i < n - 1; i++) ey[i] -= (S / eps[i]) * (hz[i] - hz[i - 1])
  ey[src] += value // soft source
  const m = (S - 1) / (S + 1)
  ey[0] = mur[1] + m * (ey[1] - mur[0])
  ey[n - 1] = mur[3] + m * (ey[n - 2] - mur[2])
}`,
    },
  ],
  mistakes: [
    "Storing E and H at the same grid points and times, which loses the second-order accuracy and the stability of the staggered scheme.",
    "Picking Δt from the frame rate instead of from the Courant limit; a slow frame then makes S > 1 and the sim explodes.",
    "Checking stability with the slow speed inside a dielectric. The limit is set by the fastest wave on the grid (vacuum).",
    "Forgetting an absorbing boundary and mistaking the resulting standing wave for physics.",
  ],
  reading: [
    {
      title: "OpenStax University Physics Vol. 2 — Plane Electromagnetic Waves",
      url: "https://openstax.org/books/university-physics-volume-2/pages/16-2-plane-electromagnetic-waves",
    },
    {
      title:
        "John B. Schneider — Understanding the FDTD Method (free textbook)",
      url: "https://eecs.wsu.edu/~schneidj/ufdtd/",
    },
  ],
  visual:
    "Cyan is the electric field Ey (vertical), violet the magnetic field Hz (horizontal), launched from the orange source and absorbed at both ends; the translucent block is a dielectric slab. Raise εr to slow and shorten the wave inside the slab, and push the Courant number past 1 to watch the explicit scheme blow up.",
}

export default sheet
