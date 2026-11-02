import { tex } from "../../tex"
import type { Sheet, SheetMeta } from "../../types"

export const meta: SheetMeta = {
  slug: "state-sync-and-delta-compression",
  category: "networking",
  subcategory: "scaling",
  title: "State Sync and Delta Compression",
  hook: "send only what changed since a snapshot the client confirmed",
  summary:
    "Send a full snapshot, or only what changed since one the client acknowledged, so a lost packet costs some bytes and never corrupts its state.",
  level: "common",
  tags: [
    "delta compression",
    "snapshots",
    "baseline",
    "acknowledgement",
    "bitmask",
    "bandwidth",
    "replication",
  ],
  updated: "2026-11-02",
  prompt:
    "Write delta compressed state sync in TypeScript for a Three.js multiplayer game, over an unreliable channel with one sender per client. Entity state is N records of fixed fields held in typed arrays. Encode to real bytes: a header with tick, how many ticks back the baseline is (0 = full snapshot) and N; a full packet is every field; a delta is a changed bitmask of ceil(N / 8) bytes, then for each set bit one field mask byte and the changed fields. The server keeps a ring of the last A + 1 sent snapshots and tracks the newest acknowledged tick, never going backwards. Each tick it diffs against that tick. It sends a full snapshot when there is no ack yet, when the ack is more than A ticks old, or when the delta would not be smaller. The client keeps its own ring of decoded snapshots, applies a delta onto the baseline the packet names (not onto its newest state), ignores packets at or below its newest tick, rejects a delta whose baseline it lacks without changing anything, and acks its newest tick every tick. Allocate nothing per tick. Write tests: on a seeded run with burst loss in both directions, the client's newest state equals the server's state for that tick on every tick; diffing against the last sent packet instead corrupts the same run; delta size grows with changed entities and with baseline age; a blackout longer than A produces a full snapshot and the client recovers.",
  related: [
    "interest-management",
    "snapshot-interpolation",
    "quantization",
    "bandwidth-budgeting",
    "latency-and-jitter",
  ],
}

