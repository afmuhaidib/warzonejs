// combat/PenetrationSystem.js — Thin-wall penetration rules, consulted by
// weapons/Bullet when it hits a bullet-blocking tile. Thin = low cover
// (CRATE/BARRIER: solid but doesn't block vision); WALL and ROCK are always
// hard stops. Capability: snipers penetrate natively, anything else needs FMJ
// rounds. Each punch-through costs damage and a bullet can only do it once.
// Dependencies: world/TileTypes (tile defs).

import { TILE_DEFS } from '../world/TileTypes.js';

const DAMAGE_KEPT = 0.55;   // damage multiplier after punching through

export const PenetrationSystem = {
  /** Can this bullet (from this weapon) pass through the tile it just hit? */
  canPenetrate(bullet, tileId) {
    if (bullet.penetrated) return false;             // one wall per bullet
    if (!bullet.penetrate) return false;             // weapon lacks FMJ / sniper
    const def = TILE_DEFS[tileId];
    if (!def) return false;
    return def.solid && !def.blocksVision;           // thin cover only
  },

  /** Apply the punch-through cost. */
  applyFalloff(bullet) {
    bullet.penetrated = true;
    bullet.damage *= DAMAGE_KEPT;
  },
};
