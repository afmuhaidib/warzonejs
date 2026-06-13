// world/CoverSystem.js — Cover spot registry + tactical queries.
// At build time, every walkable tile adjacent to a cover tile (CRATE / BARRIER /
// ROCK) becomes a "cover spot" with a direction pointing into the cover. The AI
// asks for a spot such that the cover sits between the spot and the threat
// (dot(spot->cover, spot->threat) high). Spots are claimed/released so two
// enemies never stack on the same spot.
// Dependencies: TileTypes, utils/Vector2.

import { TILE_SIZE, TILE_DEFS } from './TileTypes.js';
import { Vector2 } from '../utils/Vector2.js';

const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export class CoverSystem {
  constructor(grid, collision) {
    this.spots = [];
    grid.forEach((x, y, v) => {
      if (!TILE_DEFS[v].cover) return;
      for (const [dx, dy] of NEIGHBORS) {
        const nx = x + dx, ny = y + dy;
        if (!grid.inBounds(nx, ny) || !collision.walkable(nx, ny)) continue;
        this.spots.push({
          pos: new Vector2((nx + 0.5) * TILE_SIZE, (ny + 0.5) * TILE_SIZE),
          coverDir: new Vector2(-dx, -dy), // unit vector from the spot into the cover tile
          occupant: null,
        });
      }
    });
  }

  /**
   * Best free cover spot near `searchPos` that protects against `threatPos`.
   * @param {object} opts  { minThreatDist } — for retreats: only spots farther
   *                       from the threat than this.
   */
  findSpot(searchPos, threatPos, maxDist, requester, opts = {}) {
    let best = null;
    let bestScore = -Infinity;
    const maxDistSq = maxDist * maxDist;

    for (const spot of this.spots) {
      if (spot.occupant && spot.occupant !== requester) continue;

      const dSq = spot.pos.distanceSqTo(searchPos);
      if (dSq > maxDistSq) continue;

      const threatDist = spot.pos.distanceTo(threatPos);
      if (threatDist < 90) continue; // useless: threat is on top of the cover
      if (opts.minThreatDist && threatDist < opts.minThreatDist) continue;

      // Does the cover actually face the threat from this spot?
      const toThreat = threatPos.clone().sub(spot.pos).normalize();
      const facing = toThreat.dot(spot.coverDir);
      if (facing < 0.55) continue;

      const score = facing * 2 - Math.sqrt(dSq) / maxDist;
      if (score > bestScore) {
        bestScore = score;
        best = spot;
      }
    }

    if (best) {
      this.release(requester);
      best.occupant = requester;
    }
    return best;
  }

  release(owner) {
    for (const spot of this.spots) {
      if (spot.occupant === owner) spot.occupant = null;
    }
  }

  debugDraw(ctx) {
    ctx.save();
    for (const spot of this.spots) {
      ctx.strokeStyle = spot.occupant ? 'rgba(214, 92, 50, 0.8)' : 'rgba(120, 160, 110, 0.25)';
      ctx.strokeRect(spot.pos.x - 4, spot.pos.y - 4, 8, 8);
      ctx.beginPath();
      ctx.moveTo(spot.pos.x, spot.pos.y);
      ctx.lineTo(spot.pos.x + spot.coverDir.x * 12, spot.pos.y + spot.coverDir.y * 12);
      ctx.stroke();
    }
    ctx.restore();
  }
}
