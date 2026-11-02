import { useEffect, useMemo, useRef } from "react"
import { Edges } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { headOnCollision, inverseMass, resolveCollision } from "@/lib/impulse"

import { Arrow, setArrow } from "../../arrow"
import {
  clamp,
  defineVisual,
  palette,
  useFixedStep,
  useVisual,
} from "../../kit"

type V = { massA: number; massB: number; restitution: number; speed: number }

const TRACK = 3.9 // half length
const DEPTH = 0.9
const TIME_SCALE = 0.6
/** After contact, restart the loop this long later even if nothing left the track. */
const MAX_AFTER = 1.6
const MIN_AFTER = 0.6
const FLASH = 0.45

const VEL_SCALE = 0.4
const VEL_MAX = 3.2
const IMPULSE_SCALE = 0.26
const FRONT = DEPTH / 2 + 0.06
const ARROW_LIFT = 0.3
/** Minimum height difference, so the two velocity arrows never overlap at contact. */
const ARROW_GAP = 0.3

const BAR_Y = -0.62
const BAR_H = 0.17
const BAR_REACH = 3.8

const DASH = 0.2
const DASH_GAP = 0.13
const DASH_T = 0.085
const DASHES = 11
const HEAD = 0.34

/** Keep a body on the track; true if it had to be stopped at an end. */
function clampToTrack<K extends string>(
  s: Record<K, number>,
  key: K,
  side: number
) {
  const limit = TRACK - side / 2
  if (Math.abs(s[key]) <= limit) return false
  s[key] = clamp(s[key], -limit, limit)
  return true
}

/** Front-face area is proportional to mass. */
const sideOf = (mass: number) => 0.9 * Math.sqrt(mass)

/** Dashed velocity arrow built from small boxes, updated by setVelocityArrow. */
function VelocityArrow({ ref }: { ref: React.Ref<THREE.Group> }) {
  const dash = useMemo(() => new THREE.BoxGeometry(1, DASH_T, DASH_T), [])
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: palette.velocity }),
    []
  )
  return (
    <group ref={ref}>
      <mesh rotation={[0, 0, -Math.PI / 2]} material={material}>
        <coneGeometry args={[HEAD * 0.46, HEAD, 16]} />
      </mesh>
      {Array.from({ length: DASHES }, (_, i) => (
        <mesh key={i} geometry={dash} material={material} />
      ))}
    </group>
  )
}

function setVelocityArrow(
  g: THREE.Group | null,
  x: number,
  y: number,
  velocity: number
) {
  if (!g) return
  const len = Math.min(Math.abs(velocity) * VEL_SCALE, VEL_MAX)
  g.visible = len > 0.03
  if (!g.visible) return
  // Centred over the body, so the tip stays in frame near the track ends.
  const dir = velocity < 0 ? -1 : 1
  g.position.set(x - (dir * len) / 2, y, 0)
  g.scale.x = dir
  const head = Math.min(HEAD, len * 0.6)
  const shaft = len - head
  const [cone, ...dashes] = g.children
  cone.position.x = shaft + head / 2
  cone.scale.setScalar(head / HEAD)
  for (let i = 0; i < DASHES; i++) {
    const start = i * (DASH + DASH_GAP)
    const d = dashes[i]
    d.visible = start < shaft
    if (!d.visible) continue
    const l = Math.min(DASH, shaft - start)
    d.position.x = start + l / 2
    d.scale.x = l
  }
}

