import { describe, expect, it } from "vite-plus/test"

import { StateMachine, type TransitionTable } from "./fsm"

type S = "idle" | "patrol" | "chase" | "attack"
type E = "rested" | "spotted" | "inRange" | "done" | "lost"

const table: TransitionTable<S, E> = {
  idle: { rested: "patrol", spotted: "chase" },
  patrol: { spotted: "chase" },
  chase: { inRange: "attack", lost: "idle" },
  attack: { done: "chase" },
}

describe("StateMachine", () => {
  it("follows legal transitions and resets the state timer", () => {
    const m = new StateMachine(table, "idle")
    m.update(1.5)
    expect(m.time).toBe(1.5)
    expect(m.send("rested")).toBe(true)
    expect(m.state).toBe("patrol")
    expect(m.time).toBe(0)
    m.send("spotted")
    m.send("inRange")
    expect(m.state).toBe("attack")
  })

  it("ignores events with no entry in the table", () => {
    const m = new StateMachine(table, "patrol")
    expect(m.can("inRange")).toBe(false)
    expect(m.send("inRange")).toBe(false)
    expect(m.state).toBe("patrol")
  })

  it("runs exit → transition → enter in order", () => {
    const log: string[] = []
    const m = new StateMachine(table, "idle", {
      enter: (s) => log.push(`enter:${s}`),
      exit: (s) => log.push(`exit:${s}`),
      transition: (a, b, e) => log.push(`${a}-${e}->${b}`),
    })
    m.send("spotted")
    expect(log).toEqual([
      "enter:idle",
      "exit:idle",
      "idle-spotted->chase",
      "enter:chase",
    ])
  })
})
