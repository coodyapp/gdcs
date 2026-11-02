/**
 * Behavior tree evaluator plus the patrol/chase/flee demo world. Everything is
 * pure: `tick` and `stepGuard` read their inputs and return new values, so one
 * tree definition can drive any number of agents.
 */
export type Status = "success" | "failure" | "running"

export type BtNode<B> =
  | {
      kind: "sequence" | "selector"
      id: string
      children: readonly BtNode<B>[]
    }
  | {
      kind: "decorator"
      id: string
      child: BtNode<B>
      map: (status: Status) => Status
    }
  | { kind: "condition"; id: string; test: (blackboard: B) => boolean }
  | { kind: "action"; id: string; run: (blackboard: B) => Status }

export const sequence = <B>(
  id: string,
  ...children: BtNode<B>[]
): BtNode<B> => ({ kind: "sequence", id, children })
export const selector = <B>(
  id: string,
  ...children: BtNode<B>[]
): BtNode<B> => ({ kind: "selector", id, children })
export const condition = <B>(
  id: string,
  test: (blackboard: B) => boolean
): BtNode<B> => ({ kind: "condition", id, test })
export const action = <B>(
  id: string,
  run: (blackboard: B) => Status
): BtNode<B> => ({ kind: "action", id, run })
/** Swaps success and failure; running passes through. */
export const inverter = <B>(id: string, child: BtNode<B>): BtNode<B> => ({
  kind: "decorator",
  id,
  child,
  map: (s) =>
    s === "running" ? "running" : s === "success" ? "failure" : "success",
})
/** Turns a finished child into success, so a failure cannot stop its parent. */
export const succeeder = <B>(id: string, child: BtNode<B>): BtNode<B> => ({
  kind: "decorator",
  id,
  child,
  map: (s) => (s === "running" ? "running" : "success"),
})

export interface TickResult {
  status: Status
  /** Status of every node ticked this time. Absent means untouched. */
  trace: Readonly<Record<string, Status>>
  /** Composite id → index of its running child, used by memory mode. */
  running: Readonly<Record<string, number>>
  /** Nodes that were running last tick and were not reached this tick. */
  interrupted: readonly string[]
}

export const NO_TICK: TickResult = {
  status: "failure",
  trace: {},
  running: {},
  interrupted: [],
}

/**
 * One pass from the root. With `reactive` every composite restarts at its first
 * child, so higher priorities can interrupt. Otherwise a composite resumes at
 * the child that was running and skips everything before it.
 */
export function tick<B>(
  root: BtNode<B>,
  blackboard: B,
  reactive: boolean,
  previous: TickResult = NO_TICK
): TickResult {
  const trace: Record<string, Status> = {}
  const running: Record<string, number> = {}

  const visit = (node: BtNode<B>): Status => {
    const status = evaluate(node)
    trace[node.id] = status
    return status
  }

  const evaluate = (node: BtNode<B>): Status => {
    switch (node.kind) {
      case "condition":
        return node.test(blackboard) ? "success" : "failure"
      case "action":
        return node.run(blackboard)
      case "decorator":
        return node.map(visit(node.child))
      default: {
        // A sequence ends on anything but success, a selector on anything but
        // failure; running one child at a time is what makes both resumable.
        const keepGoing = node.kind === "sequence" ? "success" : "failure"
        const start = reactive ? 0 : (previous.running[node.id] ?? 0)
        for (let i = start; i < node.children.length; i++) {
          const status = visit(node.children[i])
          if (status === keepGoing) continue
          if (status === "running") running[node.id] = i
          return status
        }
        return keepGoing
      }
    }
  }

  const status = visit(root)
  const interrupted = Object.keys(previous.trace).filter(
    (id) => previous.trace[id] === "running" && !(id in trace)
  )
  return { status, trace, running, interrupted }
}

/** Root-to-leaf path that decided this tick: the last child ticked at each level. */
export function activeBranch<B>(root: BtNode<B>, result: TickResult): string[] {
  const path: string[] = []
  let node: BtNode<B> | undefined = root
  while (node && node.id in result.trace) {
    path.push(node.id)
    if (node.kind === "decorator") node = node.child
    else if (node.kind === "sequence" || node.kind === "selector") {
      node = node.children.findLast((child) => child.id in result.trace)
    } else node = undefined
  }
  return path
}

// --- Demo: a guard that patrols, chases a nearby target and flees when hurt. ---

export interface GuardBlackboard {
  /** Distance to the target. */
  distance: number
  /** Hurt and not yet healed (see `stepGuard`). */
  hurt: boolean
  /** Far enough from the target to stop running (see `stepGuard`). */
  safe: boolean
  /** Standing on the current patrol waypoint. */
  arrived: boolean
}

export const GUARD = {
  tickHz: 10,
  nearRadius: 1.5,
  reach: 0.6,
  giveUpRadius: 3.2,
  safeRadius: 3,
  /** Once safe, stay safe until the target is this close again. */
  unsafeRadius: 2.2,
  lowHealth: 30,
  drainPerSecond: 40,
  healPerSecond: 20,
  patrolSpeed: 1.1,
  chaseSpeed: 1.6,
  fleeSpeed: 2,
  /** Walkable box. */
  minX: -5.8,
  maxX: -1.4,
  minZ: -2.4,
  maxZ: 1.9,
  /** Patrol runs along the top of the box. */
  waypoints: [
    [-5.2, -1.7],
    [-1.8, -1.7],
  ],
} as const