function setBar(m: THREE.Mesh | null, from: number, to: number, y: number) {
  if (!m) return
  m.visible = Math.abs(to - from) > 1e-3
  m.position.set((from + to) / 2, y, FRONT)
  m.scale.x = Math.max(Math.abs(to - from), 1e-3)
}

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const { massA, massB, restitution, speed } = v
  const sideA = sideOf(massA)
  const sideB = sideOf(massB)
  const startA = -TRACK + sideA / 2
  const startB = TRACK - sideB / 2
  const arrowA = sideA + ARROW_LIFT
  const liftedB = sideB + ARROW_LIFT
  const arrowB =
    Math.abs(liftedB - arrowA) < ARROW_GAP ? arrowA + ARROW_GAP : liftedB

  const bodyA = useRef<THREE.Group>(null)
  const bodyB = useRef<THREE.Group>(null)
  const velA = useRef<THREE.Group>(null)
  const velB = useRef<THREE.Group>(null)
  const impA = useRef<THREE.Group>(null)
  const impB = useRef<THREE.Group>(null)
  const barA = useRef<THREE.Mesh>(null)
  const barB = useRef<THREE.Mesh>(null)
  const total = useRef<THREE.Mesh>(null)

  const sim = useRef({
    a: { v: speed, invMass: inverseMass(massA) },
    b: { v: -speed, invMass: inverseMass(massB) },
    xA: startA,
    xB: startB,
    hit: false,
    after: 0,
    flash: FLASH,
    j: 0,
    contactX: 0,
  })

  const restart = () => {
    const s = sim.current
    s.a.v = speed
    s.a.invMass = inverseMass(massA)
    s.b.v = -speed
    s.b.invMass = inverseMass(massB)
    s.xA = startA
    s.xB = startB
    s.hit = false
    s.after = 0
    s.flash = FLASH
    s.j = 0
  }
  const restartRef = useRef(restart)
  restartRef.current = restart

  useEffect(() => {
    restartRef.current()
  }, [resetKey, massA, massB, restitution, speed])

  // Same bar scale for the whole loop, chosen so the longest bar fits.
  const barScale = useMemo(() => {
    const r = headOnCollision(massA, massB, restitution, speed)
    const longest = Math.max(
      Math.abs(r.pABefore),
      Math.abs(r.pAAfter),
      Math.abs(r.pBefore)
    )
    return Math.min(0.28, BAR_REACH / Math.max(longest, 1e-6))
  }, [massA, massB, restitution, speed])

  useFixedStep((realDt) => {
    const s = sim.current
    const dt = realDt * TIME_SCALE
    s.xA += s.a.v * dt
    s.xB += s.b.v * dt
    if (s.flash < FLASH) s.flash += dt

    const halves = (sideA + sideB) / 2
    if (!s.hit && s.xB - s.xA <= halves) {
      // Undo the sliver of overlap from this step, then resolve the contact.
      const overlap = halves - (s.xB - s.xA)
      const share = s.a.invMass / (s.a.invMass + s.b.invMass)
      s.xA -= overlap * share
      s.xB += overlap * (1 - share)
      s.contactX = s.xA + sideA / 2
      s.j = resolveCollision(s.a, s.b, restitution)
      s.hit = true
      s.flash = 0
    }

    if (s.hit) s.after += dt
    // A fast body parks at the track end, so the loop still shows the aftermath.
    const parkedA = clampToTrack(s, "xA", sideA)
    const parkedB = clampToTrack(s, "xB", sideB)
    const parked = parkedA || parkedB
    if (s.after > MAX_AFTER || (parked && s.after > MIN_AFTER)) restart()
  }, 120)

  const from = useMemo(() => new THREE.Vector3(), [])
  const to = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const s = sim.current
    bodyA.current?.position.setX(s.xA)
    bodyB.current?.position.setX(s.xB)
    setVelocityArrow(velA.current, s.xA, arrowA, s.a.v)
    setVelocityArrow(velB.current, s.xB, arrowB, s.b.v)

    // Red impulse: equal and opposite, from the contact point into each body.
    const fade = 1 - (s.flash / FLASH) ** 2
    const len =
      s.flash < FLASH ? clamp(s.j * IMPULSE_SCALE, 0.6, 2.4) * fade : 0
    const y = Math.min(sideA, sideB) / 2
    from.set(s.contactX, y, FRONT)
    to.set(s.contactX - len, y, FRONT)
    setArrow(impA.current, from, to)
    to.set(s.contactX + len, y, FRONT)
    setArrow(impB.current, from, to)

    // Momentum bars: A's from zero, B's from A's end. Their tip is the total.
    const pA = massA * s.a.v * barScale
    const pB = massB * s.b.v * barScale
    setBar(barA.current, 0, pA, BAR_Y)
    setBar(barB.current, pA, pA + pB, BAR_Y - BAR_H - 0.03)
    total.current?.position.setX(pA + pB)
  })

  return (
    <group>
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[TRACK * 2 + 0.3, 0.1, DEPTH + 0.5]} />
        <meshStandardMaterial color={palette.surface} />
      </mesh>

      <group ref={bodyA} position={[startA, sideA / 2, 0]}>
        <mesh>
          <boxGeometry args={[sideA, sideA, DEPTH]} />
          <meshStandardMaterial color={palette.subject} />
        </mesh>
      </group>
      <group ref={bodyB} position={[startB, sideB / 2, 0]}>
        <mesh>
          <boxGeometry args={[sideB, sideB, DEPTH]} />
          <meshStandardMaterial color={palette.tertiary} />
          <Edges color={palette.accel} lineWidth={2} />
        </mesh>
      </group>

      <VelocityArrow ref={velA} />
      <VelocityArrow ref={velB} />
      <Arrow ref={impA} color={palette.force} radius={0.07} head={0.4} />
      <Arrow ref={impB} color={palette.force} radius={0.07} head={0.4} />

      {/* Momentum ledger under the track; the green tick never moves. */}
      <mesh position={[0, BAR_Y - BAR_H / 2 - 0.015, FRONT]}>
        <boxGeometry args={[0.025, BAR_H * 2 + 0.2, 0.01]} />
        <meshBasicMaterial color={palette.tertiary} />
      </mesh>
      <mesh ref={barA}>
        <boxGeometry args={[1, BAR_H, 0.02]} />
        <meshBasicMaterial color={palette.subject} />
      </mesh>
      <mesh ref={barB}>
        <boxGeometry args={[1, BAR_H, 0.02]} />
        <meshBasicMaterial color={palette.tertiary} />
      </mesh>
      <mesh ref={total} position={[0, BAR_Y - BAR_H / 2 - 0.015, FRONT + 0.02]}>
        <boxGeometry args={[0.07, BAR_H * 2 + 0.34, 0.02]} />
        <meshBasicMaterial color={palette.success} />
      </mesh>
    </group>
  )
}

