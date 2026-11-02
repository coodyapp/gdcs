import { useMemo, useRef } from "react"
import { Line } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import {
  hitsSoFar,
  isHolding,
  LANE,
  laneHistory,
  laneTime,
  sampleHistory,
  shotsFired,
  SHOTS_PER_CYCLE,
  simulateLane,
  CYCLE,
  targetPosition,
  type LaneRun,
} from "@/lib/lag-compensation"

import { defineVisual, palette, useClock, useLiveReadout } from "../../kit"

type V = {
  latency: number
  interp: number
  compensation: boolean
  maxRewind: number
}

const HISTORY = laneHistory()
const MAX_TICK_DOTS = 24
const TALLY = 12
const TALLY_Y = -3.25
const TALLY_GAP = 0.5
const SEEN_HALF = 0.27
const RAY_THROUGH_LANE = 1.32

const SQUARE: [number, number, number][] = [
  [-LANE.half, -LANE.half, 0],
  [LANE.half, -LANE.half, 0],
  [LANE.half, LANE.half, 0],
  [-LANE.half, LANE.half, 0],
  [-LANE.half, -LANE.half, 0],
]
const RAIL = LANE.half + 0.32

const toRun = (v: V) =>
  simulateLane(
    {
      latency: v.latency / 1000,
      interp: v.interp / 1000,
      compensation: v.compensation,
      maxRewind: v.maxRewind / 1000,
    },
    HISTORY
  )

const describe = (run: LaneRun) => {
  const ms = Math.round(run.rewind * 1000)
  const rewind = run.capped
    ? `Rewind ${ms} ms (capped, needs ${Math.round(run.delay * 1000)})`
    : `Rewind ${ms} ms`
  return `${rewind} · target offset ${run.offset.toFixed(2)} u`
}

/** A cross drawn as two thin planes, which fits instancing and a plain group. */
function Cross({ size, thick }: { size: number; thick: number }) {
  return (
    <>
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <planeGeometry args={[size, thick]} />
        <meshBasicMaterial color={palette.error} toneMapped={false} />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 4]}>
        <planeGeometry args={[size, thick]} />
        <meshBasicMaterial color={palette.error} toneMapped={false} />
      </mesh>
    </>
  )
}

