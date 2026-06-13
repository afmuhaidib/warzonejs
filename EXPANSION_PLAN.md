# WarZone JS — Expansion Plan (Phase 2)

Extends the existing architecture (see ARCHITECTURE.md). Nothing below replaces an
existing system; new modules hang off the same `game` context and EventBus.

## New top-level systems on the game context

```
game.viewmodel    animations/ViewmodelRig      game.modes        modes/GameModeManager
game.audio        audio/AudioEngine            game.killstreaks  killstreaks/KillstreakManager
game.movement     player/* movement systems    game.progression  progression/* facade
game.combat       combat/* facade              game.equipment    equipment/EquipmentManager
game.replay       replay/* facade              game.loadout      persisted loadout selection
```

## Dependency map (new modules)

| Module | Depends on |
|---|---|
| animations/AnimationEngine | utils/MathUtils (leaf engine: easing + keyframe tracks) |
| animations/ViewmodelRig | AnimationEngine, all animation modules, Gun/HandRenderer |
| animations/GunRenderer, HandRenderer | — (pure draw) |
| animations/{WalkBob,Sprint,Fire,AimDownSights} | AnimationEngine (continuous controllers) |
| animations/{Reload,WeaponSwap,Melee}Animation | AnimationEngine (timeline anims, cancellable) |
| audio/AudioEngine | Web Audio API (lazy ctx, master chain, synth helpers) |
| audio/SpatialAudio | AudioEngine (pan/gain by world offset from player) |
| audio/{Gun,Footstep,Reload,Explosion,UI}Sounds | AudioEngine, SpatialAudio, EventBus |
| player/StaminaSystem | InputManager (gates sprint) |
| player/SlideSystem | StaminaSystem, CollisionMap |
| player/{Prone,Lean}System | InputManager |
| player/MantleSystem | CollisionMap, TileTypes (low-cover detection) |
| combat/ExplosionSystem | CollisionMap (LOS falloff), EffectsManager, EventBus |
| combat/{Grenade,Flashbang,Smoke}System | ExplosionSystem, CollisionMap (bounces) |
| combat/KnifeSystem | EventBus ('melee' → MeleeAnimation) |
| combat/HeadshotSystem | consulted by weapons/Bullet |
| combat/PenetrationSystem | TileTypes (thin-wall rules), consulted by Bullet |
| killstreaks/KillstreakManager | EventBus, the three streak systems |
| killstreaks/{UAV,AirstrikeCaller,SentryGun} | Minimap gating / ExplosionSystem / BulletPool |
| modes/GameModeManager | the four modes, EventBus, ObjectiveHUD |
| modes/* | map points, EventBus, AI alert hooks |
| progression/XPSystem | EventBus (kills, assists, objectives, challenges) |
| progression/{Rank,Unlock,Challenge}System | XPSystem, localStorage |
| progression/AttachmentSystem | weapons/attachments/AttachmentManager |
| weapons/attachments/* | attachment defs consumed by AttachmentManager |
| equipment/* | CollisionMap, ExplosionSystem, EventBus |
| replay/ReplayBuffer | snapshots of player + enemies at 20 Hz |
| replay/{KillCamPlayer,SpectateSystem} | ReplayBuffer, Camera, MapRenderer |
| ui/* | reads game state; orchestrated by UIManager |

## Existing-file edits (surgical, no rewrites)

- `core/Game.js` — construct new systems; states gain 'menu' / 'gameover'; killcam phase inside 'dead'; world/UI draw hooks for modes, equipment, killstreaks, viewmodel.
- `core/Camera.js` — `zoom` support (ADS); view math accounts for it.
- `weapons/Weapon.js` — tactical vs full reload durations, 'weapon:fired'/'weapon:reload' events, spread/silenced/penetration hooks for ADS + attachments.
- `weapons/Bullet.js` — headshot roll, thin-wall penetration, 'hit' event.
- `weapons/WeaponManager.js` — swap timer (blocks fire), loadout-driven start weapon, ammo-crate refill API, 'pickup' event.
- `player/PlayerController.js` — stamina gate, slide/prone/mantle speed overrides, lean offset, footstep events on all gaits (Dead Silence gated).
- `player/PlayerCombat.js` — fire blocked while swapping/mantling/meleeing; reload passes game.
- `player/Player.js` — prone/slide/lean/stamina fields, accuracy counters.
- `player/PlayerHUD.js` — stamina bar.
- `ai/Perception.js` — smoke occlusion, flashbang blindness, prone visibility modifier.
- `ai/Enemy.js` — damage-contributor tracking (assists), bb.blindTimer.
- `world/Minimap.js` — enemy blips gated by awareness/UAV; mode markers hook.
- `ui/UIManager.js` — orchestrates all new layers + menu/gameover screens.

## New event registry entries

| Event | Payload | Emitted by | Consumed by |
|---|---|---|---|
| `weapon:fired` | {weapon, pos, angle, team, silenced} | Weapon | GunSounds, FireAnimation, player accuracy |
| `weapon:reload` | {weapon, full} | Weapon.startReload | ReloadSounds, ReloadAnimation |
| `hit` | {target, amount, headshot, killed, pos, byTeam} | Bullet | HitMarker, DamageNumbers, XP, challenges |
| `explosion` | {pos, radius} | ExplosionSystem | ExplosionSounds |
| `melee` | {} | KnifeSystem | MeleeAnimation |
| `pickup` | {weapon} | WeaponManager | UIAudio |
| `xp` | {amount, reason} | XPSystem | ProgressionHUD, UIAudio |
| `rank:up` / `unlock` | {rank} / {item} | RankSystem/UnlockTree | ProgressionHUD |
| `killstreak:earned` | {id} | KillstreakManager | KillstreakHUD, UIAudio |
| `mode:objective` | {type, xp} | modes | XPSystem, ObjectiveHUD |
| `match:end` | {won, summary} | GameModeManager | Game (state), EndGameScreen |

## Key bindings added

Z prone · Q/E lean · RMB aim-down-sights · G frag (hold = cook) · T tactical
(flash/smoke per loadout) · F knife · H medkit (hold) · 4/5/6 killstreaks ·
7 claymore · 8 ammo crate · N dead silence · Tab scoreboard (hold)

## Build order

AnimationEngine → renderers → reload/swap feel → audio stack → movement →
combat → killstreaks + modes → progression + attachments + equipment →
killcam/spectate → UI polish → integration pass in Game.js → playthrough check.
