import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "behavior-trees",
  category: "ai",
  subcategory: "decision",
  title: "Behavior Trees",
  hook: "tick from the root, and child order is the priority",
  summary:
    "A behavior tree picks what an agent does by walking sequences and selectors from the root. Each node reports success, failure or running.",
  level: "common",
  tags: ["behavior tree", "bt", "ai", "selector", "sequence", "blackboard"],
  updated: "2026-11-02",
  prompt:
    "Write a pure behavior tree evaluator in TypeScript for enemy AI in a Three.js game. Node kinds: sequence, selector, decorator (a function mapping the child's status), condition and action, each returning 'success', 'failure' or 'running'. `tick(root, blackboard, reactive, previous)` returns { status, trace, running, interrupted } without mutating anything: `trace` maps each visited node id to its status, `running` maps each composite id to its running child's index, and `interrupted` lists nodes that were running last tick and were not reached. With reactive true every composite restarts at child 0; with false it resumes at the remembered index. Handle empty composites (a sequence succeeds, a selector fails). Build a guard: selector(sequence(hurt?, flee), sequence(near?, chase), patrol), ticked at 10 Hz. Write Vitest tests: a sequence stops at the first failure, a selector stops at the first success, running propagates and blocks later siblings, a higher priority interrupts a running child in reactive mode and reports it in `interrupted`, and memory mode resumes the running child without re-checking earlier ones.",
  related: ["finite-state-machine", "utility-ai", "steering-behaviors"],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A behavior tree decides what an agent does by walking from the root on every **tick**. Each node answers with one of three statuses: `success`, `failure`, or `running` for work that needs more ticks. Leaves do the real work: **conditions** check something and **actions** do something. Inner nodes only combine those answers.",
    "A **sequence** is an AND: it runs children left to right and stops at the first one that does not succeed. A **selector** is an OR: it stops at the first one that does not fail. A **decorator** wraps one child and changes its result or when it runs, such as an inverter. Because a selector tries children in order, **priority is simply child order**: put fleeing before chasing and chasing before patrolling, and you have written the priority list without a single transition.",
    "The main design choice is what happens to a running child. A **reactive** composite restarts from its first child each tick, so an urgent branch can cut in at once, at the cost of re-checking every higher priority. A composite **with memory** resumes the running child and skips what came before, which is cheaper and suits steps that must finish, but it stays blind to anything it skipped. Many trees mix both, and engines differ: Unreal's trees are event-driven and interrupt through a decorator's Observer Aborts setting instead of re-walking the tree.",
    "Shared data lives on a **blackboard**, a per-agent key-value store that sensors write and conditions read, so one tree definition can drive many agents. If you only have a few states and every transition matters individually, as in a door, an animation or a menu, a [finite state machine](/ai/decision/finite-state-machine) is usually simpler and easier to verify. Trees pay off when priorities keep growing and branches get reused. The chosen action can then hand off to [steering](/ai/steering/steering-behaviors) for the actual movement.",
  ],
  rules: [
    "Order a selector's children from most to least urgent, and end with a fallback that cannot fail, such as idle or patrol, so the root always has something to do.",
    "A fixed AI rate such as 5–10 Hz is a reasonable start for enemies that are not twitch-sensitive. At 10 Hz a change can wait up to 100 ms to be seen, so fast melee may need a higher rate.",
    "Reactive ticks re-run every higher priority: the tree in this visual visits 6 nodes on a reactive patrol tick and 2 with memory. Keep conditions cheap and let sensors cache raycasts on the blackboard at their own rate.",
    "Memory delays reactions by as long as the running action lasts. The patrol leg here is 3.4 u at 1.1 u/s, so a memory-mode guard can ignore a target for up to about 3.1 s. Keep memory actions short or give them a timeout.",
    "Conditions need hysteresis just as FSM transitions do. This guard flees below 30 health and stays hurt until fully healed, and it counts as safe at 3 u but only runs again at 2.2 u. Tune those values to your own game.",
    "Keep trees stateless and store per-agent data (running index, timers, cooldowns) outside them, so many agents can share one definition.",
  ],
  code: [
    {
      lang: "ts",
      caption:
        "A composite tick. `reactive` decides whether it restarts or resumes:",
      code: `function tickComposite(node: Composite, ctx: Ctx): Status {
  // A sequence continues on success, a selector on failure.
  const keepGoing = node.kind === "sequence" ? "success" : "failure"
  const start = ctx.reactive ? 0 : (ctx.prevRunning[node.id] ?? 0)

  for (let i = start; i < node.children.length; i++) {
    const status = tickNode(node.children[i], ctx)
    if (status === keepGoing) continue
    if (status === "running") ctx.running[node.id] = i
    return status // first non-continuing child decides
  }
  return keepGoing // ran out of children
}

// After the tick: halt whatever was running and did not get reached.
for (const id of ctx.prevRunningLeaves) {
  if (!ctx.reached.has(id)) leaves[id].halt?.(agent)
}`,
    },
    {
      lang: "pseudo",
      caption:
        "The guard in the visual. Priority is read top to bottom, with no transitions:",
      code: `selector
  sequence
    hurt?          // blackboard: health < 30, latched until healed
    flee           // running until 3 u away
  sequence
    near?          // blackboard: distance < 1.5 u
    chase          // success on contact, failure past 3.2 u
  patrol           // success on arriving at a waypoint`,
    },
  ],
  mistakes: [
    "Not cleaning up an interrupted action. A reactive tree simply stops reaching it, so its path request, animation or reserved cover point stays active unless a halt hook releases it.",
    "Placing a child that never fails before others in a selector: everything after it is unreachable. A patrol placed first means the guard never chases.",
    'Returning `failure` to mean "not finished". The parent treats it as a real failure and moves on, so long actions must report `running`.',
    "Putting side effects in conditions. Reactive mode runs them every tick and memory mode skips them, so behavior changes when you switch modes.",
    "Assuming every engine re-evaluates the same way. Check whether yours restarts, resumes or waits for events before designing around interruption.",
  ],
  reading: [
    {
      title: "Game AI Pro — The Behavior Tree Starter Kit",
      url: "https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter06_The_Behavior_Tree_Starter_Kit.pdf",
    },
    {
      title: "Unreal Engine — Behavior Tree Overview",
      url: "https://dev.epicgames.com/documentation/en-us/unreal-engine/behavior-tree-in-unreal-engine---overview",
    },
    {
      title: "Colledanchise & Ögren — Behavior Trees in Robotics and AI",
      url: "https://arxiv.org/abs/1709.00084",
    },
  ],
  visual:
    "The tree on the right lights up for the current tick: yellow dashed outline is running, solid green fill is success, red outline with an X badge is failure, and a thin grey outline was not touched. Pill shapes are conditions. In the world on the left the white ball is the guard, the grey diamond is the target, the dashed ring is the near radius, and the bar shows health with a tick at the flee threshold. Turn Reactive off and the earlier branches go grey while patrol runs, so the guard walks straight past the target until it reaches its waypoint. Lower Agent health below 30 and it only ever flees.",
}

export default sheet