function Scene({ v }: { v: V }) {
  const time = useClock()
  const run = useMemo(() => toRun(v), [v])
  const runRef = useRef(run)
  runRef.current = run

  const seen = useRef<THREE.Mesh>(null)
  const truth = useRef<THREE.Group>(null)
  const rewound = useRef<THREE.Group>(null)
  const span = useRef<THREE.Mesh>(null)
  const capA = useRef<THREE.Mesh>(null)
  const capB = useRef<THREE.Mesh>(null)
  const hitRay = useRef<THREE.Mesh>(null)
  const missRay = useRef<THREE.Mesh>(null)
  const hitMark = useRef<THREE.Mesh>(null)
  const missMark = useRef<THREE.Group>(null)
  const ticks = useRef<THREE.InstancedMesh>(null)
  const tallyHit = useRef<THREE.InstancedMesh>(null)
  const tallyMiss = useRef<THREE.InstancedMesh>(null)

  const scratch = useMemo(
    () => ({ a: { x: 0, y: 0 }, b: { x: 0, y: 0 }, c: { x: 0, y: 0 } }),
    []
  )
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const put = (
    mesh: THREE.InstancedMesh,
    i: number,
    x: number,
    y: number,
    sx: number,
    sy = sx,
    angle = 0
  ) => {
    dummy.position.set(x, y, 0)
    dummy.scale.set(sx, sy, 1)
    dummy.rotation.set(0, 0, angle)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  }
  const commit = (mesh: THREE.InstancedMesh, count: number) => {
    mesh.count = count
    mesh.instanceMatrix.needsUpdate = true
  }
  const placeRay = (
    mesh: THREE.Mesh,
    toX: number,
    toY: number,
    thick: number
  ) => {
    const dx = toX - LANE.shooter.x
    const dy = toY - LANE.shooter.y
    mesh.position.set(LANE.shooter.x + dx / 2, LANE.shooter.y + dy / 2, 0.05)
    mesh.scale.set(Math.hypot(dx, dy), thick, 1)
    mesh.rotation.z = Math.atan2(dy, dx)
  }

  useFrame(() => {
    if (
      !seen.current ||
      !truth.current ||
      !rewound.current ||
      !span.current ||
      !capA.current ||
      !capB.current ||
      !hitRay.current ||
      !missRay.current ||
      !hitMark.current ||
      !missMark.current ||
      !ticks.current ||
      !tallyHit.current ||
      !tallyMiss.current
    )
      return
    const r = runRef.current
    const clock = time.current
    const sim = laneTime(clock) % CYCLE

    const now = targetPosition(sim, scratch.a)
    const view = targetPosition(sim - r.delay, scratch.b)
    const test = sampleHistory(HISTORY, sim - r.rewind, scratch.c)
    seen.current.position.set(view.x, view.y, 0.03)
    truth.current.position.set(now.x, now.y, 0.02)
    rewound.current.position.set(test.x, test.y, 0.04)

    // The gap between the server's present and the shooter's view.
    const left = Math.min(now.x, view.x)
    const right = Math.max(now.x, view.x)
    span.current.position.set((left + right) / 2, LANE.y + RAIL, 0)
    span.current.scale.set(Math.max(right - left, 0.001), 1, 1)
    capA.current.position.set(left, LANE.y + RAIL, 0)
    capB.current.position.set(right, LANE.y + RAIL, 0)

    // Stored ticks the server is willing to rewind into.
    const limit = v.maxRewind / 1000
    const newest = Math.floor(sim * LANE.tickHz)
    let n = 0
    for (let i = 0; i < MAX_TICK_DOTS; i++) {
      const t = (newest - i) / LANE.tickHz
      if (sim - t > limit) break
      const p = targetPosition(t, scratch.a)
      put(ticks.current, n++, p.x, p.y - RAIL, 0.06)
    }
    commit(ticks.current, n)

    // The shot, held on screen while simulated time stands still.
    const fired = shotsFired(clock)
    const holding = isHolding(clock)
    const shot = fired > 0 ? r.shots[(fired - 1) % SHOTS_PER_CYCLE] : r.shots[0]
    const showHit = holding && shot.hit
    const showMiss = holding && !shot.hit
    hitRay.current.visible = showHit
    hitMark.current.visible = showHit
    missRay.current.visible = showMiss
    missMark.current.visible = showMiss
    const dx = shot.aim.x - LANE.shooter.x
    const dy = shot.aim.y - LANE.shooter.y
    if (showHit) {
      const x = LANE.shooter.x + dx * shot.entry
      const y = LANE.shooter.y + dy * shot.entry
      placeRay(hitRay.current, x, y, 0.09)
      hitMark.current.position.set(x, y, 0.06)
    }
    if (showMiss) {
      placeRay(
        missRay.current,
        LANE.shooter.x + dx * RAY_THROUGH_LANE,
        LANE.shooter.y + dy * RAY_THROUGH_LANE,
        0.06
      )
      missMark.current.position.set(shot.aim.x, shot.aim.y, 0.06)
    }

    // Tally of recent verdicts, oldest on the left.
    const count = Math.min(Math.max(fired, 0), TALLY)
    const startX = (-(TALLY - 1) * TALLY_GAP) / 2
    let hits = 0
    let misses = 0
    for (let i = 0; i < count; i++) {
      const index = fired - count + i
      const x = startX + i * TALLY_GAP
      if (r.shots[index % SHOTS_PER_CYCLE].hit)
        put(tallyHit.current, hits++, x, TALLY_Y, 0.15)
      else {
        put(tallyMiss.current, misses++, x, TALLY_Y, 0.42, 0.075, Math.PI / 4)
        put(tallyMiss.current, misses++, x, TALLY_Y, 0.42, 0.075, -Math.PI / 4)
      }
    }
    commit(tallyHit.current, hits)
    commit(tallyMiss.current, misses)
  })

  useLiveReadout(() => {
    const r = runRef.current
    const fired = Math.max(shotsFired(time.current), 0)
    if (fired === 0) return `${describe(r)} · hit rate: first shot coming`
    const hits = hitsSoFar(r, fired)
    return `${describe(r)} · hit rate ${Math.round((100 * hits) / fired)}% (${hits}/${fired})`
  })

  return (
    <>
      {/* Lane */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, LANE.y + side * (RAIL + 0.26), -0.02]}>
          <planeGeometry args={[2 * (LANE.halfWidth + LANE.half), 0.025]} />
          <meshBasicMaterial color={palette.tertiary} toneMapped={false} />
        </mesh>
      ))}

      {/* Shooter */}
      <mesh position={[LANE.shooter.x, LANE.shooter.y - 0.1, 0.06]}>
        <circleGeometry args={[0.34, 3, Math.PI / 2]} />
        <meshBasicMaterial color={palette.subject} toneMapped={false} />
      </mesh>

      <instancedMesh
        ref={ticks}
        args={[undefined, undefined, MAX_TICK_DOTS]}
        frustumCulled={false}
      >
        <circleGeometry args={[1, 10]} />
        <meshBasicMaterial color={palette.accel} toneMapped={false} />
      </instancedMesh>

      {/* The gap: speed times total delay, measured above the lane. */}
      <mesh ref={span}>
        <planeGeometry args={[1, 0.04]} />
        <meshBasicMaterial color={palette.accel} toneMapped={false} />
      </mesh>
      <mesh ref={capA}>
        <planeGeometry args={[0.04, 0.22]} />
        <meshBasicMaterial color={palette.accel} toneMapped={false} />
      </mesh>
      <mesh ref={capB}>
        <planeGeometry args={[0.04, 0.22]} />
        <meshBasicMaterial color={palette.accel} toneMapped={false} />
      </mesh>

      {/* What the shooter sees: solid yellow. */}
      <mesh ref={seen}>
        <planeGeometry args={[2 * SEEN_HALF, 2 * SEEN_HALF]} />
        <meshBasicMaterial color={palette.moving} toneMapped={false} />
      </mesh>
      {/* The target on the server now: plain grey outline. */}
      <group ref={truth}>
        <Line points={SQUARE} color={palette.accel} lineWidth={2} />
      </group>
      {/* The hitbox used for the test: dashed white. */}
      <group ref={rewound}>
        <Line
          points={SQUARE}
          color={palette.subject}
          lineWidth={2.5}
          dashed
          dashSize={0.13}
          gapSize={0.1}
        />
      </group>

      {/* Hit: thick green ray ending in a disc. */}
      <mesh ref={hitRay} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.success} toneMapped={false} />
      </mesh>
      <mesh ref={hitMark} visible={false}>
        <circleGeometry args={[0.2, 24]} />
        <meshBasicMaterial color={palette.success} toneMapped={false} />
      </mesh>
      {/* Miss: thin red ray passing through, with a cross on the aim point. */}
      <mesh ref={missRay} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.error} toneMapped={false} />
      </mesh>
      <group ref={missMark} visible={false}>
        <Cross size={0.62} thick={0.1} />
      </group>

      {/* Tally: discs for hits, crosses for misses. */}
      <instancedMesh
        ref={tallyHit}
        args={[undefined, undefined, TALLY]}
        frustumCulled={false}
      >
        <circleGeometry args={[1, 18]} />
        <meshBasicMaterial color={palette.success} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={tallyMiss}
        args={[undefined, undefined, TALLY * 2]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.error} toneMapped={false} />
      </instancedMesh>
    </>
  )
}

export default defineVisual<V>({
  camera: { position: [0, -0.2, 9.2], target: [0, -0.2, 0] },
  orbit: false,
  params: [
    {
      key: "latency",
      label: "Latency (round trip)",
      min: 0,
      max: 300,
      step: 10,
      value: 150,
      unit: "ms",
    },
    {
      key: "interp",
      label: "Interpolation delay",
      min: 0,
      max: 200,
      step: 10,
      value: 100,
      unit: "ms",
    },
    {
      key: "compensation",
      label: "Lag compensation",
      type: "toggle",
      value: true,
    },
    {
      key: "maxRewind",
      label: "Max rewind",
      min: 50,
      max: 500,
      step: 10,
      value: 400,
      unit: "ms",
    },
  ],
  readout: (v) => describe(toRun(v)),
  Scene,
})
