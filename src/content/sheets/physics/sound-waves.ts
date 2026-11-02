import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "sound-waves",
  category: "physics",
  subcategory: "mechanics",
  title: "Sound Waves",
  hook: "air molecules shuffle back and forth, the pattern travels",
  summary:
    "Sound is a longitudinal pressure wave: frequency sets pitch and wavelength, amplitude sets loudness. The physics behind 3D audio, delay and Doppler.",
  level: "core",
  tags: ["waves", "acoustics", "audio", "longitudinal", "doppler"],
  updated: "2026-11-02",
  prompt:
    "Write a TypeScript Three.js helper for physically-flavoured positional audio. Inputs: a THREE.PositionalAudio, the source Object3D, the AudioListener's Object3D, dt and speed of sound (default 343 m/s). Each frame: compute distance, apply inverse-distance rolloff with refDistance 2 m, compute the source's radial velocity toward the listener and set playbackRate = c/(c − v_s) clamped to [0.5, 2], and expose delayFor(distance) for one-shots. Ignore velocity on frames where the source moved more than 10 m (teleport). Unit tests: a stationary source gives rate 1; approaching at 34.3 m/s gives rate ≈ 1.111; delay for 343 m is 1 s.",
  related: ["spring-mass-oscillator", "em-wave-propagation", "delta-time"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A loudspeaker cone pushes and pulls the air in front of it. Each air parcel only jiggles back and forth around its home position, but the pattern of **compressions** (crowded, high pressure) and **rarefactions** (spread out, low pressure) travels away at the speed of sound, about 343 m/s in room-temperature air. Because the jiggle is along the travel direction, sound is a **longitudinal** wave.",
    "The **frequency** `f` is how many compressions pass per second (pitch); the **wavelength** `λ = v/f` is the distance between them. A 440 Hz A4 is 0.78 m long in air; 100 Hz bass is 3.4 m, which is why it bends around walls. **Amplitude** sets the pressure swing; intensity grows with its square, and perceived loudness follows the logarithm of intensity (decibels).",
    "For game audio that physics shows up as distance attenuation (`1/r²` intensity, `−6 dB` per doubling of distance), propagation delay (thunder after lightning, far gunshots), Doppler shift for moving sources, and low-pass filtering for occlusion. Web Audio's `PannerNode` and Three.js's `PositionalAudio` implement the attenuation; delay and Doppler are often up to you.",
  ],
  formulas: [
    {
      label: "Particle displacement",
      math: tex`\xi(x,t) = A \sin(kx - \omega t),\quad k = \dfrac{2\pi}{\lambda},\ \omega = 2\pi f`,
    },
    {
      label: "Pressure (90° ahead of displacement)",
      math: tex`\textcolor{#f65a5a}{p(x,t)} = p_0 - B\,\dfrac{\partial \xi}{\partial x} = p_0 - B k A\cos(kx - \omega t)`,
    },
    { label: "Wave speed", math: tex`v = f\lambda` },
    {
      label: "Intensity and level",
      math: tex`I \propto A^2,\qquad L = 10\log_{10}\dfrac{I}{I_0}\ \text{dB}`,
    },
    {
      label: "Doppler (moving source)",
      math: tex`f' = f\,\dfrac{v}{v - v_s}`,
      note: "v_s is the source speed toward the listener.",
    },
  ],
  rules: [
    "Speed of sound ≈ 331 + 0.6·T(°C) m/s in air; about 1480 m/s in water, so underwater audio should arrive almost instantly.",
    "Human hearing: 20 Hz–20 kHz, wavelengths 17 m down to 1.7 cm.",
    "Point source in open air: intensity ∝ 1/r², so the level drops 6 dB per doubling of distance. Games often use a gentler rolloff for playability.",
    "Delay a far sound by `distance / 343` seconds; 100 m is a noticeable 0.29 s.",
  ],
  code: [
    {
      lang: "ts",
      caption:
        "Positional sound with physical delay and Doppler (Three.js + Web Audio):",
      code: `import * as THREE from "three"

const SPEED = 343
const prev = new THREE.Vector3()
const toListener = new THREE.Vector3()

export function updateSound(sound: THREE.PositionalAudio, source: THREE.Object3D, listener: THREE.Object3D, dt: number) {
  sound.setRefDistance(2) // full volume within 2 m
  sound.setRolloffFactor(1) // inverse-distance falloff
  toListener.subVectors(listener.position, source.position)
  const dist = toListener.length()
  // Radial speed of the source toward the listener (m/s).
  const vs = prev.sub(source.position).multiplyScalar(-1 / dt).dot(toListener.normalize())
  prev.copy(source.position)
  const rate = SPEED / (SPEED - THREE.MathUtils.clamp(vs, -150, 150))
  sound.setPlaybackRate(rate) // Doppler pitch
  return dist / SPEED // seconds of delay to apply when (re)starting a one-shot
}`,
    },
  ],
  mistakes: [
    "Drawing sound as a transverse wiggle: air moves along the direction of travel, not sideways.",
    "Confusing amplitude with frequency: louder does not mean higher pitch.",
    "Scaling volume linearly with distance; perceived loudness is logarithmic and intensity falls off as 1/r².",
    "Applying Doppler from the frame-to-frame position delta without clamping, so a teleport produces a squeal.",
  ],
  reading: [
    {
      title: "OpenStax University Physics — Sound Waves",
      url: "https://openstax.org/books/university-physics-volume-1/pages/17-1-sound-waves",
    },
    {
      title: "MDN — Web audio spatialization basics",
      url: "https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Web_audio_spatialization_basics",
    },
  ],
  visual:
    "Rows of air parcels shuffle left and right as the grey speaker pushes them (200× slow motion). Yellow parcels are compressed and bunched together, white ones rarefied and spread apart, and the solid red curve above is the pressure p. Raise the frequency to pack compressions closer (shorter λ); raise the amplitude to make the parcels swing further.",
}

export default sheet
