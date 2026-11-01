import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "gravitational-waves",
  category: "physics",
  subcategory: "relativity",
  title: "Gravitational Waves",
  hook: "orbiting masses shake spacetime at twice their orbit rate",
  summary:
    "A compact binary radiates gravitational waves at twice its orbital frequency; chirp mass and distance set a strain of around 10⁻²¹ or smaller.",
  level: "advanced",
  tags: ["relativity", "gravitational-waves", "binary", "chirp-mass", "strain"],
  updated: "2026-11-01",
  prompt:
    "Write TypeScript utilities chirpMass(m1, m2) and strain(m1, m2, distance, fGW) for the leading-order gravitational-wave amplitude h = (4/r)(GM_c/c²)^{5/3}(πf/c)^{2/3}, computed in log space, plus keplerSeparation(m1, m2, fOrb). Then build a Three.js visual: a ≤ 64² PlaneGeometry updated in place each frame whose height combines two clamped −m/r wells at the barycentric positions of the binary and an exaggerated strain h ∝ cos(2Φ − 2φ − kr)/r, coloured by h; cap the displayed orbit rate at 0.6 Hz. Unit-test that the chirp mass of two 1.4 M☉ stars ≈ 1.219 M☉, that h ∝ 1/r and ∝ f^{2/3}, and that strain returns 0 at f = 0.",
  related: ["mass-effect", "mercury-precession", "em-wave-propagation"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "When masses accelerate asymmetrically, as two stars or black holes in a tight orbit do, the changing curvature travels outward at the speed of light. A passing wave stretches distances along one axis and squeezes them along the perpendicular one. The fractional change in length is the **strain** `h`.",
    "A binary looks the same after half an orbit, so its quadrupole pattern repeats twice per orbit and **f_GW = 2 f_orb**. The amplitude depends on the masses only through the **chirp mass** `M_c` and falls off as 1/distance. As the system loses energy the orbit shrinks and the frequency and amplitude rise together: the characteristic chirp.",
    "Even the loudest events arrive with `h ~ 10⁻²¹`: a 4 km detector arm changes length by about 1/400 of a proton width. The visual shows the binary's potential wells (see [mass effect](/physics/relativity/mass-effect)) plus a strongly exaggerated, phase-locked spiral of strain. The physical numbers are in the readout.",
  ],
  formulas: [
    {
      label: "Chirp mass",
      math: tex`\mathcal{M}_c = \frac{(m_1 m_2)^{3/5}}{(m_1 + m_2)^{1/5}}`,
    },
    {
      label: "Strain amplitude (circular, leading order)",
      math: tex`h \approx \frac{4}{r}\left(\frac{G\mathcal{M}_c}{c^2}\right)^{5/3}\left(\frac{\pi f_{\text{GW}}}{c}\right)^{2/3}`,
    },
    {
      label: "Separation from Kepler's third law",
      math: tex`a = \left(\frac{G(m_1+m_2)}{(2\pi f_{\text{orb}})^2}\right)^{1/3},\qquad f_{\text{GW}} = 2 f_{\text{orb}}`,
    },
    {
      label: "Chirp rate",
      math: tex`\dot f = \frac{96}{5}\,\pi^{8/3}\left(\frac{G\mathcal{M}_c}{c^3}\right)^{5/3} f^{11/3}`,
    },
    {
      label: "Wave pattern used in the visual",
      math: tex`h(r,\varphi,t) \propto \frac{1}{r}\cos\!\big(2\Phi(t) - 2\varphi - kr\big)`,
      note: "Φ is the orbital phase: the two-armed spiral rotates with the binary.",
    },
  ],
  rules: [
    "Two 1.4 M☉ neutron stars: M_c ≈ 1.22 M☉. At f_orb = 1 Hz they are ~2,100 km apart and h ≈ 2.6×10⁻²⁴ at 100 Mpc.",
    "Ground detectors hear ~10 Hz–few kHz. Space interferometers target ~0.1 mHz–0.1 Hz, the band of supermassive binaries.",
    "Compute h in log space: (GM_c/c²)^(5/3) and (πf/c)^(2/3) have very different magnitudes.",
    "Cap animation playback (here 0.6 orbits/s). A 100 Hz orbit drawn at 60 fps aliases into nonsense.",
  ],
  code: [
    {
      lang: "ts",
      caption:
        "Chirp mass and leading-order strain, computed in log space to avoid under/overflow:",
      code: `const G = 6.6743e-11, C = 299_792_458

export function chirpMass(m1: number, m2: number) {
  return Math.pow(m1 * m2, 3 / 5) / Math.pow(m1 + m2, 1 / 5)
}

// Masses in kg, distance in m, f = gravitational-wave frequency (2 × orbital).
export function strain(m1: number, m2: number, distance: number, f: number) {
  if (f <= 0) return 0
  const mc = chirpMass(m1, m2)
  const log =
    Math.log(4) +
    (5 / 3) * Math.log((G * mc) / (C * C)) +
    (2 / 3) * Math.log((Math.PI * f) / C) -
    Math.log(distance)
  return Math.exp(log)
}`,
    },
  ],
  mistakes: [
    "Using the orbital frequency where the gravitational-wave frequency (twice as high) is required.",
    "Drawing waves as a plane wave unrelated to the source. The pattern is a two-armed spiral locked to the orbit.",
    "Plotting physical strain directly. At 10⁻²¹ nothing moves on screen, so state the exaggeration factor.",
    "Multiplying (m1·m2)^(3/5) in kilograms directly. It is fine in doubles, but the full strain product is better taken in logs.",
  ],
  reading: [
    {
      title: "LIGO Caltech — What are Gravitational Waves?",
      url: "https://www.ligo.caltech.edu/page/what-are-gw",
    },
    {
      title:
        "OpenStax University Physics Vol. 1 — Einstein's Theory of Gravity",
      url: "https://openstax.org/books/university-physics-volume-1/pages/13-8-einsteins-theory-of-gravity",
    },
  ],
  visual:
    "The orange and yellow bodies orbit inside their potential wells, and the cyan-to-violet ripples are the exaggerated strain spiralling outward at twice the orbital rate. Change the two masses to shift the barycentre and deepen the wells, and the visual strain scale to exaggerate the ripples; the readout gives the real strain at 100 Mpc.",
}

export default sheet
