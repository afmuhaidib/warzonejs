Open the game with the AI debug overlay active.

Press **F1** in-game to toggle the debug overlay (vision cones, paths, states, squad roles, personalities, suppression).

`window.__game` is exposed on localhost only — use browser console to inspect live game state:

```js
// Examples
window.__game.player        // player position, health, weapon
window.__game.ai.enemies    // all active enemies + blackboards
window.__game.net           // P2P network state (null in single-player)
window.__game.modes         // active game mode
```
