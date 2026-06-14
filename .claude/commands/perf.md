Profile and diagnose game performance.

Quick checks in browser console (localhost only):
```js
// Enemy count
window.__game.ai.enemies.length

// Bullet count  
window.__game.bullets.active.length

// Net state
window.__game.net  // null in single-player
```

Common bottlenecks:
- Too many live bullets: check `weapons/Bullet.js` SUPPRESS_RADIUS loops
- AI per-frame cost: Perception DDA raycasts × enemy count — see `ai/Perception.js`
- Canvas overdraw: effects + map renderer — check `world/MapRenderer.js`
- P2P overhead: `game.net` sends state ~20 Hz; check `net/NetManager.js` broadcast rate

Use browser DevTools Performance tab → record 3s → look for long tasks in main thread.
