import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "quantization",
  category: "networking",
  subcategory: "scaling",
  title: "Quantization and Smallest-Three Quaternions",
  hook: "send a small integer instead of a float in a known range",
  summary:
    "Map a float in a known range to an integer with only the bits you need, and pack a rotation as its smallest three components: 28 bytes shrink to about 9.",
  level: "advanced",
  tags: [
    "netcode",
    "bandwidth",
    "compression",
    "quaternion",
    "smallest three",
    "bit packing",
  ],
  updated: "2026-11-02",
  prompt:
    "Write a TypeScript module for network pose compression, on plain numbers and [x, y, z, w] tuples with no Three.js dependency. quantize(x, min, max, bits) cuts the range into 2^bits equal bins and returns the bin index, clamping values outside the range and sending NaN to bin 0. dequantize(i, min, max, bits) returns the bin centre. bitsFor(range, maxError) returns ceil(log2(range / (2 * maxError))), floored at 0. encodeQuat(q, bits) finds the largest component by absolute value, negates the whole quaternion if that component is negative, and returns its index plus the other three quantized in ±1/√2. decodeQuat(encoded, bits) rebuilds the dropped component as sqrt(max(0, 1 - a² - b² - c²)) and normalizes. Both accept an output object so they allocate nothing per frame. Add Vitest tests: error never exceeds half a step in range; values past either edge clamp to the last bins; bitsFor meets the asked error and one bit fewer does not; q and -q decode to the same rotation with identical bits; ties such as (1/√2, -1/√2, 0, 0) round-trip; and a seeded search at 9 bits, including bin edges near (½, ½, ½, ½), finds a worst angle of about 0.55°.",
  related: [
    "quaternions",
    "snapshot-interpolation",
    "interest-management",
    "client-side-prediction",
    "dead-reckoning",
    "state-sync-and-delta-compression",
    "bandwidth-budgeting",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A 32-bit float can hold any value from tiny to astronomical, but a player's x coordinate is somewhere inside the map and only needs to be right to a millimetre or so. If both ends know the range, you can cut it into `2^bits` equal bins and send the bin number. The receiver decodes to the centre of that bin, so the error is at most **half a step**, and each extra bit halves it. Saving one bit per value matters because the savings multiply by every entity and every snapshot.",
    "**Smallest three** does the same for rotations, using two facts about a [unit quaternion](/mathematics/rotations/quaternions). Its length is 1, so any one component can be rebuilt from the other three, and the largest one is the most accurate to rebuild. Once that largest component is gone, no remaining one can exceed `1/√2`, because two equal components at that size already use up the whole length. So you send a 2-bit index plus three values in `±0.7071`.",
    "**Why the sign has to be restored.** The decoder rebuilds the missing component with a square root, which is always positive. `q` and `-q` are the same rotation, so when the largest component is negative the encoder negates all four before sending. Skip that and the other three are sent with the wrong sign relative to the rebuilt one: the run below comes back 90° wrong.",
    "Both ends must agree on every range and bit count, because nothing on the wire says what they were. Quantization is also lossy on purpose: the receiver sees a lattice, not the path. [Snapshot interpolation](/networking/netcode/snapshot-interpolation) hides the steps when they are small enough, and [client-side prediction](/networking/netcode/client-side-prediction) has to treat differences within the error as a match.",
  ],
  formulas: [
    {
      label: "Encode, with clamping",
      math: tex`i = \min\!\left(2^b - 1,\ \left\lfloor \frac{x - x_{\min}}{R}\, 2^b \right\rfloor\right), \quad R = x_{\max} - x_{\min}`,
      note: "Values below the range land in bin 0.",
    },
    {
      label: "Decode to the bin centre",
      math: tex`\textcolor{#fdc700}{\hat{x}} = x_{\min} + \left(i + \tfrac{1}{2}\right) s, \quad s = \frac{R}{2^b}, \quad \textcolor{#ff6467}{|\hat{x} - x|} \le \frac{s}{2}`,
    },
    {
      label: "Bits for a target error",
      math: tex`b = \left\lceil \log_2 \frac{R}{2\,\textcolor{#ff6467}{e}} \right\rceil`,
      note: "Doubling the range or halving the error costs one bit. Exact for bin centres; see the rounding mistake below.",
    },
    {
      label: "Smallest three",
      math: tex`\textcolor{#fdc700}{q_{\text{big}}} = \sqrt{1 - a^2 - b^2 - c^2}, \quad a, b, c \in \left[-\tfrac{1}{\sqrt{2}},\ \tfrac{1}{\sqrt{2}}\right]`,
      note: "Cost: 2 + 3b bits for b bits per component.",
    },
    {
      label: "Worst rotation error",
      math: tex`\textcolor{#ff6467}{\theta_{\max}} \approx \frac{2\sqrt{6}}{2^b}\ \text{rad} \approx \frac{281^\circ}{2^b}`,
      note: "First-order estimate, at q close to (½, ½, ½, ½). Within 1% of a seeded search from 4 to 14 bits; it fails below that (the search finds 45° at 3 bits, not 35°).",
    },
  ],
  rules: [
    "Size each field from its tolerance. A 64-unit axis at 1 mm needs `⌈log₂(64 / 0.002)⌉` = 15 bits, which gives a 1.95 mm step and 0.98 mm of error.",
    "The whole pose then costs 3 × 15 + 2 + 3 × 9 = 74 bits, or 9.25 bytes, against 28 bytes for seven 32-bit floats: about 3 times smaller, per entity, per snapshot.",
    "Half a step is per axis. The worst 3D position error is `√3` times that, so 0.98 mm per axis can reach 1.69 mm.",
    "Worst rotation error, measured: 17.6° at 4 bits, 0.55° at 9, 0.275° at 10 and 0.069° at 12. Test at the worst case, not at random: a million uniform rotations at 9 bits only found about 0.47°, because the peak needs all four components close to ½.",
    "Translate angle into distance for your longest object. 0.55° moves a point 10 m from the pivot by 96 mm, which is fine on a crate and not on a sniper's aim line.",
    "Starting points, not rules: Gaffer On Games settled on 9 bits per component and 512 values per metre for a cube simulation drawn with snapshot interpolation, then needed 15 bits and 4096 per metre once the quantized state was fed back into extrapolating simulations. Tune by eye against your own game.",
    "Give each axis its own range when the world is not a cube. That same simulation used 18 bits each for the horizontal axes and 14 for height: 50 bits for position, down from 96.",
    "Smallest three beats the obvious packing: a million random rotations reached 0.87° with 8.8.8.8 (32 bits) and about 0.47° with 2 + 9 + 9 + 9 (29 bits).",
    "Set your [prediction](/networking/netcode/client-side-prediction) correction threshold above the worst error, or the client will correct against the rounding on every update.",
    "Smallest three is for transport. Gaffer On Games found it numerically unstable when writing a fixed-point rotation predictor on top of it, and would not use it for that again.",
  ],
  code: [
    {
      lang: "ts",
      caption: "A float in a known range:",
      code: `function quantize(x: number, min: number, max: number, bits: number) {
  const t = (x - min) / (max - min)
  if (!(t > 0)) return 0 // also catches NaN
  return Math.min(2 ** bits - 1, Math.floor(t * 2 ** bits))
}

function dequantize(i: number, min: number, max: number, bits: number) {
  return min + ((i + 0.5) * (max - min)) / 2 ** bits
}

const bitsFor = (range: number, maxError: number) =>
  Math.max(0, Math.ceil(Math.log2(range / (2 * maxError))))`,
    },
    {
      lang: "ts",
      caption: "A rotation as its smallest three:",
      code: `const M = Math.SQRT1_2

function encodeQuat(q: Quat, bits: number) {
  let dropped = 0
  for (let i = 1; i < 4; i++)
    if (Math.abs(q[i]) > Math.abs(q[dropped])) dropped = i
  const sign = q[dropped] < 0 ? -1 : 1 // -q is the same rotation
  const values = [0, 1, 2, 3]
    .filter((i) => i !== dropped)
    .map((i) => quantize(q[i] * sign, -M, M, bits))
  return { dropped, values }
}

function decodeQuat({ dropped, values }: Encoded, bits: number) {
  const kept = values.map((i) => dequantize(i, -M, M, bits))
  const sum = kept.reduce((total, c) => total + c * c, 0)
  const q = [...kept]
  q.splice(dropped, 0, Math.sqrt(Math.max(0, 1 - sum)))
  return normalize(q as Quat)
}`,
    },
  ],
  mistakes: [
    "Skipping the sign flip. At 9 bits, (0.10, 0.21, 0.31, -0.92) came back 90.39° wrong without it and 0.14° wrong with it. It only happens when the largest component is negative, so a quick test on small rotations can pass.",
    "Always dropping `w`. When `w` is near zero, rebuilding it amplifies the other errors. In a million random rotations, three 10-bit values in `±1` (30 bits) peaked at 6.3°, over ten times the 0.55° that 29 bits of smallest three can reach.",
    "Letting encoder and decoder drift apart. Sent in `±4` at 10 bits, the value 3 decodes as 6.01 with a range of `±8` and -0.50 with 11 bits. In a bit-packed stream a wrong bit count also shifts every field after it. Keep one shared schema and check its version at connect.",
    "Treating clamping as safe. Past the edge the error is no longer half a step: 5 and 500 both decode to 3.996 in `±4`. Set the range from the real bounds plus a margin, and log any clamp in development. Lower the range in the visual to watch this happen.",
    "Using the bit formula with `round(t * (2^b - 1))`. That mapping keeps both ends exact, but its step is `R / (2^b - 1)`, so it needs `⌈log₂(R / 2e + 1)⌉`. For 1024 units at ±0.5 that is 11 bits, not 10.",
    "Ignoring bin edges. A resting value that sits on an edge can flip a full step from tiny noise: 1 ± 0.000001 decodes as 0.75 or 1.25 with 16 bins in `±4`. Stop updating things at rest: Gaffer On Games saw quantized cube stacks jitter by tiny amounts, and forced a cube to rest after 16 frames without significant motion.",
  ],
  reading: [
    {
      title: "Gaffer On Games — Snapshot Compression",
      url: "https://gafferongames.com/post/snapshot_compression/",
    },
    {
      title: "Gaffer On Games — State Synchronization",
      url: "https://gafferongames.com/post/state_synchronization/",
    },
    {
      title: "Gaffer On Games — Networked Physics in Virtual Reality",
      url: "https://gafferongames.com/post/networked_physics_in_virtual_reality/",
    },
  ],
  visual:
    "The grey outline is the true dart; the solid yellow one is what the receiver decodes from the bits. Small grey dots are the position lattice at the copy's height, and the dashed grey square is the range on the floor. The red bar joins the two noses, so it grows with position or rotation error. Lower the bits to see the copy snap between dots and turn in steps, raise them until the two merge, or drop the range to 4 to see it pinned at the edge.",
}

export default sheet
