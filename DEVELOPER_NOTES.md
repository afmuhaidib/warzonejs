# WarZone JS — Developer Notes

Companion to `ARCHITECTURE.md` (layering, module map, event registry). This file
covers the AI architecture in depth and where every tuning knob lives.

Run it: `python3 -m http.server 8000` inside `warzoneJS/`, open `http://localhost:8000`.
Press **F1** in game for the AI debug overlay (vision cones, paths, states, squad roles).

---

## AI architecture

Every enemy ticks the same pipeline each frame (`ai/Enemy.js → update`):

```
Perception → Behavior Tree → turn toward desiredAngle → weapon update
```

### 1. Perception (`ai/Perception.js`)

No omniscience. An enemy learns the player's position through exactly three channels:

- **Vision** — distance check (base 430px) × a ~110° cone × a DDA line-of-sight
  raycast against vision-blocking tiles. Low cover (crates, sandbags) does *not*
  block vision, so you can be tracked over a crate — but it blocks bullets, so
  both sides must peek to land hits. Modifiers: crouching ×0.55 view distance,
  sprinting ×1.2, firing within the last 0.5s ×1.6 (muzzle flash gives you away).
- **Hearing** — gunshots and sprint footsteps emit `'sound'` events with a radius
  (`AIManager.onSound` fans them out). A heard sound primes awareness to 0.6 and
  plants an `alertPos` to check — it never reveals exact position.
- **Communication** — `'enemy:spotted'` events propagated by the SquadCoordinator.

**The awareness meter (0..1) is the reaction-time model.** Visibility fills it at
`proximity / reactionTime` per second; losing sight decays it at 0.18/s. The enemy
only "sees" you (locks `lastKnownPos`, may shoot) at 1.0. The yellow `?` bar above
an enemy's head is this meter filling — your window to act first.

### 2. Behavior tree (`ai/BehaviorTree.js`, `ai/behaviors/*`)

A reactive tree (re-evaluated from the root every tick) shared by all enemies;
per-enemy state lives on the blackboard `enemy.bb`. Priority order:

```
Selector
├─ Retreat      health < 35 AND within a 5s retreat window
├─ Combat       lastKnownPos AND (canSee OR seen < 5s ago)
│   ├─ Suppress   squad role: anchor at cover, fire at last known pos,
│   │             blind bursts for 2.5s after losing sight (keeps you pinned)
│   ├─ Flank      squad role: swing ~110° around you at 240px radius,
│   │             holds fire on the move, opens up on side-angle LOS
│   └─ Engage     default: claim a cover spot facing you, duck/peek —
│                 fire with LOS, sidestep around cover to re-acquire it
├─ Investigate  walk to the suspicious position, sweep, stand down
├─ Alert        0.7s "what was that?" face-the-noise beat → Investigate
└─ Patrol       walk random patrol points at half speed, scan pauses
```

Because the tree is reactive, sight contact instantly preempts Investigate, and
dropping to critical health instantly preempts combat.

### 3. Navigation

- **A\*** (`ai/Pathfinder.js`) — 8-directional on the collision grid, no corner
  cutting, octile heuristic, string-pull smoothing (waypoints survive only where
  a straight ray is blocked). Scratch arrays are reused; zero per-query allocation.
  Repaths are throttled per enemy (0.45s) and skipped when the goal hasn't moved >60px.
- **Flow field** (`ai/FlowField.js`) — when a spot callout goes out, ONE BFS field
  toward the contact is computed and every converging enemy samples its local
  direction. N runners share one search instead of N A* queries.

### 4. Cover (`world/CoverSystem.js`)

Built at map-generation time: every walkable tile adjacent to a cover tile is a
spot with a direction vector into the cover. Queries score spots by
`dot(spot→cover, spot→threat)` — the cover must actually sit between the spot and
the threat. Spots are claimed/released so two enemies never stack.

### 5. Squad logic (`ai/SquadCoordinator.js`)

Enemies spawn into squads of 3. On `'enemy:spotted'`: the contact propagates to
everyone within 560px *plus* all squadmates (radio), and the shared flow field
recomputes. Every 1s, each squad in contact re-deals roles: best sight line →
**suppress**, next → **flank**, rest → plain engage. A lone survivor just engages.

### 6. Difficulty scaling (`ai/DifficultyScaler.js`)

`level = clamp(score / 2500)`. All knobs are straight lerps from rookie → veteran:

| Knob | level 0 | level 1 | Effect |
|---|---|---|---|
| `reactionTime` | 0.55s | 0.18s | how fast the awareness meter fills |
| `aimError` | 0.085 rad | 0.024 rad | gaussian noise on every enemy shot |
| `aggression` | 0.35 | 1.0 | >0.7: enemies push you instead of holding cover |
| `maxEnemies` | 6 | 13 | live population cap |
| `respawnDelay` | 6s | 2.2s | reinforcement interval |

---

## Tuning cheat sheet

| What | Where |
|---|---|
| Gun stats (damage, ROF, spread, mags, range…) | `weapons/AssaultRifle.js` / `Shotgun.js` / `SniperRifle.js` config blocks |
| Enemy gun nerfs + loadout weights + drop chance | `LOADOUTS`, `DROP_CHANCE` in `ai/AIManager.js` |
| Player movement speeds, footstep noise | constants atop `player/PlayerController.js` |
| Vision range/FOV, hearing priming, awareness decay | constants atop `ai/Perception.js` |
| Retreat threshold & window | `RETREAT_HEALTH`, `RETREAT_WINDOW` in `ai/behaviors/Retreat.js` |
| Suppression blind-fire window/spread | constants atop `ai/behaviors/Suppress.js` |
| Flank radius/angle/open-fire range | constants atop `ai/behaviors/Flank.js` |
| Squad size, callout radius, role re-deal rate | `ai/AIManager.js` + `ai/SquadCoordinator.js` |
| Difficulty curve endpoints | `ai/DifficultyScaler.js` |
| Map size, layout density | `world/MapGenerator.js` (`MAP_W/H` + placement steps) |
| Tile semantics (what blocks bullets vs vision) | `world/TileTypes.js` |
| Screen shake feel | `MAX_OFFSET`, `DECAY` in `effects/ScreenShake.js` |
| Score per kill, spawn keep-out distance | `ai/AIManager.js` |

## Performance notes

- The world is pre-rendered once per map into an offscreen canvas slice
  (`MapRenderer` via `AssetLoader`); per-frame map cost is one `drawImage`.
- Bullets are pooled (`BulletPool` + `utils/ObjectPool`), hit-tested as segments
  (no tunneling at any speed), and capped only by their range.
- Effects are capped at 400 live objects; minimap terrain is pre-rendered.
- A* uses persistent typed-array scratch buffers; flow fields recompute only
  when the contact tile changes.
