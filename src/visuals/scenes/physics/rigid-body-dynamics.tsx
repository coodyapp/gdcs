import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import {
  applyImpulse,
  boxInertia,
  createBox,
  integrate,
  resolvePlane,
  type Body2D,
  type Plane2D,
} from "@/lib/rigid-body"

import { defineVisual, palette, rad, useFixedStep, useVisual } from "../../kit"

type V = { offset: number; restitution: number; friction: number }

const W = 1.2
const H = 0.8
const MASS = 1
const START: [number, number] = [-2.4, 1.2]
const J = 4.5
const J_ANGLE = rad(25)
const JD: [number, number] = [Math.cos(J_ANGLE), Math.sin(J_ANGLE)]
const CYCLE = 5.5
const WALL = 4.6
const Z = 0.45 // draw helpers just in front of the box face
const PLANES: Plane2D[] = [
  { nx: 0, ny: 1, d: 0 },
  { nx: 1, ny: 0, d: -WALL },
  { nx: -1, ny: 0, d: -WALL },
]

/** World offset of the strike point: behind the box along J, shifted sideways by the lever arm. */
const strikeOffset = (offset: number): [number, number] => {
  const lever = offset * (H / 2)
  return [-JD[0] * (W / 2) - JD[1] * lever, -JD[1] * (W / 2) + JD[0] * lever]
}

/** Put the box back at the start and hit it with the impulse J. */
function strikeBox(
  body: Body2D,
  offset: number,
  clock: { t: number; cycleStart: number },
  contactFx: { j: number }[]
) {
  Object.assign(body, {
    x: START[0],
    y: START[1],
    angle: 0,
    vx: 0,
    vy: 0,
    omega: 0,
  })
  const [rx, ry] = strikeOffset(offset)
  applyImpulse(body, JD[0] * J, JD[1] * J, rx, ry)
  clock.cycleStart = clock.t
  for (const c of contactFx) c.j = 0
}

/** Thick unlit segments drawn as stretched boxes (one instanced draw call). */
function useSegments(color: string, max: number, thickness: number) {
  return useMemo(() => {
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color }),
      max
    )
    mesh.count = 0
    mesh.frustumCulled = false
    const o = new THREE.Object3D()
    const set = (i: number, ax: number, ay: number, bx: number, by: number) => {
      const len = Math.hypot(bx - ax, by - ay)
      o.position.set((ax + bx) / 2, (ay + by) / 2, Z)
      o.rotation.set(0, 0, Math.atan2(by - ay, bx - ax))
      o.scale.set(Math.max(len, 1e-4), thickness, thickness)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
    }
    return { mesh, set }
  }, [color, max, thickness])
}

/** Solid arrow (shaft + cone) along +x, re-aimed every frame. */
function useArrow(color: string) {
  return useMemo(() => {
    const group = new THREE.Group()
    const mat = new THREE.MeshBasicMaterial({ color })
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(1, 0.07, 0.07), mat)
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 16), mat)
    head.rotation.z = -Math.PI / 2
    group.add(shaft, head)
    const aim = (
      tx: number,
      ty: number,
      dx: number,
      dy: number,
      len: number
    ) => {
      group.visible = len > 0.05
      if (!group.visible) return
      const shaftLen = Math.max(len - 0.3, 0.01)
      group.position.set(tx, ty, Z)
      group.rotation.set(0, 0, Math.atan2(dy, dx))
      shaft.scale.x = shaftLen
      shaft.position.x = shaftLen / 2
      head.position.x = shaftLen + 0.15
    }
    return { group, aim }
  }, [color])
}

