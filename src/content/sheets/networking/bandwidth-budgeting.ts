import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "bandwidth-budgeting",
  category: "networking",
  subcategory: "scaling",
  title: "Bandwidth Budgeting",
  hook: "fix the bytes per second, then make everything fit",
  summary:
    "Pick a bytes-per-second budget per client, stay under the path MTU, and use a priority accumulator so nothing starves when more wants sending than fits.",
  level: "common",
  tags: [
    "bandwidth",
    "MTU",
    "priority accumulator",
    "packet size",
    "send rate",
    "egress",
  ],
  updated: "2026-11-02",
  prompt:
    "Write a per-client packet builder in TypeScript for a Three.js multiplayer game server. Inputs: a budget in bytes per second, a send rate in Hz, a header size (28 for IPv4 + UDP, 48 for IPv6 + UDP), a payload limit (default 1200), and entities with a base priority and a serialized size. Each tick the wire allowance is floor(budget / rate); capacity is min(allowance - header, payload limit). Add each entity's base priority to its accumulator, sort highest first with ties by id, and walk the whole list: write what fits and skip what does not. Reset the accumulator of each entity written, and keep it for each skipped. Send no packet if nothing fits. Do not allocate per tick. Report entities too large for the capacity, since they can never be sent. Write tests: bytes in any one-second window stay within the budget; no packet exceeds the payload limit; with more data than fits, every entity is sent within a measured bound with the accumulator and the lowest-priority entity is never sent when priorities are not accumulated; (172 + 28) bytes at 20 Hz gives 4000 B/s.",
  related: [
    "interest-management",
    "state-sync-and-delta-compression",
    "quantization",
    "snapshot-interpolation",
    "latency-and-jitter",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A **bandwidth budget** is a number you pick up front: this client gets at most so many bytes per second. It may come from the slowest connection you want to support, from what you can pay for, or from both. Design the send path to meet it, instead of measuring whatever the game happens to produce. First reduce what each client needs with [interest management](/networking/scaling/interest-management). The budget decides how to share what is left.",
    "**Headers are part of the bill.** Every UDP packet carries 28 bytes over IPv4 or 48 over IPv6 before your first payload byte, and that is paid per packet, so it scales with send rate. At a fixed budget, a higher rate leaves less room for data. **Packet size has its own limit.** A packet larger than the smallest link on its route, the **path MTU**, gets fragmented or dropped. RFC 8085 says not to exceed it: losing one fragment loses the whole packet, and some NATs and firewalls drop fragments.",
    "About **1200 bytes of payload** is a common safe choice, but it is a bet on the route rather than a guarantee. It depends on the IP version, on tunnels and VPNs that add their own headers, and on your own encryption overhead. IPv6 requires every link to carry 1280 bytes, so 1200 + 48 fits with 32 to spare. IPv4 sets no such floor for fragment-free delivery, though typical Ethernet paths carry 1500.",
    "When more wants sending than fits, sorting by importance alone sends the same entities forever. A **priority accumulator** fixes this. Each tick, every entity's accumulator grows by its base priority. Sort by it, fill the packet, reset what was sent, and leave the rest. Waiting raises rank, so low-priority entities are updated less often but are never dropped. A skipped entity keeps its place at the front for the next packet. The bytes used stay the same: only who gets them changes.",
  ],
  formulas: [
    {
      label: "Wire rate",
      math: tex`\text{rate} = (\textcolor{#fdc700}{\text{payload}} + \textcolor{#d4d4d4}{h}) \times f`,
      note: "h = 28 bytes (IPv4 + UDP) or 48 (IPv6 + UDP), without options, extension headers or link-layer framing. f = send rate. (172 + 28) × 20 Hz = 4,000 B/s = 32 kbit/s.",
    },
    {
      label: "Payload per packet",
      math: tex`\textcolor{#fdc700}{\text{payload}} \le \min\left(\frac{\text{budget}}{f} - \textcolor{#d4d4d4}{h},\ \text{MTU limit}\right)`,
    },
    {
      label: "Accumulator, each tick",
      math: tex`a_i \leftarrow a_i + p_i; \qquad \text{sent} \Rightarrow a_i \leftarrow 0`,
    },
    {
      label: "Ticks between sends, estimated",
      math: tex`T_i \approx \frac{\sum_j p_j s_j}{C\, p_i}`,
      note: "p = base priority, s = state size in bytes, C = bytes per packet for state. Everything gets sent at about the same accumulated value. Across 135 parameter combinations in the simulation, the longest gap of any entity stayed within 1.23 × (T + 1), with T taken for the lowest-priority entity and floored at 1.",
    },
    {
      label: "Server egress",
      math: tex`\text{egress} = \text{clients} \times \text{rate}`,
    },
  ],
  rules: [
    "Measured in the visual at its defaults (28 entities of 16 to 32 bytes, 32 kbit/s, 20 Hz, base priorities 1 down to 0.1): with the accumulator, 3,858 B/s, 6.4 entities per packet, no entity starved, worst staleness 950 ms over a simulated hour. With it off: 3,840 B/s, 22 of 28 entities never sent.",
    "A smaller send rate saves headers. On that 32 kbit/s budget, 60 Hz spends 46% of what it sends on IP and UDP headers, fits one entity per packet and makes 60 updates/s, worst staleness 1,967 ms. 20 Hz spends 14.5% and makes 128 updates/s, 950 ms. 10 Hz spends 7% and makes 146 updates/s, 700 ms. The price of a low rate is latency: at 10 Hz, new information can wait up to 100 ms for the next packet.",
    "The accumulator shares a shortage but cannot remove it. With 64 entities on the same budget, worst staleness rose to 1,950 ms. Nothing starved, but if that is too old, raise the budget, [shrink the state](/networking/scaling/state-sync-and-delta-compression), or send fewer entities.",
    "Pick a payload limit from your route, and include your own game and encryption headers in it. 1000 to 1200 bytes is the conservative range that Gaffer On Games reports from experience. Path MTU discovery is the alternative, though RFC 8085 warns that the ICMP messages it relies on are increasingly filtered.",
    "At a low send rate the MTU becomes the limit, not the budget, if you send one packet per tick. At 128 kbit/s and 5 Hz, a 1,228-byte packet can use at most 6,140 B/s (49 kbit/s), and the visual measured 6,094 B/s of its 16,000 B/s budget.",
    "Budget egress as clients × rate. 100 clients at 4,000 B/s is 3.2 Mbit/s, or 1.44 GB an hour. 1,000 average concurrent clients for a 30-day month is 10.4 TB, so about $518 at an assumed $0.05 per GB. That price is only there for the arithmetic: use your provider's, and add anything billed on top.",
    "Treat base priorities and the staleness limit as judgement calls. A starting point is to score by distance and relevance to the player, then check worst staleness for the lowest priority. The visual flags anything older than 1,000 ms, which is a demo value and not a standard.",
  ],
  code: [
    {
      lang: "ts",
      caption: "One tick for one client. What does not fit keeps its priority:",
      code: `function buildPacket(c: Client, budget: number, hz: number) {
  const allowance = Math.floor(budget / hz)
  const capacity = Math.min(allowance - HEADER, MAX_PAYLOAD)
  for (const e of c.entities) e.accumulated += e.priority
  c.entities.sort(
    (a, b) => b.accumulated - a.accumulated || a.id - b.id
  )

  const packet = new PacketWriter(capacity)
  packet.writeHeader(c.sequence++, c.ack)
  // Walk all of them: a smaller state may fit after a bigger one did not.
  for (const e of c.entities) {
    if (e.size > packet.remaining) continue
    packet.writeState(e)
    e.accumulated = 0
  }
  return packet.entityCount > 0 ? packet : null
}`,
    },
  ],
  mistakes: [
    "Sorting by priority without accumulating. It looks fine while everything fits. Once it does not, the visual's defaults leave 22 of 28 entities frozen on the client.",
    "Counting only payload. At 60 Hz, 28 bytes per packet is 1,680 B/s before any data: 42% of a 4,000 B/s budget.",
    "Letting one entity outgrow the packet. If its state is larger than the capacity it can never be written, so it starves however high its priority climbs. Split it, or send it through a separate fragmenting channel.",
    "Letting packets grow during bursts. A packet that is usually small can cross the MTU when a burst of events or lost acks adds to it. Cap the size in the packet writer, not only in the average.",
    "Measuring your budget as an average over a minute. Short bursts are what overflow a slow link's queue, so enforce the budget per tick or with a short window.",
  ],
  reading: [
    {
      title: "Gaffer On Games — State Synchronization (priority accumulator)",
      url: "https://gafferongames.com/post/state_synchronization/",
    },
    {
      title: "Gaffer On Games — Packet Fragmentation and Reassembly (MTU)",
      url: "https://gafferongames.com/post/packet_fragmentation_and_reassembly/",
    },
    {
      title: "RFC 8085 — UDP Usage Guidelines (Section 3.2, Message Size)",
      url: "https://www.rfc-editor.org/rfc/rfc8085#section-3.2",
    },
  ],
  visual:
    "Quarter speed, high base priority on the left. Above the line, each bar is accumulated priority, solid yellow if sent this tick and a grey outline if waiting; below it, light grey columns show age, turning red with a red triangle past the white staleness line. The bottom frame is the bytes allowed per tick, holding light grey headers and yellow states, with a white tick at the MTU limit and a red diamond if anything is stale. Turn the accumulator off to starve low priorities, or raise the send rate to watch headers take over.",
}

export default sheet
