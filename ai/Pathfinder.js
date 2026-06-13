// ai/Pathfinder.js — A* on the collision grid (8-directional, no corner
// cutting) with string-pull smoothing: redundant waypoints are dropped when a
// straight ray between neighbors crosses no movement-solid tile. Returns world
// -space Vector2 waypoints (tile centers).
// Dependencies: world/Map (collision grid).

const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142],
];

export class Pathfinder {
  constructor(map) {
    this.map = map;
    this.col = map.collision;
    const n = map.width * map.height;
    // Flat scratch arrays reused across queries (no per-query allocation).
    this.gScore = new Float32Array(n);
    this.cameFrom = new Int32Array(n);
    this.closed = new Uint8Array(n);
    this.inOpen = new Uint8Array(n);
  }

  /** World-space start/goal Vector2 -> array of world Vector2 waypoints, or []. */
  findPath(start, goal) {
    const col = this.col;
    const w = this.map.width;
    let s = col.nearestWalkable(col.worldToTile(start.x), col.worldToTile(start.y));
    let g = col.nearestWalkable(col.worldToTile(goal.x), col.worldToTile(goal.y));
    if (!s || !g) return [];

    const startI = s.ty * w + s.tx;
    const goalI = g.ty * w + g.tx;
    if (startI === goalI) return [col.tileCenter(g.tx, g.ty)];

    this.gScore.fill(Infinity);
    this.closed.fill(0);
    this.inOpen.fill(0);
    this.cameFrom.fill(-1);
    this.cameFrom[startI] = -1;
    this.gScore[startI] = 0;

    // Open list as array of {i, f}; linear extract-min is fine at 64×48 tiles.
    const open = [{ i: startI, f: this.h(s.tx, s.ty, g.tx, g.ty) }];
    this.inOpen[startI] = 1;

    let guard = 0;
    while (open.length && guard++ < 6000) {
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (open[k].f < open[bi].f) bi = k;
      const { i: cur } = open.splice(bi, 1)[0];
      if (cur === goalI) return this.reconstruct(cur, g);
      this.closed[cur] = 1;

      const cx = cur % w, cy = (cur / w) | 0;
      for (const [dx, dy, cost] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (!col.walkable(nx, ny)) continue;
        // No corner cutting: a diagonal needs both orthogonal neighbors open.
        if (dx !== 0 && dy !== 0 && (!col.walkable(cx + dx, cy) || !col.walkable(cx, cy + dy))) continue;
        const ni = ny * w + nx;
        if (this.closed[ni]) continue;
        const tentative = this.gScore[cur] + cost;
        if (tentative < this.gScore[ni]) {
          this.gScore[ni] = tentative;
          this.cameFrom[ni] = cur;
          const f = tentative + this.h(nx, ny, g.tx, g.ty);
          if (!this.inOpen[ni]) {
            open.push({ i: ni, f });
            this.inOpen[ni] = 1;
          } else {
            for (const o of open) if (o.i === ni) { o.f = f; break; }
          }
        }
      }
    }
    return [];
  }

  /** Octile distance heuristic. */
  h(x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    return Math.max(dx, dy) + 0.4142 * Math.min(dx, dy);
  }

  reconstruct(i, g) {
    const w = this.map.width;
    const tiles = [];
    while (i !== -1) {
      tiles.push({ tx: i % w, ty: (i / w) | 0 });
      i = this.cameFrom[i];
    }
    tiles.reverse();
    return this.smooth(tiles).map((t) => this.col.tileCenter(t.tx, t.ty));
  }

  /** String-pulling: keep a waypoint only when the straight shot past it is blocked. */
  smooth(tiles) {
    if (tiles.length <= 2) return tiles;
    const out = [tiles[0]];
    let anchor = 0;
    for (let i = 2; i < tiles.length; i++) {
      if (!this.clearLine(tiles[anchor], tiles[i])) {
        out.push(tiles[i - 1]);
        anchor = i - 1;
      }
    }
    out.push(tiles[tiles.length - 1]);
    return out;
  }

  clearLine(a, b) {
    const p = this.col.tileCenter(a.tx, a.ty);
    const q = this.col.tileCenter(b.tx, b.ty);
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy);
    const solid = (tx, ty) => this.col.solidAt(tx, ty);
    // Center ray.
    if (this.col.raycast(p.x, p.y, q.x, q.y, solid)) return false;
    // Two side rays offset by AGENT_R so the smoothed path is passable by the entity body.
    if (len > 1) {
      const AGENT_R = 16; // slightly larger than enemy radius (14) for safety margin
      const px = (-dy / len) * AGENT_R, py = (dx / len) * AGENT_R;
      if (this.col.raycast(p.x + px, p.y + py, q.x + px, q.y + py, solid)) return false;
      if (this.col.raycast(p.x - px, p.y - py, q.x - px, q.y - py, solid)) return false;
    }
    return true;
  }
}
