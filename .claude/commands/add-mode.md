Scaffold a new game mode.

Steps:
1. Create `modes/MyMode.js` with these methods:
   - `init()` — reset mode state
   - `update(dt)` — per-frame logic
   - `drawWorld(ctx)` — world-space overlays
   - `drawScreen(ctx)` — screen-space HUD
   - `canRespawn()` → boolean
   - `onKill(killer, victim)` — score/end logic
2. Register in `modes/GameModeManager.js` MODES array
3. Add to `modes/ModeDefinitions.js` if it needs a menu entry

Duration is handled automatically via `game.multiplayerConfig.duration` (minutes, null = no limit).
`game.modes.timeLeft` counts down seconds when a limit is set.
