// world/CollisionMap.js — Collision grid queries for movement, bullets, and vision.
// Provides: circle-vs-tile movement resolution (axis-separated, slides along
// walls), a DDA grid raycast used for line-of-sight and bullet traces, and
// walkability queries for pathfinding.
// Dependencies: TileTypes, utils/Vector2.

import { TILE_SIZE, TILE_DEFS } from './TileTypes.js';
import { Vector2 } from '../utils/Vector2.js';

const EPS = 0.01;

export class CollisionMap {
  constructor(grid) {
    this.grid = grid;
    this.tileSize = TILE_SIZE;
    this.worldWidth = grid.width * TILE_SIZE;
    this.worldHeight = grid.height * TILE_SIZE;
  }

  // ------------------------------------------------------------ tile queries

  def(tx, ty) {
    if (!this.grid.inBounds(tx, ty)) return null;
    return TILE_DEFS[this.grid.get(tx, ty)];
  }

  /** Movement-solid (out of bounds counts as solid). */
  solidAt(tx, ty) {
    const d = this.def(tx, ty);
    return d ? d.solid : true;
  }

  bulletBlockAt(tx, ty) {
    const d = this.def(tx, ty);
    return d ? d.blocksBullets : true;
  }

  visionBlockAt(tx, ty) {
    const d = this.def(tx, ty);
    return d ? d.blocksVision : true;
  }

  walkable(tx, ty) { return !this.solidAt(tx, ty); }

  worldToTile(v) { return Math.floor(v / TILE_SIZE); }

  tileCenter(tx, ty) {
    return new Vector2((tx + 0.5) * TILE_SIZE, (ty + 0.5) * TILE_SIZE);
  }

  /** Spiral search for the closest walkable tile; returns {tx, ty} or null. */
  nearestWalkable(tx, ty, maxRadius = 6) {
    if (this.walkable(tx, ty)) return { tx, ty };
    for (let r = 1; r <= maxRadius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (this.walkable(tx + dx, ty + dy)) return { tx: tx + dx, ty: ty + dy };
        }
      }
    }
    return null;
  }

  // -------------------------------------------------------- circle collision

  /** True if a circle at (x, y) overlaps any movement-solid tile. */
  circleHits(x, y, r) {
    const minTx = Math.floor((x - r) / TILE_SIZE);
    const maxTx = Math.floor((x + r) / TILE_SIZE);
    const minTy = Math.floor((y - r) / TILE_SIZE);
    const maxTy = Math.floor((y + r) / TILE_SIZE);
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (!this.solidAt(tx, ty)) continue;
        // Closest point on the tile AABB to the circle center.
        const cx = Math.max(tx * TILE_SIZE, Math.min(x, (tx + 1) * TILE_SIZE));
        const cy = Math.max(ty * TILE_SIZE, Math.min(y, (ty + 1) * TILE_SIZE));
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy < r * r) return true;
      }
    }
    return false;
  }

  /**
   * Move a circle by (dx, dy), resolving each axis independently so entities
   * slide along walls. Mutates pos.
   */
  moveCircle(pos, dx, dy, r) {
    if (dx !== 0) {
      const nx = pos.x + dx;
      if (this.circleHits(nx, pos.y, r)) {
        // Clamp flush against the tile boundary in the direction of travel.
        const edge = dx > 0
          ? Math.floor((nx + r) / TILE_SIZE) * TILE_SIZE - r - EPS
          : Math.ceil((nx - r) / TILE_SIZE) * TILE_SIZE + r + EPS;
        pos.x = this.circleHits(edge, pos.y, r) ? pos.x : edge;
      } else {
        pos.x = nx;
      }
    }
    if (dy !== 0) {
      const ny = pos.y + dy;
      if (this.circleHits(pos.x, ny, r)) {
        const edge = dy > 0
          ? Math.floor((ny + r) / TILE_SIZE) * TILE_SIZE - r - EPS
          : Math.ceil((ny - r) / TILE_SIZE) * TILE_SIZE + r + EPS;
        pos.y = this.circleHits(pos.x, edge, r) ? pos.y : edge;
      } else {
        pos.y = ny;
      }
    }
  }

  // ----------------------------------------------------------------- raycast

  /**
   * DDA grid traversal from (x0, y0) to (x1, y1). `blocks(tx, ty)` decides what
   * stops the ray. Returns {x, y, tx, ty, t} at the first hit, or null.
   */
  raycast(x0, y0, x1, y1, blocks) {
    const ts = TILE_SIZE;
    let tx = Math.floor(x0 / ts);
    let ty = Math.floor(y0 / ts);
    if (blocks(tx, ty)) return { x: x0, y: y0, tx, ty, t: 0 };

    const dx = x1 - x0;
    const dy = y1 - y0;
    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? Math.abs(ts / dx) : Infinity;
    const tDeltaY = dy !== 0 ? Math.abs(ts / dy) : Infinity;
    let tMaxX = dx !== 0
      ? (stepX > 0 ? (tx + 1) * ts - x0 : x0 - tx * ts) / Math.abs(dx)
      : Infinity;
    let tMaxY = dy !== 0
      ? (stepY > 0 ? (ty + 1) * ts - y0 : y0 - ty * ts) / Math.abs(dy)
      : Infinity;

    let t = 0;
    let guard = 0;
    while (t <= 1 && guard++ < 512) {
      if (tMaxX < tMaxY) {
        tx += stepX;
        t = tMaxX;
        tMaxX += tDeltaX;
      } else {
        ty += stepY;
        t = tMaxY;
        tMaxY += tDeltaY;
      }
      if (t > 1) break;
      if (blocks(tx, ty)) {
        return { x: x0 + dx * t, y: y0 + dy * t, tx, ty, t };
      }
    }
    return null;
  }

  /** AI sight check: true if nothing vision-blocking sits between a and b. */
  lineOfSight(a, b) {
    return !this.raycast(a.x, a.y, b.x, b.y, (tx, ty) => this.visionBlockAt(tx, ty));
  }

  /** Bullet trace: first bullet-blocking tile hit between two points, or null. */
  bulletTrace(x0, y0, x1, y1) {
    return this.raycast(x0, y0, x1, y1, (tx, ty) => this.bulletBlockAt(tx, ty));
  }

  inWorld(x, y) {
    return x >= 0 && y >= 0 && x < this.worldWidth && y < this.worldHeight;
  }
}
