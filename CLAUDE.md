# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview
Top-down Call-of-Duty-style browser shooter. Canvas 2D, zero external assets, zero dependencies, pure ES modules. Deployed at **https://afarena.netlify.app**.

## Commands
```bash
# Run locally (ES modules require an HTTP origin)
cd warzoneJS && python3 -m http.server 8000
# open http://localhost:8000

# Deploy to production
netlify deploy --prod
# No build step — the project root is the publish directory.
```

**In-game debug:** Press **F1** for the AI debug overlay (vision cones, paths, states, squad roles). `window.__game` is exposed on localhost only.

## Architecture

### Layer rules
- **Lower layers never import from higher layers.** Cycles go through `core/EventBus` or the `game` context object.
- `core/Game.js` is the composition root. It owns one instance of every subsystem and passes `game` into all `update(dt, game)` / `draw(ctx, game)` calls.

### Key directories
| Directory | What lives here |
|-----------|----------------|
| `core/` | Game loop, Canvas, InputManager, TouchInput, EventBus, Camera |
| `world/` | Map, MapGenerator, CollisionMap, CoverSystem, MapRenderer |
| `player/` | Player entity, PlayerController, PlayerCombat, PlayerHUD, FriendlyAgent |
| `ai/` | AIManager, Enemy, BehaviorTree, behaviors/*, Perception, Pathfinder, FlowField, SquadCoordinator, DifficultyScaler |
| `weapons/` | Weapon base, AK47, AssaultRifle, Shotgun, SniperRifle, BulletPool, WeaponManager, WeaponPickup |
| `combat/` | GrenadeSystem, FlashbangSystem, SmokeGrenade, KnifeSystem, ExplosionSystem |
| `effects/` | HitSpark, MuzzleFlash, EffectsManager |
| `audio/` | AudioEngine, SpatialAudio, GunSounds, FootstepSounds, UIAudio |
| `equipment/` | EquipmentManager, Claymore, AmmoCrate, MedKit, DeadSilence |
| `killstreaks/` | KillstreakManager, UAVSystem, AirstrikeSytem, SentryGun |
| `modes/` | GameModeManager, TeamDeathmatch, FreeForAll, Domination, CaptureTheFlag, SearchAndDestroy |
| `progression/` | XPSystem, RankSystem, ChallengeSystem |
| `replay/` | ReplayBuffer, KillCamPlayer, SpectateSystem |
| `ui/` | UIManager, MainMenu, KillFeed, DeathScreen, PauseMenu, LoadoutEditor |
| `utils/` | Vector2, MathUtils, ObjectPool, Grid, DebugOverlay |

### `game` context fields
```
game.canvas      game.input       game.touch       game.events
game.camera      game.map         game.mapRenderer game.minimap
game.player      game.weapons     game.bullets     game.pickups
game.effects     game.ai          game.combat      game.equipment
game.killstreaks game.modes       game.progression game.replay
game.difficulty  game.loadout     game.debug       game.time
game.state       // 'playing' | 'paused' | 'dead'
game.friendlies  // FriendlyAgent[]
```

### Frame order
1. Player: controller → combat → weapon manager
2. Pickups
3. AI: squad coordinator → per-enemy (perception → behavior tree) → separation → spawning
4. Bullets (move + collide)
5. Effects + camera
6. Render: world → entities → bullets → effects → UI

## AI system

### Enemy pipeline (per frame)
`Perception → Behavior Tree → turn toward desiredAngle → weapon update`

Per-enemy state lives on the **blackboard** `enemy.bb`. The behavior tree is a module-level singleton shared by all enemies; all state is in `bb`.

**Behavior tree priority:** Retreat ▸ Combat [Suppress | Flank | Engage] ▸ Investigate ▸ Alert ▸ Patrol

**Perception model** — enemies have no omniscience. Three channels only:
- Vision: 430px base range × 110° cone × DDA raycast. Awareness meter (0→1) fills at `proximity / reactionTime` per second; enemy only locks `lastKnownPos` and may shoot at 1.0.
- Hearing: gunshots/sprinting emit `'sound'` events → primes awareness to 0.35, sets `alertPos`.
- Squad radio: `'enemy:spotted'` propagates to squadmates + enemies within 320px.

**Squad tactics** (`SquadCoordinator`): best sight line → `suppress`, next → `flank` (side 1), third → `flank` (opposite side, pincer), rest → plain engage. Re-dealt every 1s.

**Aim tracking**: `bb.trackTime` accumulates while LOS holds; reduces aim error up to 35% after 2s of continuous sight.

**AI grenades**: enemies in `Engage` throw a frag after 2.5s of the player camping the same position (9s cooldown per enemy). Pushed directly into `game.combat.grenades.live`.

**Memory drift**: `lastKnownPos` drifts with random noise once sight is lost for >1.5s — enemies can't perfectly track stale positions.

**Personalities** (`ai/Personality.js`): every enemy rolls a weighted archetype at spawn (Assaulter/Rifleman/Sharpshooter/Flanker/Veteran) with per-instance jitter. Archetypes are *multipliers* on the DifficultyScaler baseline (`aimErrorMult`, `reactionMult`, `aggressionMult`) plus raw thresholds (`retreatHealth`, `leadSkill`, `suppressResist`, `bravery`, `teamwork`). So the whole roster still scales with score, but no two soldiers behave identically. `Enemy.aggression(game)` folds difficulty × personality × morale.

**Predictive aim**: `tryShoot` leads moving targets by bullet flight time (`dist / bulletSpeed`), scaled by `personality.leadSkill` and tracking duration. Stationary or out-of-sight targets aren't led.

**Suppression** (`bb.suppression`, 0..1): a player round passing within `SUPPRESS_RADIUS` (42px, `weapons/Bullet.js`) without hitting calls `enemy.onSuppressed`. Suppression widens aim (`+supp*0.16` rad), slows awareness fill in Perception, and — above 0.5 — pins the soldier in cover (no pushing/peeking in Engage). Decays at `SUPPRESS_DECAY` (0.55/s). `suppressResist` (personality) divides the intake. This is what lets the player *suppress* enemies with volume of fire.

**Tactical reload**: `Enemy.reloadInCover` reloads when the mag hits empty, or when behind cover with no LOS and the mag is <35% — instead of dry-firing or reloading mid-duel. AI reserve is Infinite.

**Morale** (`AIManager.squadMorale`): when an enemy dies, survivors within 420px (or same squad) react by `bravery` roll — brave ones set `bb.avengeUntil` (aggression spike that overrides Retreat for 4.5s), timid ones take a suppression hit. Everyone gets an `alertPos` toward the loss.

**Combat barks** (`bb.bark`/`barkTimer`): short callouts (Contact/Reloading/Frag out/Flanking/Suppressing/Man down/Falling back/Pinned/Avenge) tied to real decisions, rendered above the head by `EnemyRenderer`. Set via `Enemy.say(kind, dur)`; won't interrupt an active bark.

**Difficulty** (`DifficultyScaler`): `level = clamp(score / 2500)`. Lerps `reactionTime` 0.55→0.18s, `aimError` 0.085→0.024 rad, `aggression` 0.35→1.0, `maxEnemies` 4→8, `respawnDelay` 6→2.2s.

### Friendly AI (`FriendlyAgent`)
State machine: `follow → advance → engage`, plus `retreat` when health < 55.
- **Retreat + regen**: sprints back to player, heals 12 HP/s up to 90 HP, then re-enters combat.
- **Smart targeting**: scores enemies by effective distance minus 120px bonus for enemies actively targeting the player — intercepts threats to you first.
- Cover-hold timeout: 1.2s before force-advancing.

## Weapons
- **Enemy drops:** Always AK-47 (changed from random weapon drop)
- **Damage model:** Enemy weapons deal reduced damage (difficulty lever is aim accuracy, not raw damage)
- **Burst fire:** Enemies fire 3–6 round bursts with pauses between

## Touch / iPhone notes
- `TouchInput.js` handles all mobile input. Ghost buttons always visible. Safe-area cached at resize.
- AudioContext unlocked via `touchstart` on `window` (passive) — iOS suppresses `pointerdown` when canvas uses `preventDefault`
- Crosshair renders at screen center on touch (not at mouse position)
- Canvas uses `document.documentElement.clientWidth/Height` (excludes iOS browser chrome)

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

## Design constants
- Tile size: **40px** · Map: **64×48 tiles** (2560×1920 world)
- `WALL` blocks movement + bullets + vision. `CRATE/BARRIER` blocks movement + bullets but not vision (peeking cover). `ROCK` blocks everything.
- Teams: `'player'` vs `'enemy'` — no friendly fire
- `window.__game` only exposed on localhost (blocked in production)

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
1. Create `weapons/MyGun.js` extending `Weapon` with a def object
2. Add to `LOADOUTS` in `ai/AIManager.js` with a weight
3. Add to `WeaponManager` pickup/switch logic if player-usable

### Add a new AI behavior
1. Create `ai/behaviors/MyBehavior.js` returning `new Action((e, game, dt) => { ... return RUNNING|SUCCESS|FAILURE; })`
2. Wire into the `TREE` selector in `ai/Enemy.js`

### Add a new game mode
1. Create `modes/MyMode.js` with `init()`, `update(dt)`, `drawWorld(ctx)`, `drawScreen(ctx)`, `canRespawn()`, `onKill(killer, victim)`
2. Register in `modes/GameModeManager.js` MODES array

### Add a new killstreak
1. Create `killstreaks/MyStreak.js`
2. Register in `killstreaks/KillstreakManager.js`