/** Avoid "-0.00" when a total is zero up to rounding. */
const fmt = (x: number, digits = 2) =>
  (Math.abs(x) < 0.5 * 10 ** -digits ? 0 : x).toFixed(digits)

export default defineVisual<V>({
  camera: { position: [0, 1.2, 6.9], target: [0, 0.55, 0] },
  grid: false,
  params: [
    {
      key: "massA",
      label: "Mass A",
      min: 0.5,
      max: 6,
      step: 0.1,
      value: 3,
      unit: "kg",
    },
    {
      key: "massB",
      label: "Mass B",
      min: 0.5,
      max: 6,
      step: 0.1,
      value: 1,
      unit: "kg",
    },
    {
      key: "restitution",
      label: "Restitution e",
      min: 0,
      max: 1,
      step: 0.01,
      value: 0.6,
      digits: 2,
    },
    {
      key: "speed",
      label: "Initial speed",
      min: 1,
      max: 6,
      step: 0.1,
      value: 3,
      unit: "m/s",
    },
  ],
  readout: (v) => {
    const r = headOnCollision(v.massA, v.massB, v.restitution, v.speed)
    const share = r.keBefore > 0 ? (100 * r.keLost) / r.keBefore : 0
    return `Momentum before ${fmt(r.pBefore)} · after ${fmt(r.pAfter)} kg·m/s · KE lost ${fmt(r.keLost)} J (${fmt(share, 0)}%)`
  },
  Scene,
})
