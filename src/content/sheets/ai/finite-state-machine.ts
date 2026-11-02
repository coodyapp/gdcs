import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "finite-state-machine",
  category: "ai",
  subcategory: "decision",
  title: "Finite State Machine",
  hook: "one state at a time, explicit events move between them",
  summary:
    "An FSM keeps an AI or character in exactly one state, such as Idle, Patrol, Chase or Attack. A table of events decides every legal transition.",
  level: "core",
  tags: ["fsm", "state machine", "ai", "behavior", "transitions"],
  updated: "2026-11-02",
  prompt:
    "Write a table-driven finite state machine in TypeScript for enemy AI in a Three.js game. Generic `StateMachine<S, E>` takes a transition table Record<S, Partial<Record<E, S>>>, an initial state and optional enter/exit/transition hooks; `send(e)` returns whether it transitioned and resets time-in-state; illegal events are ignored. Build a guard with Idle, Patrol, Chase and Attack states: sensors run at 10 Hz and emit events, with see radius 6 and lose radius 8 (hysteresis), attack range 1.2, and a 0.6 s attack commitment. Log transitions in dev. Write Vitest tests: legal transitions follow the table, illegal events leave the state unchanged, hooks run in order exit → transition → enter, and time in state resets.",
  related: [
    "steering-behaviors",
    "a-star-pathfinding",
    "hitbox-hurtbox",
    "behavior-trees",
    "utility-ai",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A finite state machine is a set of **states**, one of which is current, plus **transitions** triggered by events or conditions. Each state owns its behavior: Patrol walks waypoints, Chase steers toward the player, Attack plays a swing. Because only one state runs, you never get the contradictory combinations that a pile of booleans (`isChasing && isIdle`) allows.",
    'Write transitions as data, `table[state][event] → nextState`, and any event not in the table is ignored. The table is the design document: you can draw it, review it and test it. Give each state `enter`, `update` and `exit` hooks for one-off work like starting an animation, resetting a timer or releasing a target, and track **time in state** for timeouts such as "idle for 1.5 s, then patrol".',
    'Flat FSMs grow quickly: n states can need up to n² transitions. When many states share an exit ("any state → Dead"), use wildcard transitions or a **hierarchical** FSM (Combat as a parent of Chase and Attack). When decisions involve scoring many options, behavior trees or utility AI scale better. FSMs still drive animation, UI flows and the [hitbox frame data](/systems/collision/hitbox-hurtbox) of each attack.',
  ],
  rules: [
    "Evaluate sensor checks (distance, line of sight) once per AI tick, often at 5–10 Hz rather than every frame, and turn them into events.",
    "Add hysteresis: spot the player at 6 u but lose them at 8 u, or the agent flickers between Patrol and Chase at the boundary.",
    "Give committed states (Attack, Stagger) a minimum duration and ignore other events until it ends.",
    "Log every transition `from --event--> to` in debug builds. Most AI bugs show up there.",
    "Keep per-state data (patrol index, attack cooldown) on the agent, not in the state, so one table can run many agents.",
  ],
  code: [
    {
      lang: "ts",
      caption: "Transition table + driver:",
      code: `type S = "idle" | "patrol" | "chase" | "attack"
type E = "rested" | "spotted" | "inRange" | "done" | "lost"

const table: Record<S, Partial<Record<E, S>>> = {
  idle:   { rested: "patrol", spotted: "chase" },
  patrol: { spotted: "chase" },
  chase:  { inRange: "attack", lost: "idle" },
  attack: { done: "chase" },
}

function send(ai: Guard, e: E) {
  const next = table[ai.state][e]
  if (!next) return                     // not legal here: ignore
  states[ai.state].exit?.(ai)
  ai.state = next
  ai.timeInState = 0
  states[next].enter?.(ai)
}`,
    },
    {
      lang: "pseudo",
      caption: "Turning sensors into events each AI tick:",
      code: `d = distance(guard, player)
if state == idle   and timeInState > 1.5: send(rested)
if d < SEE_RADIUS:                         send(spotted)
if d < ATTACK_RANGE:                       send(inRange)
if d > LOSE_RADIUS:                        send(lost)
if state == attack and timeInState > 0.6:  send(done)`,
    },
  ],
  mistakes: [
    "Making transitions implicit: states set `ai.state = ...` from anywhere, so nobody can see the full graph.",
    "No hysteresis or minimum time, so agents oscillate between two states every frame.",
    "Doing one-off work (play sound, start animation) in `update` instead of `enter`, so it repeats every tick.",
    "Cramming everything into one flat FSM until it has 30 states. Split it hierarchically or move to a behavior tree.",
  ],
  reading: [
    {
      title: "MDN — State machines (JavaScript glossary)",
      url: "https://developer.mozilla.org/en-US/docs/Glossary/State_machine",
    },
    {
      title: "Game Programming Patterns — State",
      url: "https://gameprogrammingpatterns.com/state.html",
    },
  ],
  visual:
    "The white guard on the left wears a badge for its current state, coloured and shaped like the matching node in the diagram on the right: gray circle Idle, green square Patrol, yellow triangle Chase, red star Attack. The enlarged node with a white ring is the current state and the bright edge is the transition just taken. The yellow player ball wanders in, holds still to get attacked, then dashes away so the guard loses track and goes idle.",
}

export default sheet
