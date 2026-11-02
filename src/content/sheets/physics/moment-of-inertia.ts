import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "moment-of-inertia",
  category: "physics",
  subcategory: "mechanics",
  title: "Moment of Inertia",
  hook: "rotational mass: how far out the weight sits decides how hard it spins",
  summary:
    "Rotational mass: I = Σmr² grows with distance squared, so spread-out mass spins up slowly. Covers τ = Iα, L = Iω and the inertia tensor.",
  level: "common",
  tags: [
    "rotation",
    "torque",
    "angular-momentum",
    "inertia-tensor",
    "rigid-body",
  ],
  updated: "2026-11-02",
  prompt:
    "Write a TypeScript rigid-body rotation module for Three.js. Inputs: box mass and full sizes (w, h, d), a world-space torque, and a fixed timestep. Precompute the diagonal inverse local tensor with Ix = m(h²+d²)/12, Iy = m(w²+d²)/12, Iz = m(w²+h²)/12, using zero for a static body so it never divides by zero. Each step: rebuild I_world⁻¹ = R·I_local⁻¹·Rᵀ from the current quaternion, add torque·dt to the stored angular momentum L, set ω = I_world⁻¹·L, then rotate the quaternion by |ω|·dt about ω and normalise it. Handle |ω| near 0 without producing NaN. Unit tests: a cube (w = h = d) has the same response to torque on every axis at any orientation; with no torque, a tumbling non-cubic box keeps L constant while ω changes; a static body never rotates.",
  related: [
    "rigid-body-dynamics",
    "balancing-torque",
    "quaternions",
    "transforms-and-matrices",
    "impulse-and-momentum",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "**Moment of inertia** `I` is mass for rotation. Newton's `F = ma` becomes `τ = Iα`: the same torque `τ` produces less angular acceleration `α` as `I` grows. Every bit of mass contributes `m·r²`, where `r` is its distance from the axis, so where the mass sits matters more than how much there is. A [torque](/physics/mechanics/balancing-torque) that spins up two 1 kg masses 0.5 m from the axis (`I = 0.5`) spins up the same masses at 1.8 m (`I = 6.48`) about 13 times more slowly.",
    "**Angular momentum** `L = Iω` stays constant when no net torque acts. A skater pulling in their arms lowers `I`, so `ω` must rise to keep `L` fixed. Rotational energy `L²/2I` goes up too, and the extra comes from the work done pulling the arms in.",
    "In 3D, `I` depends on the axis, so it becomes a 3×3 **inertia tensor**. In the body's own axes it is constant, and for a box or a sphere it is diagonal. A [rigid-body](/physics/mechanics/rigid-body-dynamics) engine therefore stores the inverse tensor in local space and transforms it to world space whenever orientation changes, using the [rotation matrix](/mathematics/transforms/transforms-and-matrices) built from the body's [quaternion](/mathematics/rotations/quaternions). Storing the inverse saves a matrix inversion and lets a static body use all zeros.",
    "Compound objects add up, but only about a shared axis. The **parallel axis theorem** moves each part's inertia from its own centre of mass to the axis you need, which is how a long sword gets its swing weight and why a door pivots more sluggishly than the same slab spun about its middle.",
  ],
  formulas: [
    {
      label: "Rotational Newton's law",
      math: tex`\textcolor{#ff6467}{\tau} = I \alpha`,
    },
    {
      label: "Moment of inertia of point masses",
      math: tex`I = \sum_i \textcolor{#fafafa}{m_i} r_i^2`,
    },
    {
      label: "Angular momentum",
      math: tex`L = I \textcolor{#fdc700}{\omega}`,
      note: "With no net torque, L is constant: I₁ω₁ = I₂ω₂.",
    },
    {
      label: "Solid sphere, through its centre",
      math: tex`I = \tfrac{2}{5} m r^2`,
    },
    {
      label: "Solid cylinder, about its long axis",
      math: tex`I = \tfrac{1}{2} m r^2`,
    },
    {
      label: "Solid box, axis perpendicular to the w × h face",
      math: tex`I = \tfrac{1}{12} m \left(w^2 + h^2\right)`,
      note: "w and h are full sizes, not half extents.",
    },
    {
      label: "Thin rod, through its centre and through one end",
      math: tex`I_{\text{centre}} = \tfrac{1}{12} m L^2 \qquad I_{\text{end}} = \tfrac{1}{3} m L^2`,
    },
    {
      label: "Parallel axis theorem",
      math: tex`I = I_{\text{cm}} + m d^2`,
      note: "d is the distance between the centre-of-mass axis and the parallel axis. The rod's end value follows from its centre value with d = L/2.",
    },
    {
      label: "Inverse inertia tensor in world space",
      math: tex`I_{\text{world}}^{-1} = R \, I_{\text{local}}^{-1} \, R^{\mathsf{T}}`,
      note: "R is the body's rotation matrix, from local to world.",
    },
  ],
  rules: [
    "Doubling the distance quadruples `I`; doubling the mass only doubles it.",
    "For the same `m` and `r`, ordering by `I/mr²`: solid sphere 0.4, solid cylinder 0.5, hollow sphere 0.67, thin hoop 1.",
    "A 1 kg, 1 m cube has `I = 1/6 ≈ 0.167 kg·m²` about any axis through its centre.",
    "Use a box or capsule approximation for irregular meshes. Players notice wrong mass distribution far less than they notice jitter.",
    "Thin ragdoll limbs have tiny `I` and can jitter. Inflating their inertia about 2–3× is a common way to stabilise them.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Local inverse tensor of a box, and the world-space transform:",
      code: `import * as THREE from "three"

/** Diagonal of the inverse local tensor for full box sizes w, h, d. */
export function boxInverseInertia(m: number, w: number, h: number, d: number) {
  return new THREE.Vector3(
    12 / (m * (h * h + d * d)),
    12 / (m * (w * w + d * d)),
    12 / (m * (w * w + h * h)),
  )
}

const m4 = new THREE.Matrix4()
const R = new THREE.Matrix3()
const Rt = new THREE.Matrix3()
const D = new THREE.Matrix3()

/** out = R · diag(invLocal) · Rᵀ */
export function inverseInertiaWorld(
  q: THREE.Quaternion,
  invLocal: THREE.Vector3,
  out: THREE.Matrix3,
) {
  R.setFromMatrix4(m4.makeRotationFromQuaternion(q))
  Rt.copy(R).transpose()
  D.set(invLocal.x, 0, 0, 0, invLocal.y, 0, 0, 0, invLocal.z)
  return out.multiplyMatrices(R, D).multiply(Rt)
}`,
    },
    {
      lang: "ts",
      caption:
        "One fixed step. Storing L instead of ω makes a torque-free tumble conserve angular momentum:",
      code: `const invWorld = new THREE.Matrix3()
const axis = new THREE.Vector3()
const dq = new THREE.Quaternion()

export function stepRotation(
  body: { q: THREE.Quaternion; L: THREE.Vector3; invLocal: THREE.Vector3 },
  torque: THREE.Vector3, // world space
  omega: THREE.Vector3, // written: world-space angular velocity
  dt: number,
) {
  body.L.addScaledVector(torque, dt)
  inverseInertiaWorld(body.q, body.invLocal, invWorld)
  omega.copy(body.L).applyMatrix3(invWorld) // ω = I⁻¹ L
  const speed = omega.length()
  if (speed > 1e-9) {
    axis.copy(omega).divideScalar(speed)
    body.q.premultiply(dq.setFromAxisAngle(axis, speed * dt)).normalize()
  }
}`,
    },
  ],
  mistakes: [
    "Applying the local inverse tensor to a world-space torque. It looks fine until the body rotates, and then it spins about the wrong axis.",
    "Writing `Rᵀ I⁻¹ R` for local to world. That order is the world-to-local transform.",
    "Using half extents in `m(w² + h²)/12`. With half extents `a` and `b`, the formula is `m(a² + b²)/3`.",
    "Adding the inertias of a compound body without the `m·d²` term. Each part must be moved to the shared centre of mass first.",
    "Assuming `ω` stays constant in free flight. In 3D `L` is what is conserved, so a tumbling box's `ω` keeps changing.",
  ],
  reading: [
    {
      title: "OpenStax University Physics: Calculating Moments of Inertia",
      url: "https://openstax.org/books/university-physics-volume-1/pages/10-5-calculating-moments-of-inertia",
    },
    {
      title: "OpenStax University Physics: Conservation of Angular Momentum",
      url: "https://openstax.org/books/university-physics-volume-1/pages/11-3-conservation-of-angular-momentum",
    },
    {
      title: "Chris Hecker: Rigid Body Dynamics articles",
      url: "https://www.chrishecker.com/Rigid_Body_Dynamics",
    },
  ],
  visual:
    "Both rotors carry the same two spheres (one white, one grey), and the thin grey circle marks their path. The solid red curved arrow is the equal torque on each, and the dashed yellow arc with its arrowhead shows the spin direction, growing longer with ω; the run restarts every 5 s. Move the mass radius to widen the right rotor, or turn on Conserve angular momentum to remove the torque and watch ω rise as the masses come in.",
}

export default sheet
