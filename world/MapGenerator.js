// world/MapGenerator.js — Procedural tactical layout generation (seeded).
// Produces: tile grid, player spawn, enemy spawn zones, patrol points.
// Layout philosophy: a road cross divides the map into quadrants; buildings sit
// off the lanes as strongholds; crate clusters / sandbag lines / rocks provide
// cover and choke points along the lanes. Connectivity is verified by flood fill
// and corridors are carved if a spawn zone is cut off.
// Dependencies: TileTypes, utils/Grid, utils/MathUtils, utils/Vector2.

import { TILE, TILE_SIZE, TILE_DEFS } from './TileTypes.js';
import { Grid } from '../utils/Grid.js';
import { Vector2 } from '../utils/Vector2.js';
import { mulberry32 } from '../utils/MathUtils.js';

const MAP_W = 64;
const MAP_H = 48;

export function generateMap(seed) {
  const rng = mulberry32(seed);
  const grid = new Grid(MAP_W, MAP_H, TILE.FLOOR);

  carveRoads(grid);
  buildBorder(grid);
  const zones = defineZones();
  placeBuildings(grid, rng, zones);
  placeBarrierLines(grid, rng, zones);
  placeCrateClusters(grid, rng, zones);
  placeRocks(grid, rng, zones);
  clearZones(grid, zones);
  ensureConnectivity(grid, zones);

  const reachable = floodFill(grid, zones.player.x, zones.player.y);
  const patrolPoints = pickPatrolPoints(grid, rng, reachable);

  return {
    grid,
    playerSpawn: tileCenter(zones.player.x, zones.player.y),
    enemySpawns: zones.enemies.map((z) => tileCenter(z.x, z.y)),
    patrolPoints,
  };
}

// ---------------------------------------------------------------- layout steps

function buildBorder(grid) {
  for (let x = 0; x < grid.width; x++) {
    for (const y of [0, 1, grid.height - 2, grid.height - 1]) grid.set(x, y, TILE.WALL);
  }
  for (let y = 0; y < grid.height; y++) {
    for (const x of [0, 1, grid.width - 2, grid.width - 1]) grid.set(x, y, TILE.WALL);
  }
}

function carveRoads(grid) {
  const cx = Math.floor(grid.width / 2);
  const cy = Math.floor(grid.height / 2);
  for (let y = 0; y < grid.height; y++) {
    for (let dx = -1; dx <= 1; dx++) grid.set(cx + dx, y, TILE.ROAD);
  }
  for (let x = 0; x < grid.width; x++) {
    for (let dy = -1; dy <= 1; dy++) grid.set(x, cy + dy, TILE.ROAD);
  }
}

function defineZones() {
  return {
    player: { x: Math.floor(MAP_W / 2), y: MAP_H - 5 },
    enemies: [
      { x: 6, y: 6 },
      { x: MAP_W - 7, y: 6 },
      { x: 6, y: Math.floor(MAP_H / 2) - 6 },
      { x: MAP_W - 7, y: Math.floor(MAP_H / 2) - 6 },
    ],
  };
}

function nearZone(zones, x, y, margin) {
  const pts = [zones.player, ...zones.enemies];
  return pts.some((z) => Math.abs(z.x - x) <= margin && Math.abs(z.y - y) <= margin);
}

function onRoad(grid, x0, y0, w, h) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (grid.inBounds(x, y) && grid.get(x, y) === TILE.ROAD) return true;
    }
  }
  return false;
}

