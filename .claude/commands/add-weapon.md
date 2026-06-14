Scaffold a new weapon for the game.

Steps:
1. Create `weapons/MyGun.js` — export a config object + class extending `Weapon`
2. Add to `LOADOUTS` in `ai/AIManager.js` with a weight
3. Add to `WeaponManager` pickup/switch logic if player-usable
4. Add a `shortName` entry in `HeadshotSystem` for headshot multiplier

Key weapon config fields:
```js
{
  name, shortName, auto, damage, fireRate, magSize, defaultReserve,
  reloadTime, spread, pellets, bulletSpeed, range, barrel,
  soundRadius, shake, flashSize, tracerLen, color
}
```

All NPCs use the AK platform — add enemy-only weapons to LOADOUTS only.