function Scene({ v }: { v: V }) {
  const { resetKey } = useVisual()
  const box = useRef<THREE.Mesh>(null)
  const com = useRef<THREE.Mesh>(null)
  const body = useMemo(() => createBox(W, H, MASS, ...START), [])
  const clock = useRef({ t: 0, cycleStart: 0 })
  const contactFx = useMemo(
    () => Array.from({ length: 6 }, () => ({ x: 0, y: 0, nx: 0, ny: 1, j: 0 })),
    []
  )
  const strike = useArrow(palette.force)
  const contactArrows = [
    useArrow(palette.force),
    useArrow(palette.force),
    useArrow(palette.force),
  ]
  const velocity = useSegments(palette.velocity, 12, 0.06)
  const spin = useSegments(palette.accel, 28, 0.06)
  const spinHead = useMemo(() => {
    const m = new THREE.Mesh(
      new THREE.ConeGeometry(0.11, 0.26, 12),
      new THREE.MeshBasicMaterial({ color: palette.accel })
    )
    return m
  }, [])

  useEffect(() => {
    clock.current.t = 0
    strikeBox(body, v.offset, clock.current, contactFx)
  }, [resetKey, v.offset, v.restitution, v.friction, body, contactFx])

  useFixedStep((dt) => {
    const c = clock.current
    c.t += dt
    if (c.t - c.cycleStart > CYCLE) strikeBox(body, v.offset, c, contactFx)
    integrate(body, dt)
    let k = 0
    for (const p of PLANES) {
      const res = resolvePlane(body, p, v.restitution, v.friction)
      for (const pt of res.points) {
        // Only flash noticeable impacts, not resting support.
        if (pt.jn < 0.08 || k >= contactFx.length) continue
        const fx = contactFx[k++]
        Object.assign(fx, { x: pt.x, y: pt.y, nx: p.nx, ny: p.ny, j: pt.jn })
      }
    }
    for (const fx of contactFx) fx.j *= 0.985
  }, 120)

  useFrame(() => {
    if (!box.current || !com.current) return
    box.current.position.set(body.x, body.y, 0)
    box.current.rotation.z = body.angle
    com.current.position.set(body.x, body.y, Z)

    // Strike impulse: red arrow ending at the hit point, fading out.
    const age = clock.current.t - clock.current.cycleStart
    const [rx, ry] = strikeOffset(v.offset)
    const hx = START[0] + rx
    const hy = START[1] + ry
    const sl = age < 0.6 ? 1.2 * (1 - age / 0.6) : 0
    strike.aim(hx - JD[0] * sl, hy - JD[1] * sl, JD[0], JD[1], sl)

    // Contact impulses: red arrows pushing out of the floor/walls.
    contactArrows.forEach((a, i) => {
      const fx = contactFx[i]
      const len = Math.min(fx.j * 0.9, 1.6)
      a.aim(fx.x, fx.y, fx.nx, fx.ny, len)
    })

    // Velocity: yellow dashed line from the centre of mass.
    const vx = body.vx * 0.32
    const vy = body.vy * 0.32
    const vl = Math.hypot(vx, vy)
    const dashes = Math.min(12, Math.floor(vl / 0.2))
    for (let i = 0; i < dashes; i++) {
      const a = (i * 0.2) / vl
      const b = (i * 0.2 + 0.12) / vl
      velocity.set(
        i,
        body.x + vx * a,
        body.y + vy * a,
        body.x + vx * b,
        body.y + vy * b
      )
    }
    velocity.mesh.count = dashes
    velocity.mesh.instanceMatrix.needsUpdate = true

    // Angular velocity: pink arc whose sweep grows with |ω|, head shows direction.
    const w = body.omega
    const sweep = Math.min(Math.abs(w) * 0.32, Math.PI * 1.7)
    const segs = Math.min(28, Math.ceil(sweep / 0.12))
    const R = 0.75
    const a0 = body.angle + Math.PI / 2
    const dir = Math.sign(w) || 1
    for (let i = 0; i < segs; i++) {
      const t0 = a0 + (dir * (sweep * i)) / segs
      const t1 = a0 + (dir * (sweep * (i + 1))) / segs
      spin.set(
        i,
        body.x + Math.cos(t0) * R,
        body.y + Math.sin(t0) * R,
        body.x + Math.cos(t1) * R,
        body.y + Math.sin(t1) * R
      )
    }
    spin.mesh.count = sweep > 0.15 ? segs : 0
    spin.mesh.instanceMatrix.needsUpdate = true
    const end = a0 + dir * sweep
    spinHead.visible = sweep > 0.15
    spinHead.position.set(
      body.x + Math.cos(end) * R,
      body.y + Math.sin(end) * R,
      Z
    )
    // Cone points along +y; tangent of the arc in the direction of travel.
    spinHead.rotation.set(0, 0, end + (dir > 0 ? 0 : Math.PI))
  })

  return (
    <group>
      <mesh ref={box} position={[START[0], START[1], 0]}>
        <boxGeometry args={[W, H, 0.8]} />
        <meshStandardMaterial
          color={palette.subject}
          emissive={palette.subject}
          emissiveIntensity={0.15}
          roughness={0.6}
        />
      </mesh>
      <mesh ref={com}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshBasicMaterial color={palette.foreground} />
      </mesh>
      {[-WALL - 0.1, WALL + 0.1].map((x) => (
        <mesh key={x} position={[x, 1.2, 0]}>
          <boxGeometry args={[0.2, 2.4, 1.6]} />
          <meshStandardMaterial color={palette.object} />
        </mesh>
      ))}
      <mesh position={[0, -0.06, 0]}>
        <boxGeometry args={[9.4, 0.12, 1.6]} />
        <meshStandardMaterial color={palette.surface} />
      </mesh>
      <primitive object={strike.group} />
      {contactArrows.map((a, i) => (
        <primitive key={i} object={a.group} />
      ))}
      <primitive object={velocity.mesh} />
      <primitive object={spin.mesh} />
      <primitive object={spinHead} />
    </group>
  )
}

export default defineVisual<V>({
  camera: { position: [0, 2, 8.4], target: [0, 1.25, 0] },
  params: [
    {
      key: "offset",
      label: "Impulse offset (lever arm)",
      min: -1,
      max: 1,
      step: 0.05,
      value: 0.7,
      unit: "× ½h",
      digits: 2,
    },
    {
      key: "restitution",
      label: "Restitution e",
      min: 0,
      max: 1,
      step: 0.05,
      value: 0.5,
      digits: 2,
    },
    {
      key: "friction",
      label: "Friction μ",
      min: 0,
      max: 1,
      step: 0.05,
      value: 0.4,
      digits: 2,
    },
  ],
  readout: (v) => {
    const I = boxInertia(MASS, W, H)
    const lever = v.offset * (H / 2)
    const w0 = (-lever * J) / I
    return `I = ${I.toFixed(3)} kg·m² · |J| = ${J} N·s · lever ${lever.toFixed(2)} m → ω₀ = ${w0.toFixed(1)} rad/s, v₀ = ${(J / MASS).toFixed(1)} m/s`
  },
  Scene,
})