function placeBuildings(grid, rng, zones) {
  const placed = [];
  let attempts = 0;
  while (placed.length < 6 && attempts++ < 120) {
    const w = 6 + Math.floor(rng() * 5);
    const h = 5 + Math.floor(rng() * 5);
    const x = 4 + Math.floor(rng() * (grid.width - w - 8));
    const y = 4 + Math.floor(rng() * (grid.height - h - 10));

    if (onRoad(grid, x - 1, y - 1, w + 2, h + 2)) continue;
    if (nearZone(zones, x + w / 2, y + h / 2, Math.max(w, h))) continue;
    if (placed.some((b) =>
      x < b.x + b.w + 2 && x + w + 2 > b.x && y < b.y + b.h + 2 && y + h + 2 > b.y)) continue;

    // Perimeter walls, hollow interior.
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) {
        const edge = tx === x || tx === x + w - 1 || ty === y || ty === y + h - 1;
        grid.set(tx, ty, edge ? TILE.WALL : TILE.FLOOR);
      }
    }
    // Two doorways (2 tiles wide) on different sides.
    const sides = [0, 1, 2, 3].sort(() => rng() - 0.5).slice(0, 2);
    for (const side of sides) {
      if (side === 0) { const dx = x + 1 + Math.floor(rng() * (w - 3)); grid.set(dx, y, TILE.FLOOR); grid.set(dx + 1, y, TILE.FLOOR); }
      if (side === 1) { const dx = x + 1 + Math.floor(rng() * (w - 3)); grid.set(dx, y + h - 1, TILE.FLOOR); grid.set(dx + 1, y + h - 1, TILE.FLOOR); }
      if (side === 2) { const dy = y + 1 + Math.floor(rng() * (h - 3)); grid.set(x, dy, TILE.FLOOR); grid.set(x, dy + 1, TILE.FLOOR); }
      if (side === 3) { const dy = y + 1 + Math.floor(rng() * (h - 3)); grid.set(x + w - 1, dy, TILE.FLOOR); grid.set(x + w - 1, dy + 1, TILE.FLOOR); }
    }
    // A couple of crates inside for interior cover.
    if (w > 6 && h > 6) {
      grid.set(x + 2, y + 2, TILE.CRATE);
      grid.set(x + w - 3, y + h - 3, TILE.CRATE);
    }
    placed.push({ x, y, w, h });
  }
}

function placeBarrierLines(grid, rng, zones) {
  let placed = 0;
  let attempts = 0;
  while (placed < 7 && attempts++ < 90) {
    const horizontal = rng() < 0.5;
    const len = 3 + Math.floor(rng() * 3);
    const x = 4 + Math.floor(rng() * (grid.width - len - 8));
    const y = 4 + Math.floor(rng() * (grid.height - len - 8));
    if (nearZone(zones, x, y, 5)) continue;

    let ok = true;
    for (let i = 0; i < len; i++) {
      const tx = horizontal ? x + i : x;
      const ty = horizontal ? y : y + i;
      if (grid.get(tx, ty) !== TILE.FLOOR && grid.get(tx, ty) !== TILE.ROAD) { ok = false; break; }
    }
    if (!ok) continue;
    for (let i = 0; i < len; i++) {
      const tx = horizontal ? x + i : x;
      const ty = horizontal ? y : y + i;
      grid.set(tx, ty, TILE.BARRIER);
    }
    placed++;
  }
}

function placeCrateClusters(grid, rng, zones) {
  let placed = 0;
  let attempts = 0;
  while (placed < 13 && attempts++ < 160) {
    const cx = 4 + Math.floor(rng() * (grid.width - 8));
    const cy = 4 + Math.floor(rng() * (grid.height - 8));
    if (nearZone(zones, cx, cy, 4)) continue;
    if (grid.get(cx, cy) !== TILE.FLOOR) continue;

    const count = 2 + Math.floor(rng() * 4);
    let set = 0;
    for (let i = 0; i < count * 3 && set < count; i++) {
      const tx = cx + Math.floor(rng() * 3) - 1;
      const ty = cy + Math.floor(rng() * 3) - 1;
      if (grid.inBounds(tx, ty) && grid.get(tx, ty) === TILE.FLOOR) {
        grid.set(tx, ty, TILE.CRATE);
        set++;
      }
    }
    if (set > 0) placed++;
  }
}

