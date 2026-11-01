/**
 * Table-driven finite state machine. The table is the whole design: every
 * legal (state, event) pair maps to a next state; anything else is ignored.
 */
export type TransitionTable<S extends string, E extends string> = Record<
  S,
  Partial<Record<E, S>>
>

export interface FsmHooks<S extends string, E extends string> {
  enter?: (state: S) => void
  exit?: (state: S) => void
  /** Called after exit and before enter. */
  transition?: (from: S, to: S, event: E) => void
}

export class StateMachine<S extends string, E extends string> {
  state: S
  /** Seconds since the current state was entered (advance with `update`). */
  time = 0

  constructor(
    private readonly table: TransitionTable<S, E>,
    initial: S,
    private readonly hooks: FsmHooks<S, E> = {}
  ) {
    this.state = initial
    hooks.enter?.(initial)
  }

  /** Returns true when the event caused a transition. */
  send(event: E): boolean {
    const next = this.table[this.state][event]
    if (next === undefined) return false
    const from = this.state
    this.hooks.exit?.(from)
    this.state = next
    this.time = 0
    this.hooks.transition?.(from, next, event)
    this.hooks.enter?.(next)
    return true
  }

  can(event: E): boolean {
    return this.table[this.state][event] !== undefined
  }

  update(dt: number) {
    this.time += dt
  }
}
