# WarZone JS — Architecture Plan

A top-down, Call-of-Duty-style browser shooter. Canvas 2D, zero external assets,
zero dependencies, pure ES modules. Every system is its own file; `main.js` only boots.

## High-level layering

```
┌─────────────────────────────────────────────────────────┐
│ main.js  (entry point — boots core/Game)                │
├─────────────────────────────────────────────────────────┤
│ core/    Game loop · Canvas · Input · EventBus · Assets │
│ utils/   Vector2 · MathUtils · Grid · ObjectPool · Debug│
├─────────────────────────────────────────────────────────┤
│ world/   Map · Generator · Renderer · Collision · Cover │
│          TileTypes · Minimap                            │
├─────────────────────────────────────────────────────────┤
│ player/  entity · controller · combat · renderer · HUD  │
│ weapons/ manager · base weapon · 3 guns · bullets · drops│
│ effects/ flash · shake · tracer · spark · shells        │
│ ui/      UIManager · KillFeed · DeathScreen · PauseMenu │
├─────────────────────────────────────────────────────────┤
│ ai/      AIManager · Enemy · Perception · BehaviorTree  │
│          behaviors/* · Squad · A* · FlowField · Difficulty│
└─────────────────────────────────────────────────────────┘
```

Dependency rule: **lower layers never import from higher layers.** Cross-system
communication that would create cycles goes through `core/EventBus` or through the
`game` context object that `core/Game` passes down.

## Module dependency map