function placeRocks(grid, rng, zones) {
  let placed = 0;
  let attempts = 0;
  while (placed < 9 && attempts++ < 90) {
    const x = 4 + Math.floor(rng() * (grid.width - 8));
    const y = 4 + Math.floor(rng() * (grid.height - 8));
    if (nearZone(zones, x, y, 4)) continue;
    if (grid.get(x, y) !== TILE.FLOOR) continue;
    grid.set(x, y, TILE.ROCK);
    if (rng() < 0.4 && grid.get(x + 1, y) === TILE.FLOOR) grid.set(x + 1, y, TILE.ROCK);
    placed++;
  }
}

function clearZones(grid, zones) {
  const clearAround = (zx, zy, r) => {
    for (let y = zy - r; y <= zy + r; y++) {
      for (let x = zx - r; x <= zx + r; x++) {
        if (grid.inBounds(x, y) && x > 1 && y > 1 && x < grid.width - 2 && y < grid.height - 2) {
          if (TILE_DEFS[grid.get(x, y)].solid) grid.set(x, y, TILE.FLOOR);
        }
      }
    }
  };
  clearAround(zones.player.x, zones.player.y, 3);
  for (const z of zones.enemies) clearAround(z.x, z.y, 2);
}

// --------------------------------------------------------------- connectivity

function floodFill(grid, sx, sy) {
  const reached = new Uint8Array(grid.width * grid.height);
  const queue = [[sx, sy]];
  reached[grid.index(sx, sy)] = 1;
  while (queue.length) {
    const [x, y] = queue.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!grid.inBounds(nx, ny)) continue;
      const i = grid.index(nx, ny);
      if (reached[i] || TILE_DEFS[grid.get(nx, ny)].solid) continue;
      reached[i] = 1;
      queue.push([nx, ny]);
    }
  }
  return reached;
}

function ensureConnectivity(grid, zones) {
  for (let pass = 0; pass < 2; pass++) {
    const reached = floodFill(grid, zones.player.x, zones.player.y);
    let carved = false;
    for (const z of zones.enemies) {
      if (reached[grid.index(z.x, z.y)]) continue;
      // Carve an L-shaped 2-wide corridor toward the map center.
      carveCorridor(grid, z.x, z.y, Math.floor(grid.width / 2), Math.floor(grid.height / 2));
      carved = true;
    }
    if (!carved) return;
  }
}

function carveCorridor(grid, x0, y0, x1, y1) {
  const carve = (x, y) => {
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        const tx = x + dx, ty = y + dy;
        if (tx > 1 && ty > 1 && tx < grid.width - 2 && ty < grid.height - 2) {
          grid.set(tx, ty, TILE.FLOOR);
        }
      }
    }
  };
  let x = x0;
  while (x !== x1) { carve(x, y0); x += Math.sign(x1 - x); }
  let y = y0;
  while (y !== y1) { carve(x1, y); y += Math.sign(y1 - y); }
}

// -------------------------------------------------------------------- helpers

function pickPatrolPoints(grid, rng, reachable) {
  const candidates = [];
  for (let y = 3; y < grid.height - 3; y++) {
    for (let x = 3; x < grid.width - 3; x++) {
      if (reachable[grid.index(x, y)]) candidates.push({ x, y });
    }
  }
  const points = [];
  const minTileDist = 6;
  let attempts = 0;
  while (points.length < 28 && attempts++ < 600 && candidates.length) {
    const c = candidates[Math.floor(rng() * candidates.length)];
    if (points.every((p) => Math.abs(p.tx - c.x) + Math.abs(p.ty - c.y) >= minTileDist)) {
      const v = tileCenter(c.x, c.y);
      v.tx = c.x;
      v.ty = c.y;
      points.push(v);
    }
  }
  return points;
}

function tileCenter(tx, ty) {
  return new Vector2((tx + 0.5) * TILE_SIZE, (ty + 0.5) * TILE_SIZE);
}
