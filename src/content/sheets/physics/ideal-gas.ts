import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "ideal-gas",
  category: "physics",
  subcategory: "thermodynamics",
  title: "Ideal Gas Kinetics",
  hook: "pressure is just particles bouncing off walls",
  summary:
    "Temperature is average kinetic energy and pressure is momentum delivered to the walls. Bounce point particles in a box and PV = NkT falls out.",
  level: "core",
  tags: [
    "kinetic-theory",
    "pressure",
    "temperature",
    "particles",
    "maxwell-boltzmann",
  ],
  updated: "2026-11-01",
  prompt:
    "Build an ideal-gas box in TypeScript with Three.js. Create N ≤ 300 particles with uniform positions and Gaussian unit-temperature velocities from a seeded mulberry32 + Box–Muller generator. Each 1/120 s fixed step, advance positions by v·√T·dt, reflect specularly off the walls of a box whose width is adjustable, and return the summed wall impulse 2|v⊥|. Render with one InstancedMesh, colouring each instance from slow (cyan) to fast (orange), with no per-frame allocation. Tests: over 40,000 steps the measured pressure impulse/(area·time) matches N·T_kin/V within 3%, and 2,000 seeded particles have kinetic temperature ≈ 1.",
  related: ["boltzmann-distribution", "heat-diffusion", "particle-system"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "An ideal gas is a crowd of tiny particles that never interact except by bouncing elastically off the container. Every bounce reverses one velocity component and hands the wall a momentum of `2m|v⊥|`. Add up those impulses per second per square metre and you get **pressure**.",
    "**Temperature** is the average kinetic energy per particle: `½m⟨v²⟩ = (3/2)kT`. Double T and the root-mean-square speed grows by √2, particles hit walls more often and harder, and pressure doubles. Halve the volume and the same particles hit each wall twice as often. That is the whole of `PV = NkT`, recovered from mechanics.",
    "Velocities in equilibrium follow the Maxwell–Boltzmann distribution: each component is a Gaussian with variance `kT/m`. Seeding a sim with Gaussian velocities from a proper PRNG gives the right spread of speeds from the first frame.",
    "For games this is the template for every cheap [particle system](/systems/patterns/particle-system) with box collisions: integrate positions at a [fixed timestep](/systems/simulation/fixed-timestep), reflect on walls, and measure aggregate quantities instead of tracking every interaction. Real gases add collisions between particles, which needs [spatial partitioning](/performance/world/spatial-partitioning).",
  ],
  formulas: [
    { label: "Ideal gas law", math: tex`PV = N k_B T` },
    {
      label: "Temperature from kinetic energy",
      math: tex`\tfrac{1}{2} m \langle v^2 \rangle = \tfrac{3}{2} k_B T`,
    },
    {
      label: "RMS speed",
      math: tex`v_{\text{rms}} = \sqrt{\frac{3 k_B T}{m}}`,
    },
    {
      label: "Pressure from wall impulses",
      math: tex`P = \frac{1}{A\,\Delta t}\sum_{\text{hits}} 2 m |v_\perp|`,
    },
    {
      label: "Maxwell–Boltzmann velocity component",
      math: tex`v_x \sim \mathcal{N}\!\left(0, \frac{k_B T}{m}\right)`,
    },
  ],
  rules: [
    "Room-temperature nitrogen: v_rms ≈ 517 m/s. In sim units set m = k_B = 1 so v_rms = √(3T).",
    "Store unit-temperature velocities and scale by √T when stepping; changing the temperature slider then rescales speeds instantly and correctly.",
    "Reflect position about the wall (`p = 2b − p`) and flip the velocity; just clamping loses distance and biases pressure.",
    "Average pressure over ~1–2 s of hits; with 100–300 particles single-frame readings are noisy.",
    "300 instanced spheres at 120 Hz is trivial; per-particle collisions are where costs explode (O(N²) without a grid).",
  ],
  code: [
    {
      lang: "ts",
      caption: "Box step that also measures pressure (m = k = 1):",
      code: `export function stepGas(pos: Float32Array, vel: Float32Array, n: number,
                        dt: number, T: number, half: [number, number, number]) {
  const s = Math.sqrt(T) // vel holds unit-temperature velocities
  let impulse = 0
  for (let i = 0; i < n * 3; i++) {
    const b = half[i % 3]
    const v = vel[i] * s
    let p = pos[i] + v * dt
    if (p > b || p < -b) {
      p = 2 * (p > 0 ? b : -b) - p // specular reflection
      vel[i] = -vel[i]
      impulse += 2 * Math.abs(v)
    }
    pos[i] = p
  }
  const area = 8 * (half[0] * half[1] + half[1] * half[2] + half[0] * half[2])
  return impulse / (area * dt) // instantaneous pressure; average it
}`,
    },
  ],
  mistakes: [
    "Seeding random velocities with a weak or correlated generator (e.g. an LCG seeded with the particle index), which gives nearly identical speeds instead of a Maxwellian spread.",
    "Using uniform random velocities: the mean energy can be right but the speed distribution is wrong.",
    "Clamping particles to the wall without reflecting, which slowly drains kinetic energy.",
    "Comparing measured pressure with NkT/V using the slider temperature instead of the gas's actual kinetic temperature for a small N.",
  ],
  reading: [
    {
      title:
        "OpenStax University Physics Vol. 2 — Pressure, Temperature, and RMS Speed",
      url: "https://openstax.org/books/university-physics-volume-2/pages/2-2-pressure-temperature-and-rms-speed",
    },
  ],
  visual:
    "Particles are coloured by speed from cyan (slow) to orange (fast) inside a translucent box; the right wall is a piston that glows yellow with the measured pressure. Raise temperature or particle count, or narrow the box, and watch the glow and the P = NkT/V readout rise together.",
}

export default sheet
