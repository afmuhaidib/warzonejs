# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview
Top-down Call-of-Duty-style browser shooter. Canvas 2D, zero external assets, zero dependencies, pure ES modules. Deployed at **https://afarena.netlify.app**.

## Commands
```bash
# Run locally — ES modules require an HTTP origin, can't open index.html directly
cd warzoneJS && python3 -m http.server 8000
# open http://localhost:8000

# Deploy to production — must run from warzoneJS/, not the parent cod/ folder
cd warzoneJS && netlify deploy --prod
# No build step. netlify.toml sets publish = "."
```

**In-game debug:** Press **F1** for the AI debug overlay (vision cones, paths, states, squad roles, personalities, suppression). `window.__game` is exposed on localhost only.

## Architecture

### Layer rules
- **Lower layers never import from higher layers.** Cycles go through `core/EventBus` or the `game` context object.
- `core/Game.js` is the composition root — the only module allowed to import upward. It owns one instance of every subsystem and passes `game` into all `update(dt, game)` / `draw(ctx, game)` calls.

### `game` context fields
```
game.canvas      game.input       game.touch       game.events
game.camera      game.map         game.mapRenderer game.minimap
game.player      game.weapons     game.bullets     game.pickups
game.effects     game.ai          game.combat      game.equipment
game.killstreaks game.modes       game.progression game.replay
game.difficulty  game.loadout     game.debug       game.time
game.viewmodel   game.audio       game.movement
game.state       // 'menu' | 'playing' | 'paused' | 'dead' | 'gameover'
game.friendlies  // FriendlyAgent[]
```

`game.movement` is a sub-object: `{ stamina, slide, prone, lean, mantle }` — each a system that reads/writes `game.player`.

`game.combat` is a sub-object: `{ explosions, grenades, flash, smoke, knife }`.

`game.progression` is a sub-object: `{ rank, xp, unlocks, challenges, attachments }`.

`game.replay` is a sub-object: `{ buffer, killcam, spectate }`.

### Game state machine
```
'menu' ──(start)──▶ 'playing' ──(Esc)──▶ 'paused' ──(Esc)──▶ 'playing'
                        │                                          ▲
                    (player dies)                           (respawn delay)
                        ▼                                          │
                     'dead' ─────────────────────────────────────-┘
                        │
                    (mode ends)
                        ▼
                   'gameover'
```
`update()` runs for all states except `'paused'`. Combat systems only tick in `'playing'`. AI and bullets tick whenever `state !== 'menu' && state !== 'gameover'` (`inMatch`).

### Frame order
1. Movement systems (stamina → slide → prone → lean → mantle)
2. Player: controller → combat → weapon manager
3. Combat systems (explosions, grenades, flash, smoke, knife)
4. Killstreaks, viewmodel, equipment
5. Pickups
6. AI: squad coordinator → per-enemy (perception → behavior tree) → separation → spawning
7. Bullets (move + collide)
8. Effects + camera
9. Render: world → entities → bullets → effects → UI → touch controls → debug

## AI system

### Enemy pipeline (per frame)
`Perception → Behavior Tree → turn toward desiredAngle → weapon update`

Per-enemy state lives on the **blackboard** `enemy.bb`. The behavior tree is a module-level singleton shared by all enemies; all state is in `bb`.

**Behavior tree priority:** Retreat ▸ Combat [Suppress | Flank | Engage] ▸ Investigate ▸ Alert ▸ Patrol

**Perception model** — enemies have no omniscience. Three channels only:
- Vision: 430px base range × 110° cone × DDA raycast. Awareness meter (0→1) fills at `proximity / reactionTime` per second; enemy only locks `lastKnownPos` and may shoot at 1.0.
- Hearing: gunshots/sprinting emit `'sound'` events → primes awareness to 0.35, sets `alertPos`.
- Squad radio: `'enemy:spotted'` propagates to squadmates + enemies within 320px.

**Squad tactics** (`SquadCoordinator`): best sight line → `suppress`, next → natural `Flanker` archetype preferred → `flank` (side 1), third → `flank` (opposite side, pincer), rest → plain engage. Re-dealt every 1s.

**Aim tracking**: `bb.trackTime` accumulates while LOS holds; reduces aim error up to 35% after 2s of continuous sight.

