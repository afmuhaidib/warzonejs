# WarzoneJS — Issues Log & Multiplayer Plan (working notes)

Scratch file produced while investigating the AI asymmetry and scoping the
"play with friends" feature. Safe to delete once the work lands.

---

## 1. Why the opponent AI ≠ the teammate AI (root cause)

They are **two completely independent AI implementations** that were written at
different times and never share code:

| | Enemies (`ai/Enemy.js` + `ai/behaviors/*` + `Perception` + `SquadCoordinator`) | Friendlies (old `player/FriendlyAgent.js`) |
|---|---|---|
| Sensing | Realistic: 110° vision cone, 430px range, awareness/reaction-time meter, hearing, squad radio, memory drift | **Omniscient** — scanned ~1300px ignoring vision cone & LOS gating |
| Aim | Difficulty-scaled gaussian error + predictive lead + tracking bonus + suppression widening | **Fixed** 0.08 rad spread, no lead, no tracking |
| Tactics | Behavior tree: Retreat ▸ Suppress/Flank/Engage ▸ Investigate ▸ Alert ▸ Patrol; cover use; grenades; squad roles; morale/avenge | 4-state machine (follow/hunt/engage/retreat); naive "rotated approach vector"; no cover, no grenades, no suppression, no roles |
| Health | 100 | **220** + 12 HP/s regen on retreat |

Net effect: friendlies *felt* stronger (tanky + always-accurate + omniscient)
but were tactically shallow; enemies were tactically rich but handicapped by
perception and scaled aim error. The behaviour differs because the **code base
differs**, not because of tuning.

### Fix shipped
`FriendlyAgent` now **extends `Enemy`** and reuses the exact same `Perception`
and behavior tree. Only team-specific bits are overridden: team id, callsign,
death → `friendly:died` + near-player respawn, a soft "leash" so they loiter
near the player when out of contact, and a small heal-while-retreating perk.
Both sides now share one brain → identical intelligence. `DifficultyScaler`
floors were raised so both teams are lethal from score 0 ("dominate").

Supporting fixes:
- `SquadCoordinator.propagate` now ignores non-enemy spotters (a friendly
  emitting `enemy:spotted` via shared `Perception` must not hand enemies free
  intel).
- `ExplosionSystem` now includes `game.friendlies` in the blast target list
  (they were previously immune to all explosions — latent bug).
- `AIManager.onSound` now routes gunshots to friendlies too (hearing parity).

---

## 2. All NPCs use AK weapons
- `ai/AIManager.js` `LOADOUTS` → single AK-47 entry (kept reduced damage: enemy
  lethality lever is accuracy, not raw damage — keeping it playable).
- `FriendlyAgent` weapon → AK-47.
- Drops were already AK-47.

---

## 3. Bug scan — findings

Old/latent:
- **B1** Friendlies immune to explosions (`ExplosionSystem` target list omitted
  `game.friendlies`). → fixed.
- **B2** Friendlies couldn't hear gunfire (`onSound` only looped enemies).
  → fixed (now they share the enemy brain + hearing).
- **B3** Shared `Perception`/`Enemy.damage` emit `enemy:spotted`; once friendlies
  use that brain, `SquadCoordinator` would propagate friendly contacts to the
  enemy team. → guarded.

New (introduced by the unification — watched for during the refactor):
- **B4** `Enemy.update` early-returns on `health<=0`; a dead friendly still needs
  its respawn timer ticked. → handled in `FriendlyAgent.update` override.
- **B5** `Enemy.die` emits `enemy:killed` (score/drops/morale). Friendlies must
  not. → `die()` overridden to emit `friendly:died` only.
- **B6** `GameModeManager.start` sets `f._insertTimer`; preserved on the subclass.

New (multiplayer): see §4 — net layer is fully gated; if PeerJS fails to load or
a peer drops, the game cleanly continues single-player. Single-player update/draw
paths are byte-for-byte unchanged when `game.net` is inactive.

---

## 4. Play-with-friends feature

### Constraint
The game is a **static** site on Netlify — no backend, no game server. Real-time
play therefore uses **WebRTC peer-to-peer** via **PeerJS** (free public broker
for signaling only; gameplay traffic is direct P2P). Loaded lazily from CDN so
the zero-dependency single-player bundle is untouched.

### Shipped (v1 — presence co-op)
- Lobby in `ui/MainMenu.js`: **HOST GAME** → shows a short room code; **JOIN
  GAME** → enter a friend's code. Both then deploy into the same match.
- **Synced map**: the match seed is derived from the room code, so every peer
  generates the identical map (`generateMap(seed)` is deterministic). The net
  layer rebuilds `map / mapRenderer / minimap / camera bounds / pathfinder /
  flowField` from the shared seed at match start.
- **Remote players**: each peer broadcasts its player state ~20 Hz (pos, angle,
  health, firing, weapon, alive, name); friends appear as live green avatars
  with callsign + health bar and muzzle flashes.
- Fully isolated in `net/NetManager.js` + `net/RemotePlayer.js`. All hooks are
  `game.net?.…` and no-op when not networked.

### Deliberately local in v1 (documented limitation)
Each peer still simulates its **own** enemies/bullets/pickups. Remote avatars
are presence-only (not damageable in your local sim) — this avoids authority
transfer and the desync/divergence failure modes that untested authoritative
netcode would introduce. You share the map, the mode, and see/coordinate with
friends live.

### Next phase (host-authoritative shared combat — not in v1)
1. Host runs the only authoritative sim; clients become thin renderers.
2. Add `game.remotePlayers` to the target loops in `weapons/Bullet.js`,
   `ai/Perception.js`, `combat/ExplosionSystem.js` (all already team-aware).
3. Client input → host; host echoes authoritative health/snapshots back.
4. Snapshot enemies/friendlies/bullets at ~20 Hz with delta compression and
   client-side interpolation; client-side prediction for the local player.
This is the right architecture but needs two-machine testing before shipping.
