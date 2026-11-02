import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "deterministic-lockstep",
  category: "networking",
  subcategory: "netcode",
  title: "Deterministic Lockstep",
  hook: "send only inputs, and let no one move until everyone has them",
  summary:
    "Peers wait for every input of a turn, then all advance. Huge unit counts cost almost no bandwidth, but the slowest peer sets the pace.",
  level: "advanced",
  tags: [
    "lockstep",
    "netcode",
    "determinism",
    "rts",
    "peer to peer",
    "desync",
    "checksum",
  ],
  updated: "2026-11-02",
  prompt:
    "Write a deterministic lockstep core in TypeScript with no rendering. Inputs: a pure `step(state, inputs)` over integer state, `sample(turn)` for the local player, `turnMs`, `delayTurns`, a list of peers and a `send`/`receive` pair. When a peer starts turn t it samples its input, tags it for turn t + delayTurns and sends it to every other peer with the checksum of its state after turn t. Keep an inbox per peer indexed by turn. Start the next turn only when at least `turnMs` has passed and the inbox holds an input from every peer, including empty ones; treat the first delayTurns turns as empty for everyone. Apply inputs in peer order, never arrival order. Compare received checksums with your own by turn, and report the earliest turn that differs. Report stalled time per turn. Render between the last two turns, and never let rendering write to state. Edge cases: an input that arrives before its turn is needed, inputs that arrive out of order, a peer that stops sending (time out instead of waiting forever). Write seeded tests: all peers produce identical checksums at any latency, no turn runs before all its inputs have arrived, a one-unit nudge is reported at its exact turn, and a higher delay never stalls more at the same latency.",
  related: [
    "rollback-netcode",
    "fixed-timestep",
    "snapshot-interpolation",
    "frame-budget",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "Instead of telling each other where every unit is, peers tell each other what the players **did**. Everyone starts from the same state and runs the same deterministic simulation, so the same inputs give the same world, bit for bit. Traffic follows the size of the inputs, not the number of units, which is why this is the classic RTS model: a thousand archers cost the same to network as one.",
    "The rule is **no peer runs a turn until it holds every peer's input for that turn**. Waiting for the network each turn would make the game stutter, so inputs are **scheduled a few turns ahead**: when you start turn 10 with a delay of 2, your input is tagged for turn 12 and sent right away. It has two turn lengths to arrive, and the game runs [at a fixed turn rate](/systems/simulation/fixed-timestep) meanwhile. Rendering interpolates between turns, so a 10 Hz simulation can still draw smoothly at 60 fps.",
    "When an input misses its turn, every peer **stalls**, because none of them may move on without it. So the worst link, or the [slowest CPU](/performance/cpu/frame-budget), sets the pace for everyone, and two peers with a perfect connection to each other still freeze when a third one lags.",
    "This is the opposite bet from [rollback netcode](/networking/netcode/rollback-netcode). Both send only inputs over a deterministic sim, but rollback **predicts** the missing input and repairs mistakes, which suits games where every frame of control lag hurts and the state is small enough to re-simulate. Lockstep **waits**, which needs no save states and no re-simulation, so it scales to worlds far too big to rewind, at the price of input lag and freezes. Neither survives a broken sim, so peers exchange **checksums** of their state and treat any difference as a desync.",
  ],
  formulas: [
    {
      label: "Stall-free latency budget",
      math: tex`L \le \textcolor{#fdc700}{D} \cdot T`,
      note: "L = worst one-way latency, D = scheduling delay in turns, T = turn length. Inputs are sent at turn start. Also the minimum input lag: a command waits D · T to take effect, plus any time until the next turn starts.",
    },
    {
      label: "Pace when latency exceeds the budget",
      math: tex`T_{\text{real}} = \max\left(T,\; \frac{L}{\textcolor{#fdc700}{D}},\; T_{\text{cpu}}\right)`,
      note: "Assumes the worst link is equally slow both ways. T_cpu is the slowest peer's time per turn. At T = 100 ms, D = 2 and L = 300 ms, the seeded run settles at exactly 150 ms per turn on all peers.",
    },
    {
      label: "One peer's upload, full mesh",
      math: tex`B = \frac{(P - 1)(h + s)}{T}`,
      note: "P = peers, h = packet header, s = payload. With inputs, s is a constant. With state, s = units × bytes per unit.",
    },
  ],
  rules: [
    "Count the savings before you commit. With 3 peers and 100 ms turns, a 12-byte input message plus 28 bytes of IPv4 and UDP header is 800 B/s of upload at any unit count. Sending 12 bytes per unit, uncompressed, costs 72.6 KB/s at 300 units and 720.6 KB/s at 3000.",
    "Size the delay from measured latency: `D = ceil(L / T)`, then add margin for jitter. In the seeded run (100 ms latency, spiking to 400 ms for 0.6 s in every 2 s, 100 ms turns, 1000 turns), a delay of 1, 2, 3 and 4 turns stalled 43.2, 25.2, 11.2 and 0 seconds.",
    "Delay is input lag, so show a local response at once: a sound or a click marker on press, with the units following when the turn comes. Age of Empires' tests found 250 ms of command latency went unnoticed in an RTS and 250–500 ms was very playable. Those are RTS numbers, so do not apply them to a fighting game.",
    "Treat turn length as a tuning value, starting near 100–200 ms for an RTS. Age of Empires typically ran 200 ms turns with commands two turns ahead, and adjusted turn length as conditions changed. Supreme Commander ran its simulation at a fixed 10 Hz.",
    "Adapt to the slowest peer, not the average: raise turn length or delay quickly when latency jumps, and lower it slowly. Age of Empires weighted its turn length to do this, using ping and frame times that each machine reported.",
    "Send a checksum with each input message, and cover all of the game state, including the PRNG state and order queues. Hashing only every N turns is cheaper, but a mismatch then says only that the cause lies in the last N turns: in the seeded run, a nudge at turn 61 checked every 10 turns is caught at turn 70.",
    "Plan for joining and leaving from the start. A late joiner needs the full state, which is the very thing this model avoids sending, so some RTS games do not allow it. A peer that stops responding freezes everyone, so time it out. The same inputs do give you tiny replays for free, until a patch changes the simulation.",
  ],
  code: [
    {
      lang: "ts",
      caption:
        "One peer's loop. `inbox[turn]` fills up as messages arrive, in any order:",
      code: `function update(now: number) {
  const next = turn + 1
  if (now < nextTurnAt) return // too early
  if (!holdsAllInputs(inbox[next])) return // stall: nobody may guess

  // Peer order, not arrival order, or the worlds fork.
  state = step(state, inbox[next].inPeerOrder())
  turn = next
  nextTurnAt = now + turnMs

  // Schedule this peer's next input ahead of time.
  const input = sampleLocalInput()
  const target = turn + delayTurns
  inbox[target].set(me, input)
  broadcast({ turn: target, input, hashTurn: turn, hash: hash(state) })
}

// Rendering only reads state.
function render(now: number) {
  const t = Math.min(1, (now - turnStartedAt) / turnMs)
  draw(previousState, state, t)
}`,
    },
    {
      lang: "pseudo",
      caption: "Desync check, comparing by turn number:",
      code: `on receive(msg):
    inbox[msg.turn].set(msg.from, msg.input)
    hashes[msg.hashTurn].set(msg.from, msg.hash)
    if I have run msg.hashTurn and myHash(msg.hashTurn) != msg.hash:
        stop the game, report earliest differing turn,
        dump state and inputs for that turn`,
    },
  ],
  mistakes: [
    "Letting anything but inputs reach the simulation. Unseeded random numbers, wall-clock time, a physics engine with its own hidden randomness, iterating a hash map, a camera or a UI value that a unit reads: each one forks the world, silently.",
    "Assuming floats are safe because the code is the same. Results can differ across compilers, operating systems and instruction sets, and possibly even between debug and release builds. Fixed-point math is the usual way out for cross-platform play; otherwise test every target.",
    "Reading the first bad checksum as the cause. It only marks where the difference first reached hashed state. Age of Empires' desyncs could show up as different food amounts, minutes after the real cause, so log inputs and per-system hashes to trace back.",
    "Sending inputs over plain TCP or resending only after a loss is noticed. Since a lost input stalls everyone until it is resent, Gaffer On Games shows visible hitches over TCP at 100 ms and 1% loss, and instead repeats all unacknowledged inputs in every UDP packet.",
    "Assuming lockstep stops every cheat. A modified client's actions show up as a desync, but each machine still holds the whole game state, so a map hack that only reads it goes unseen.",
  ],
  reading: [
    {
      title:
        "1500 Archers on a 28.8: Network Programming in Age of Empires and Beyond",
      url: "https://www.gamedeveloper.com/programming/1500-archers-on-a-28-8-network-programming-in-age-of-empires-and-beyond",
    },
    {
      title: "Gaffer On Games — Deterministic Lockstep",
      url: "https://gafferongames.com/post/deterministic_lockstep/",
    },
    {
      title: "ForrestTheWoods — Synchronous RTS Engines and a Tale of Desyncs",
      url: "https://www.forrestthewoods.com/blog/synchronous_rts_engines_and_a_tale_of_desyncs/",
    },
  ],
  visual:
    "Three peers, one per row, in slow motion (1/4 speed): the left panel is that peer's copy of the world, and the strip is its turns, with a white bar at its current turn. Solid grey cells were executed, thin grey outlines hold all their inputs, yellow dashed outlines are waiting for one, and a red diamond is a stall that grows with its length. Small green squares mark turns whose checksums agree; with a desync on, a red cross and a white line mark the first turn that differs, and differing units turn red and larger on the bottom peer. Raise the scheduling delay until the diamonds vanish, or raise the bottom peer's latency to watch the two fast peers freeze too. Bandwidth assumes 3 peers, 100 ms turns, no packet loss or compression, a 12-byte input message, 12 bytes per unit for state, and 28 bytes of IPv4 and UDP header.",
}

export default sheet