**AI grenades**: enemies in `Engage` throw a frag after 2.5s of the player camping the same position (9s cooldown per enemy). Pushed directly into `game.combat.grenades.live`.

**Memory drift**: `lastKnownPos` drifts with random noise once sight is lost for >1.5s — enemies can't perfectly track stale positions.

**Personalities** (`ai/Personality.js`): every enemy rolls a weighted archetype at spawn (Assaulter/Rifleman/Sharpshooter/Flanker/Veteran) with per-instance jitter. Archetypes are *multipliers* on the DifficultyScaler baseline (`aimErrorMult`, `reactionMult`, `aggressionMult`) plus raw thresholds (`retreatHealth`, `leadSkill`, `suppressResist`, `bravery`, `teamwork`). So the whole roster still scales with score, but no two soldiers behave identically. `Enemy.aggression(game)` folds difficulty × personality × morale.

**Predictive aim**: `tryShoot` leads moving targets by bullet flight time (`dist / bulletSpeed`), scaled by `personality.leadSkill` and tracking duration. Stationary or out-of-sight targets aren't led.

**Suppression** (`bb.suppression`, 0..1): a player round passing within `SUPPRESS_RADIUS` (42px, `weapons/Bullet.js`) without hitting calls `enemy.onSuppressed`. Suppression widens aim (`+supp*0.16` rad), slows awareness fill in Perception, and — above 0.5 — pins the soldier in cover (no pushing/peeking in Engage). Decays at `SUPPRESS_DECAY` (0.55/s). `suppressResist` (personality) divides the intake.

**Tactical reload**: `Enemy.reloadInCover` reloads when the mag hits empty, or when behind cover with no LOS and the mag is <35%. AI reserve is Infinite.

**Morale** (`AIManager.squadMorale`): when an enemy dies, survivors within 420px (or same squad) react by `bravery` roll — brave ones set `bb.avengeUntil` (aggression spike that overrides Retreat for 4.5s), timid ones take a suppression hit. Everyone gets an `alertPos` toward the loss.

**Combat barks** (`bb.bark`/`barkTimer`): short callouts tied to real decisions, rendered above the head by `EnemyRenderer`. Set via `Enemy.say(kind, dur)`; won't interrupt an active bark.

**Difficulty** (`DifficultyScaler`): `level = clamp(score / 2500)`. Lerps `reactionTime` 0.55→0.18s, `aimError` 0.085→0.024 rad, `aggression` 0.35→1.0, `maxEnemies` 4→8, `respawnDelay` 6→2.2s.

### Friendly AI (`FriendlyAgent`)
State machine: `follow → advance → engage`, plus `retreat` when health < 55.
- **Retreat + regen**: sprints back to player, heals 12 HP/s up to 90 HP, then re-enters combat.
- **Smart targeting**: scores enemies by effective distance minus 120px bonus for enemies actively targeting the player.

## Weapons

Every weapon is a config object passed to `new Weapon(cfg, overrides)`. Key fields:
```js
{ name, shortName, auto, damage, fireRate, magSize, defaultReserve, reloadTime,
  spread, pellets, bulletSpeed, range, barrel, soundRadius, shake, flashSize, tracerLen, color }
```
- **Enemy drops:** Always AK-47
- **Damage model:** Enemy weapons deal reduced damage (difficulty lever is aim accuracy, not raw damage)
- **Burst fire:** Enemies fire 3–6 round bursts with pauses between
- `shortName` is used by `HeadshotSystem` for per-weapon headshot multipliers and by `Bullet` for penetration logic (`'SNP'` penetrates natively)

## EventBus events
| Event | Emitted by | Consumed by |
|-------|-----------|-------------|
| `sound` | Weapon fire | AIManager → enemy hearing |
| `enemy:spotted` | Perception, Enemy.damage | SquadCoordinator |
| `enemy:killed` | Enemy.die | AIManager (score/drops), KillFeed |
| `player:damaged` | Player.damage | PlayerHUD |
| `player:died` | Player.die | Game state machine, KillFeed |
| `player:respawned` | Game.respawnPlayer | SquadCoordinator reset |
| `weapon:fired` | Weapon.tryFire | AudioEngine, ViewmodelSystem |
| `weapon:reload` | Weapon.startReload | AudioEngine, ReloadSounds |
| `friendly:died` | FriendlyAgent.die | KillFeed |
| `hit` | Bullet.update | XPSystem, HitMarker UI |

