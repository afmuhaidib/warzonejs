// world/Map.js — Master map controller.
// Runs the generator and exposes the tile grid, collision queries, cover system,
// spawn points and patrol points to the rest of the game.
// (Named GameMap to avoid clashing with the built-in Map.)
// Dependencies: MapGenerator, CollisionMap, CoverSystem, TileTypes, utils/MathUtils.

import { generateMap } from './MapGenerator.js';
import { CollisionMap } from './CollisionMap.js';
import { CoverSystem } from './CoverSystem.js';
import { TILE_SIZE } from './TileTypes.js';
import { choice } from '../utils/MathUtils.js';

export class GameMap {
  constructor(seed) {
    this.seed = seed;
    const gen = generateMap(seed);

    this.grid = gen.grid;
    this.tileSize = TILE_SIZE;
    this.width = this.grid.width;
    this.height = this.grid.height;
    this.worldWidth = this.width * TILE_SIZE;
    this.worldHeight = this.height * TILE_SIZE;

    this.collision = new CollisionMap(this.grid);
    this.cover = new CoverSystem(this.grid, this.collision);

    this.playerSpawn = gen.playerSpawn;
    this.enemySpawns = gen.enemySpawns;

    // Filter patrol points: enemies must not patrol within the player safe zone
    // (200px around the player spawn) — prevents spawn camping.
    const SPAWN_SAFE_RADIUS = 200;
    this.patrolPoints = gen.patrolPoints.filter(
      (p) => p.distanceTo(gen.playerSpawn) > SPAWN_SAFE_RADIUS
    );
    if (this.patrolPoints.length === 0) this.patrolPoints = gen.patrolPoints; // fallback

    // Expose spawn safe radius for AI checks.
    this.playerSpawnSafeRadius = SPAWN_SAFE_RADIUS;
  }

  randomPatrolPoint() {
    return choice(this.patrolPoints).clone();
  }

  /** Returns true if pos is inside the player spawn protection zone. */
  inSpawnSafeZone(pos) {
    return pos.distanceTo(this.playerSpawn) < this.playerSpawnSafeRadius;
  }

  tileAt(worldX, worldY) {
    const tx = Math.floor(worldX / TILE_SIZE);
    const ty = Math.floor(worldY / TILE_SIZE);
    return this.grid.inBounds(tx, ty) ? this.grid.get(tx, ty) : null;
  }
}
