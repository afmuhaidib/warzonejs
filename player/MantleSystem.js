// player/MantleSystem.js — Auto-vault over low cover (CRATE/BARRIER — never
// WALL/ROCK, they're tall). Detection: sprinting into a low-cover tile whose
// far side is walkable starts a mantle; the player lerps over the obstacle
// with an ease-in-out curve, collision ignored for the duration, firing
// blocked. Cancels nothing — it's quick (0.45s) and committal.
// Dependencies: CollisionMap, TileTypes, utils (Vector2, MathUtils).

import { Vector2 } from '../utils/Vector2.js';
import { TILE_DEFS, TILE_SIZE } from '../world/TileTypes.js';
import { Easing } from '../animations/AnimationEngine.js';

const DURATION = 0.45;

export class MantleSystem {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.t = 0;
    this.from = new Vector2();
    this.to = new Vector2();
  }

  update(dt) {
    const { player, map } = this.game;

    if (this.active) {
      this.t += dt / DURATION;
      if (this.t >= 1) {
        this.t = 1;
        this.active = false;
        player.mantling = false;
      }
      const u = Easing.inOutQuad(Math.min(1, this.t));
      player.pos.set(
        this.from.x + (this.to.x - this.from.x) * u,
        this.from.y + (this.to.y - this.from.y) * u
      );
      player.vel.set(0, 0);
      return;
    }

    if (!player.alive || !player.sprinting || player.prone || player.sliding) return;

    // Probe one tile ahead of the sprint direction.
    const dir = player.vel.clone().normalize();
    if (dir.lengthSq() < 0.5) return;
    const px = player.pos.x + dir.x * (player.radius + 6);
    const py = player.pos.y + dir.y * (player.radius + 6);
    const col = map.collision;
    const tx = col.worldToTile(px);
    const ty = col.worldToTile(py);
    const def = col.def(tx, ty);
    if (!def || !def.solid || def.blocksVision) return; // only low cover mantles

    // Landing spot: the tile past the cover, must be walkable.
    const lx = tx + Math.round(dir.x);
    const ly = ty + Math.round(dir.y);
    if (!col.walkable(lx, ly)) return;

    this.active = true;
    this.t = 0;
    this.from.copy(player.pos);
    this.to.set((lx + 0.5) * TILE_SIZE, (ly + 0.5) * TILE_SIZE);
    player.mantling = true;
    this.game.events.emit('sound', { pos: player.pos.clone(), radius: 130, team: 'player' });
  }
}