const sheet: Sheet = {
  ...meta,
  what: [
    "A [snapshot](/networking/netcode/snapshot-interpolation) of the whole world repeats itself: most entities are where they were last tick. **Delta compression** sends only what differs from an earlier snapshot, the **baseline**. Each entity gets one bit saying whether it changed, and each changed entity gets a small mask saying which fields follow. The price of an entity that did nothing is a single bit.",
    "**The baseline must be one the client is known to have.** On an unreliable channel the server cannot assume its last packet arrived, and a delta against a snapshot the client never got produces wrong values with no error to notice. So the client keeps acknowledging the newest snapshot it decoded, and the server diffs against the newest acknowledgement. The packet names its baseline, and the client applies it to that snapshot, not to whatever it has now. A lost packet then costs only time and size: nothing depended on it, the next delta simply starts further back, and the client's state is always a true past state.",
    "**Both sides keep a history.** The server stores what it sent to each client, because the acknowledged snapshot may be several ticks old. The client stores what it decoded, for the same reason. Histories are finite, so when the newest acknowledgement falls out of the server's, or none has arrived yet, the only option left is a **full snapshot**. Baselines differ by client, so each client generally gets its own diff, and an entity that newly enters a client's [area of interest](/networking/scaling/interest-management) has no baseline value there and must be sent whole.",
    "**The saving depends on the world, not the code.** Bytes follow what changed since the baseline, so a quiet world compresses far better than a busy one, and a long gap in acknowledgements makes any world look busier: more entities have moved since the baseline, so the packet grows just when the network is struggling.",
  ],
  formulas: [
    {
      label: "Full snapshot",
      math: tex`B_{\text{full}} = H + N \sum_{f} b_f`,
      note: "Header H, N entities, b_f bytes per field. The visual's format has H = 7 and 7 bytes per entity, so 707 bytes at N = 100.",
    },
    {
      label: "Delta",
      math: tex`\textcolor{#fdc700}{B_{\text{delta}}} = H + \left\lceil \frac{N}{8} \right\rceil + \sum_{e\,\in\,\textcolor{#fdc700}{\text{changed}}} \Big( 1 + \sum_{f\,\in\,\text{changed}_e} b_f \Big)`,
      note: "Bitmask, then a field mask byte and the changed fields per changed entity. The tests check this byte for byte.",
    },
    {
      label: "Normal baseline age",
      math: tex`\text{age} \approx \text{RTT} \times \text{tick rate}`,
      note: "On a clean network with 200 ms round trip at 10 Hz, the simulation's baseline is exactly 2 ticks old.",
    },
    {
      label: "Share changed since a baseline k ticks old",
      math: tex`\textcolor{#fdc700}{c}(k) = 1 - (1 - p)(1 - a)^{k - 1}`,
      note: "p entities moving now, a the chance per tick that an idle one starts. Assumes walks that start and stop at random. Within 0.05 of the measured share at ages 1, 2, 4, 8 and 16 in the tests.",
    },
  ],
  rules: [
    "Measure on your own traffic, since savings depend on the game. In the visual's seeded 600 s runs at 100 entities and 10 Hz, with no loss and against 7,070 B/s of full snapshots: 5% of entities moving sends 582 B/s (saves 92%), 15% sends 1,312 B/s (81%), 30% sends 2,398 B/s (66%), 60% sends 4,589 B/s (35%). With every entity moving it still sends 6,223 B/s (12%), all of it from the field masks.",
    "Expect packets to grow while acknowledgements are missing. At 15% moving, an average delta in the same world is 105 bytes against a baseline 1 tick old, 131 at 2, 178 at 4, 260 at 8, 387 at 16 and 546 at 32, against 707 for a full snapshot. The default run's burst of 16 lost packets took deltas from 122 to 397 bytes before two 707-byte fallbacks. Loss in both directions cut the 600 s saving from 81% at none to 78% at a 10% setting (7.7% actually dropped) and 61% at 50%.",
    "Keep history long enough for the worst outage you want to ride out with deltas, as a judgement call. This visual keeps 17 slots (16 ticks, 1.6 s). Packed at 7 bytes per entity that is 11.9 KB per client at 100 entities, or about 762 KB for 64 clients. Fabien Sanglard's Quake III code review describes 32 kept snapshots per client and measured 8 MB for 4 players.",
    "Size the client's history to match. A delta can name any baseline up to the server's limit, so the client needs the same number of slots: the tests pass with `A + 1`, and a client with fewer rejects the delta rather than guessing.",
    "Compare the delta to the full snapshot on every packet. A delta can lose: with every field of all 100 entities changed it is 820 bytes against 707, and the masks are pure overhead.",
    "A changed bitmask has a fixed cost of `N / 8` bytes, so 13 bytes at 100 entities. Listing 16-bit ids instead costs 2 bytes per changed entity, which is cheaper only below `N / 16` changes. Gaffer On Games trial-encodes each packet with relative indices and falls back to changed bits when those would cost more.",
    "Plan for the full snapshot, as it is your largest packet. Over UDP on IPv4 a 1,500-byte MTU leaves 1,472 bytes of payload, which at 7 bytes per entity runs out at about 210 entities. Beyond that a fallback needs splitting into several packets, or fragments, and losing one piece loses the whole snapshot.",
  ],
  code: [
    {
      lang: "ts",
      caption:
        "Server, each tick for one client. The baseline only ever comes from an acknowledgement:",
      code: `function buildPacket(tick: number, world: Uint16Array) {
  history.store(tick, world)
  const baseline = history.get(ackedTick) // null if absent or evicted
  const age = tick - ackedTick

  if (ackedTick >= 0 && baseline && age <= MAX_AGE) {
    const size = encodeDelta(baseline, world, tick, age, out)
    if (size < FULL_SIZE) return out.subarray(0, size)
  }
  return out.subarray(0, encodeFull(world, tick, out))
}

function onAck(tick: number) {
  ackedTick = Math.max(ackedTick, tick) // acks can reorder
}`,
    },
    {
      lang: "ts",
      caption: "Client. Apply to the baseline the packet names, or not at all:",
      code: `function receive(packet: Uint8Array) {
  const tick = packetTick(packet)
  if (tick <= newestTick) return // late: a newer state already won
  const back = packetBack(packet)
  const baseline = back === 0 ? null : history.get(tick - back)
  if (back !== 0 && !baseline) return // no baseline: drop, never guess
  decodePacket(packet, baseline, scratch)
  history.store(tick, scratch)
  newestTick = tick
}

// Every tick, with the inputs. No retransmit: the next ack replaces a lost one.
sendToServer({ inputs, ack: newestTick })`,
    },
  ],
  mistakes: [
    "Diffing against the last packet sent. In a seeded 60 s run with 100 entities and 10% loss, that left the client wrong on 562 of 599 ticks, with 19 of 100 entities wrong on average. Acknowledged baselines gave 0 wrong ticks on the same world and network. It is silent, too: an entity that stops moving keeps its wrong value, as nothing sends that field again.",
    "Applying a delta to the client's newest state instead of the baseline it names. A door that opened and closed since the baseline is not in the delta, as it matches again, so the client's newest state keeps it open. If fields are sent as small differences rather than absolute values, every changed field goes wrong.",
    "Putting one-shot events in delta state. A delta only carries the net change, so health going 100, 90, 100 between baseline and now sends nothing, and the hit never shows. Send events on their own stream.",
    "Retransmitting lost snapshots or sending them reliably. The next delta already covers everything the lost one held, and a retransmit only delivers old data late.",
    "Sending a full snapshot every tick for as long as a client stays silent. That is 7,070 B/s against 1,312 B/s in the runs above, to a client whose link is already failing. Slowing the rate until an ack returns is a judgement call worth making.",
  ],
  reading: [
    {
      title: "Gaffer On Games — Snapshot Compression",
      url: "https://gafferongames.com/post/snapshot_compression/",
    },
    {
      title: "Fabien Sanglard — Quake 3 Source Code Review: Network Model",
      url: "https://fabiensanglard.net/quake3/network.php",
    },
  ],
  visual:
    "Grid: a large solid yellow square changed this tick, a small yellow square changed earlier and is still in the packet because the baseline is older, a small grey dot is unchanged but sent anyway in a full snapshot, and an empty grey outline costs one bit. Strip: one bar per packet with height in bytes, against a dashed white line at full snapshot size: yellow is a delta, white a full snapshot, and grey under a red cross was lost. The default run loses 16 packets in a row about 2 s in, so deltas climb until the baseline is too old and two white bars fall back. A bar that climbs with no cross means an acknowledgement was lost on the way back. Raise entities moving to shrink the saving, or turn delta off.",
}

export default sheet
