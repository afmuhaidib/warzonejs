// ai/FlowField.js — BFS flow field for group movement. When a squad alert goes
// out, the coordinator computes ONE field toward the alert tile and every
// converging enemy just samples its local direction — N enemies share one
// search instead of N A* queries. Recomputed only when the target tile moves.
// Dependencies: world/Map (collision grid), utils/Vector2.

import { Vector2 } from '../utils/Vector2.js';

export class FlowField {
  constructor(map) {
    this.map = map;
    this.col = map.collision;
    this.dist = new Int16Array(map.width * map.height);
    this.targetTx = -1;
    this.targetTy = -1;
    this.valid = false;
  }

  /** Build (or reuse) the field pointing toward world position `target`. */
  compute(target) {
    const tx = this.col.worldToTile(target.x);
    const ty = this.col.worldToTile(target.y);
    if (this.valid && tx === this.targetTx && ty === this.targetTy) return;

    const t = this.col.nearestWalkable(tx, ty);
    if (!t) { this.valid = false; return; }
    this.targetTx = tx;
    this.targetTy = ty;

    const w = this.map.width;
    this.dist.fill(-1);
    const queue = [t.ty * w + t.tx];
    this.dist[queue[0]] = 0;

    for (let head = 0; head < queue.length; head++) {
      const cur = queue[head];
      const cx = cur % w, cy = (cur / w) | 0;
      const d = this.dist[cur];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.col.walkable(nx, ny)) continue;
        const ni = ny * w + nx;
        if (this.dist[ni] !== -1) continue;
        this.dist[ni] = d + 1;
        queue.push(ni);
      }
    }
    this.valid = true;
  }

  /** Unit direction of steepest descent at a world position, or null. */
  dirAt(x, y) {
    if (!this.valid) return null;
    const w = this.map.width;
    const tx = this.col.worldToTile(x);
    const ty = this.col.worldToTile(y);
    const here = this.dist[ty * w + tx];
    if (here === undefined || here < 0) return null;
    if (here === 0) return new Vector2(0, 0);

    let best = here;
    let bx = 0, by = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = tx + dx, ny = ty + dy;
      if (!this.col.grid.inBounds(nx, ny)) continue;
      const d = this.dist[ny * w + nx];
      if (d >= 0 && d < best) { best = d; bx = dx; by = dy; }
    }
    if (bx === 0 && by === 0) return null;
    // Aim at the chosen neighbor tile's center so motion isn't axis-snapped.
    const c = this.col.tileCenter(tx + bx, ty + by);
    return new Vector2(c.x - x, c.y - y).normalize();
  }
}