| Module | Depends on |
|---|---|
| `main.js` | core/Game |
| `core/Game.js` | everything (composition root + state machine) |
| `core/Canvas.js` | — |
| `core/InputManager.js` | — |
| `core/EventBus.js` | — |
| `core/AssetLoader.js` | — |
| `core/Camera.js` | utils/Vector2 |
| `utils/*` | — (leaf layer) |
| `world/TileTypes.js` | — |
| `world/MapGenerator.js` | TileTypes, utils/Grid, utils/MathUtils, utils/Vector2 |
| `world/CollisionMap.js` | TileTypes, utils/Vector2 |
| `world/CoverSystem.js` | TileTypes, utils/Vector2 |
| `world/Map.js` | MapGenerator, CollisionMap, CoverSystem |
| `world/MapRenderer.js` | TileTypes, AssetLoader, utils/MathUtils |
| `world/Minimap.js` | TileTypes |
| `player/Player.js` | utils/Vector2, EventBus (via game) |
| `player/PlayerController.js` | InputManager, CollisionMap (via game) |
| `player/PlayerCombat.js` | WeaponManager (via game) |
| `player/PlayerRenderer.js` | — (pure draw) |
| `player/PlayerHUD.js` | reads game state (pure draw) |
| `weapons/Weapon.js` | utils, EffectsManager + BulletPool (via game) |
| `weapons/AssaultRifle/Shotgun/SniperRifle.js` | Weapon |
| `weapons/Bullet.js` | utils/Vector2, CollisionMap (via game) |
| `weapons/BulletPool.js` | Bullet, utils/ObjectPool |
| `weapons/WeaponPickup.js` | utils/Vector2 |
| `weapons/WeaponManager.js` | the 3 guns, WeaponPickup |
| `effects/*` | utils only; orchestrated by EffectsManager |
| `ui/*` | reads game state; orchestrated by UIManager |
| `ai/BehaviorTree.js` | — (pure engine) |
| `ai/Perception.js` | CollisionMap + DifficultyScaler (via game) |
| `ai/Pathfinder.js` | world/Map |
| `ai/FlowField.js` | world/Map |
| `ai/behaviors/*` | BehaviorTree, utils |
| `ai/Enemy.js` | BehaviorTree, behaviors/*, Perception, Weapon |
| `ai/SquadCoordinator.js` | EventBus (via game) |
| `ai/DifficultyScaler.js` | utils/MathUtils |
| `ai/AIManager.js` | Enemy, Pathfinder, FlowField, SquadCoordinator, EnemyRenderer |

## The `game` context object

`core/Game.js` is the composition root. It owns one instance of each subsystem and
passes itself (`game`) into update/draw calls. Canonical fields:

```
game.canvas      core/Canvas         game.player    player/Player
game.input       core/InputManager   game.weapons   weapons/WeaponManager (player's)
game.events      core/EventBus       game.pickups   WeaponPickup[]
game.assets      core/AssetLoader    game.ai        ai/AIManager
game.camera      core/Camera         game.difficulty ai/DifficultyScaler
game.map         world/Map           game.effects   effects/EffectsManager
game.mapRenderer world/MapRenderer   game.bullets   weapons/BulletPool
game.minimap     world/Minimap       game.ui        ui/UIManager
game.debug       utils/DebugOverlay  game.time      seconds since boot
game.state       'playing' | 'paused' | 'dead'
```

## Event registry (core/EventBus)

| Event | Payload | Emitted by | Consumed by |
|---|---|---|---|
| `sound` | `{pos, radius, team}` | Weapon fire, sprint footsteps | AIManager → enemy hearing |
| `enemy:spotted` | `{enemy, pos}` | Perception (awareness hits 1), Enemy.damage | SquadCoordinator (alert propagation) |
| `enemy:killed` | `{enemy, by}` | Enemy.die | AIManager (score, weapon drop), KillFeed |
| `player:damaged` | `{amount, fromPos}` | Player.damage | PlayerHUD (damage flash) |
| `player:died` | `{by}` | Player.die | Game (state → dead), KillFeed |
| `player:respawned` | `{}` | Game.respawnPlayer | SquadCoordinator (reset awareness) |

## Frame order

Update (skipped while paused):
1. DebugOverlay (F1 toggle, fps)
2. Player: controller → combat → weapon manager
3. Pickups
4. AI: squad coordinator → per-enemy (perception → behavior tree → weapon) → separation → spawning
5. Bullets (move, trace vs walls, trace vs entities)
6. Effects (incl. screen-shake decay)
7. Camera follow + shake
8. UI timers (kill feed TTL, HUD flashes)

Render (always):
1. Background clear
2. Camera transform begins
3. World (pre-rendered map slice) → pickups → enemies → player → bullets → effects → world-space debug
4. Camera transform ends
5. Atmosphere vignette (screen space)
6. UI layers (HUD, minimap, kill feed, death/pause overlays)
7. Debug panel

## Game design constants

- Tile size **40 px**, map **64×48 tiles** (2560×1920 world).
- Tile semantics: `WALL` blocks movement + bullets + vision. `CRATE/BARRIER` (low
  cover) block movement + bullets but **not** vision — you can track a target over
  a crate but must peek around it to land a shot. `ROCK` is tall: blocks everything.
- Teams: `'player'` vs `'enemy'`. No friendly fire.
- Combat numbers live in the weapon configs and `ai/DifficultyScaler.js`; see
  `DEVELOPER_NOTES.md` for the tuning guide.

## AI architecture (summary — full write-up in DEVELOPER_NOTES.md)

Each enemy runs: **Perception** (vision cone + LOS raycast + hearing + awareness
meter for reaction time) → **Behavior Tree** (priority selector: Retreat ▸ Combat
[Suppress | Flank | Engage by squad role] ▸ Investigate ▸ Alert ▸ Suspicion ▸ Patrol).
Navigation is **A\*** on the collision grid with string-pull smoothing; squad rushes
toward an alert point share a cached **flow field**. The **SquadCoordinator**
propagates spot events and assigns suppress/flank roles. **DifficultyScaler** maps
player score → reaction time, aim error, aggression, population, spawn rate.

## How to run

ES modules require an HTTP origin:

```
cd warzoneJS
python3 -m http.server 8000
# open http://localhost:8000
```