## Design constants
- Tile size: **40px** · Map: **64×48 tiles** (2560×1920 world)
- `WALL` blocks movement + bullets + vision. `CRATE/BARRIER` blocks movement + bullets but not vision (peeking cover). `ROCK` blocks everything.
- Teams: `'player'` vs `'enemy'` — no friendly fire. FFA mode uses per-enemy team IDs (`ffa_N`).
- `window.__game` only exposed on localhost (blocked in production)

## Touch / mobile notes
- `TouchInput.js` handles all mobile input. Ghost buttons always visible. Safe-area cached at resize.
- AudioContext unlocked via `touchstart` on `window` (passive) — iOS suppresses `pointerdown` when canvas uses `preventDefault`
- Crosshair renders at screen center on touch (not at mouse position)
- Canvas uses `document.documentElement.clientWidth/Height` (excludes iOS browser chrome)

## Key tuning locations

| What to tune | Where |
|---|---|
| Aim tracking strength / duration | `bb.trackTime` divisor + multiplier in `Enemy.tryShoot` |
| AI grenade frequency / range | `CAMP_THRESHOLD`, `GRENADE_COOLDOWN` in `ai/behaviors/Engage.js` |
| Memory drift speed | drift constants in `ai/Perception.js` (end of the `else` block) |
| Friendly retreat threshold / regen | `RETREAT_HEALTH`, `REGEN_RATE`, `REGEN_TARGET` in `player/FriendlyAgent.js` |
| Enemy aim error, aggression, population | `ai/DifficultyScaler.js` lerp endpoints |
| Personality archetypes & trait spread | `ARCHETYPES` + jitter in `ai/Personality.js` |
| Suppression radius / intake / decay | `SUPPRESS_RADIUS` (`weapons/Bullet.js`), `SUPPRESS_DECAY` (`ai/Enemy.js`) |
| Predictive aim strength | lead factor in `Enemy.tryShoot` + `leadSkill` in Personality |
| Morale radius / avenge window | `squadMorale` in `ai/AIManager.js` |
| Combat bark lines | `BARKS` in `ai/Enemy.js` |
| Perception (vision range, FOV, hearing) | constants atop `ai/Perception.js` |
| Retreat threshold & window | `RETREAT_HEALTH`, `RETREAT_WINDOW` in `ai/behaviors/Retreat.js` |
| Flank radius / angle / open-fire range | constants atop `ai/behaviors/Flank.js` |
| Squad callout radius, role re-deal rate | `ai/SquadCoordinator.js` |
| Weapon stats | config blocks in `weapons/*.js` |
| Enemy loadout weights, drop chance | `LOADOUTS`, `DROP_CHANCE` in `ai/AIManager.js` |
| Map size, layout | `world/MapGenerator.js` |
| Tile semantics (bullets vs vision blocking) | `world/TileTypes.js` |

## Common tasks

### Add a new weapon
1. Create `weapons/MyGun.js` — export a config object and a class extending `Weapon`
2. Add to `LOADOUTS` in `ai/AIManager.js` with a weight
3. Add to `WeaponManager` pickup/switch logic if player-usable
4. Add a `shortName` entry to `HeadshotSystem` if the headshot multiplier should differ

### Add a new AI behavior
1. Create `ai/behaviors/MyBehavior.js` returning `new Action((e, game, dt) => { ... return RUNNING|SUCCESS|FAILURE; })`
2. Wire into the `TREE` selector in `ai/Enemy.js`

### Add a new game mode
1. Create `modes/MyMode.js` with `init()`, `update(dt)`, `drawWorld(ctx)`, `drawScreen(ctx)`, `canRespawn()`, `onKill(killer, victim)`
2. Register in `modes/GameModeManager.js` MODES array

### Add a new killstreak
1. Create `killstreaks/MyStreak.js`
2. Register in `killstreaks/KillstreakManager.js`

### Add a new player movement system
1. Create `player/MySystem.js` with an `update(dt)` method that reads/writes `game.player`
2. Instantiate in `Game.js` under `this.movement` and call in the `'playing'` update block