export const guardTree: BtNode<GuardBlackboard> = selector<GuardBlackboard>(
  "root",
  sequence(
    "fleeBranch",
    condition("hurt", (b) => b.hurt),
    action("flee", (b) =>
      b.distance >= GUARD.safeRadius ? "success" : "running"
    )
  ),
  sequence(
    "chaseBranch",
    condition("near", (b) => b.distance < GUARD.nearRadius),
    action("chase", (b) => {
      if (b.distance <= GUARD.reach) return "success"
      return b.distance > GUARD.giveUpRadius ? "failure" : "running"
    })
  ),
  action("patrol", (b) => (b.arrived ? "success" : "running"))
)

export interface GuardWorld {
  time: number
  /** Drives the auto target; stops while the guard is in contact with it. */
  targetClock: number
  x: number
  z: number
  heading: number
  targetX: number
  targetZ: number
  health: number
  hurt: boolean
  safe: boolean
  waypoint: number
  tickTimer: number
  last: TickResult
  /** Most recent leaf cut off by a higher priority or a failed guard. */
  lastInterrupted: string | null
}

export interface GuardOptions {
  reactive: boolean
  autoTarget: boolean
  /** Parked target's distance below the middle of the patrol line. */
  targetDistance: number
  maxHealth: number
}

export function targetPosition(
  time: number,
  options: Pick<GuardOptions, "autoTarget" | "targetDistance">
): [number, number] {
  const midX = (GUARD.waypoints[0][0] + GUARD.waypoints[1][0]) / 2
  if (!options.autoTarget) {
    return [midX, GUARD.waypoints[0][1] + options.targetDistance]
  }
  return [
    midX + 1.9 * Math.sin(0.37 * time + 2.6),
    -0.2 + 1.75 * Math.cos(0.59 * time),
  ]
}

export function createGuardWorld(options: GuardOptions): GuardWorld {
  const [targetX, targetZ] = targetPosition(0, options)
  return {
    time: 0,
    targetClock: 0,
    x: GUARD.waypoints[0][0],
    z: GUARD.waypoints[0][1],
    heading: Math.PI / 2,
    targetX,
    targetZ,
    health: options.maxHealth,
    hurt: false,
    safe: false,
    waypoint: 1,
    tickTimer: 0,
    last: NO_TICK,
    lastInterrupted: null,
  }
}

const LEAVES = new Set(["hurt", "near", "flee", "chase", "patrol"])

const clampTo = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/** Advances the world by `dt`, ticking the tree at `GUARD.tickHz`. */
export function stepGuard(
  world: GuardWorld,
  dt: number,
  options: GuardOptions
): GuardWorld {
  const time = world.time + dt
  let { x, z, heading, waypoint, last, lastInterrupted } = world

  // A target in contact stands and fights, so contact does not flicker.
  const inContact =
    Math.hypot(world.targetX - x, world.targetZ - z) <= GUARD.reach
  const targetClock = world.targetClock + (inContact ? 0 : dt)
  const [targetX, targetZ] = targetPosition(targetClock, options)
  const distance = Math.hypot(targetX - x, targetZ - z)
  const health = clampTo(
    world.health +
      (inContact ? -GUARD.drainPerSecond : GUARD.healPerSecond) * dt,
    0,
    options.maxHealth
  )
  // Latch: once below the threshold, stay hurt until fully healed, so the
  // agent does not bounce between flee and chase around a single number.
  const hurt =
    health < GUARD.lowHealth || (world.hurt && health < options.maxHealth)
  const safe =
    distance >= GUARD.safeRadius ||
    (world.safe && distance >= GUARD.unsafeRadius)

  let tickTimer = world.tickTimer - dt
  if (tickTimer <= 0) {
    tickTimer += 1 / GUARD.tickHz
    const [wx, wz] = GUARD.waypoints[waypoint]
    last = tick(
      guardTree,
      {
        distance,
        hurt,
        safe,
        arrived: Math.hypot(wx - x, wz - z) < 0.1,
      },
      options.reactive,
      last
    )
    if (last.trace.patrol === "success") waypoint = 1 - waypoint
    const leaf = last.interrupted.find((id) => LEAVES.has(id))
    if (leaf) lastInterrupted = leaf
  }

  let goalX = x
  let goalZ = z
  let speed = 0
  if (last.trace.patrol === "running") {
    ;[goalX, goalZ] = GUARD.waypoints[waypoint]
    speed = GUARD.patrolSpeed
  } else if (last.trace.chase === "running") {
    goalX = targetX
    goalZ = targetZ
    speed = GUARD.chaseSpeed
  } else if (last.trace.flee === "running" && distance > 0) {
    goalX = x + (x - targetX) * 100
    goalZ = z + (z - targetZ) * 100
    speed = GUARD.fleeSpeed
  }
  const toGoal = Math.hypot(goalX - x, goalZ - z)
  if (speed > 0 && toGoal > 1e-6) {
    const move = Math.min(speed * dt, toGoal)
    const dx = (goalX - x) / toGoal
    const dz = (goalZ - z) / toGoal
    x = clampTo(x + dx * move, GUARD.minX, GUARD.maxX)
    z = clampTo(z + dz * move, GUARD.minZ, GUARD.maxZ)
    heading = Math.atan2(dx, dz)
  }

  return {
    time,
    targetClock,
    x,
    z,
    heading,
    targetX,
    targetZ,
    health,
    hurt,
    safe,
    waypoint,
    tickTimer,
    last,
    lastInterrupted,
  }
}
