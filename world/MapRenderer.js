// world/MapRenderer.js — Draws terrain, cover objects, zones, and atmosphere.
// The whole world is pre-rendered once into an offscreen canvas (via AssetLoader)
// and blitted by camera slice each frame; the screen-space vignette/grade is the
// only per-frame map cost. Dark military palette, all shapes drawn in code.
// Dependencies: TileTypes, core/AssetLoader (instance), utils/MathUtils.

import { TILE, TILE_SIZE, TILE_DEFS } from './TileTypes.js';
import { mulberry32 } from '../utils/MathUtils.js';

export class MapRenderer {
  constructor(map, assets) {
    this.map = map;
    this.world = assets.make('world', map.worldWidth, map.worldHeight, (ctx) =>
      this.prerender(ctx)
    );
    this._vignette = null; // rebuilt lazily when the screen size changes
    this._vignetteKey = '';
  }

  // ------------------------------------------------------------- prerender

  prerender(ctx) {
    const { map } = this;
    const rng = mulberry32(map.seed ^ 0x5f3759df);
    const ts = TILE_SIZE;

    // Base ground.
    ctx.fillStyle = TILE_DEFS[TILE.FLOOR].base;
    ctx.fillRect(0, 0, map.worldWidth, map.worldHeight);

    // Per-tile ground variation + scattered detail.
    map.grid.forEach((x, y, v) => {
      const def = TILE_DEFS[v];
      if (def.solid) return;
      const px = x * ts, py = y * ts;
      const n = rng();
      if (v === TILE.ROAD) {
        ctx.fillStyle = def.base;
        ctx.fillRect(px, py, ts, ts);
        ctx.fillStyle = `rgba(0, 0, 0, ${0.04 + n * 0.06})`;
        ctx.fillRect(px, py, ts, ts);
      } else {
        ctx.fillStyle = n > 0.5
          ? `rgba(46, 58, 42, ${(n - 0.5) * 0.35})`
          : `rgba(8, 10, 8, ${(0.5 - n) * 0.4})`;
        ctx.fillRect(px, py, ts, ts);
        if (rng() < 0.06) { // grass tufts / debris
          ctx.fillStyle = 'rgba(72, 92, 58, 0.5)';
          ctx.fillRect(px + rng() * (ts - 4), py + rng() * (ts - 4), 3, 2);
        }
      }
    });

    // Road markings on lane centers.
    ctx.strokeStyle = 'rgba(180, 160, 90, 0.18)';
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 18]);
    const cx = Math.floor(map.width / 2) * ts + ts / 2;
    const cy = Math.floor(map.height / 2) * ts + ts / 2;
    ctx.beginPath();
    ctx.moveTo(cx, 0); ctx.lineTo(cx, map.worldHeight);
    ctx.moveTo(0, cy); ctx.lineTo(map.worldWidth, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Drop shadows under solids (drawn before the solids themselves).
    map.grid.forEach((x, y, v) => {
      if (!TILE_DEFS[v].solid) return;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(x * ts + 5, y * ts + 5, ts, ts);
    });

    // Solid tiles.
    map.grid.forEach((x, y, v) => {
      const px = x * ts, py = y * ts;
      switch (v) {
        case TILE.WALL: this.drawWall(ctx, px, py, rng); break;
        case TILE.CRATE: this.drawCrate(ctx, px, py, rng); break;
        case TILE.BARRIER: this.drawBarrier(ctx, px, py, rng); break;
        case TILE.ROCK: this.drawRock(ctx, px, py, rng); break;
      }
    });

    // Spawn zone markings.
    ctx.strokeStyle = 'rgba(110, 170, 110, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    const ps = map.playerSpawn;
    ctx.strokeRect(ps.x - 60, ps.y - 50, 120, 100);
    ctx.setLineDash([]);
  }

  drawWall(ctx, px, py, rng) {
    const ts = TILE_SIZE;
    ctx.fillStyle = TILE_DEFS[TILE.WALL].base;
    ctx.fillRect(px, py, ts, ts);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)'; // top edge light
    ctx.fillRect(px, py, ts, 4);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';        // bottom edge shade
    ctx.fillRect(px, py + ts - 4, ts, 4);
    if (rng() < 0.3) { // weathering streak
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.fillRect(px + 4 + rng() * (ts - 12), py + 6, 3, ts - 12);
    }
  }

  drawCrate(ctx, px, py, rng) {
    const ts = TILE_SIZE;
    const pad = 3;
    ctx.fillStyle = TILE_DEFS[TILE.CRATE].base;
    ctx.fillRect(px + pad, py + pad, ts - pad * 2, ts - pad * 2);
    ctx.strokeStyle = '#2c2113';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + pad, py + pad, ts - pad * 2, ts - pad * 2);
    // Plank cross.
    ctx.beginPath();
    ctx.moveTo(px + pad, py + pad); ctx.lineTo(px + ts - pad, py + ts - pad);
    ctx.moveTo(px + ts - pad, py + pad); ctx.lineTo(px + pad, py + ts - pad);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 220, 150, 0.08)';
    ctx.fillRect(px + pad, py + pad, ts - pad * 2, 5);
    if (rng() < 0.5) { // stencil mark
      ctx.fillStyle = 'rgba(20, 14, 6, 0.5)';
      ctx.fillRect(px + 12, py + 16, 16, 3);
    }
  }

  drawBarrier(ctx, px, py, rng) {
    const ts = TILE_SIZE;
    ctx.fillStyle = '#262b1e';
    ctx.fillRect(px + 2, py + 6, ts - 4, ts - 10);
    // Sandbag rows.
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 2; i++) {
        ctx.fillStyle = (row + i) % 2 ? '#3a4030' : '#434a36';
        ctx.beginPath();
        ctx.ellipse(px + 11 + i * 18 + (row % 2) * 4, py + 12 + row * 9, 10, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (rng() < 0.2) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(px + 6, py + 8, ts - 12, 4);
    }
  }

  drawRock(ctx, px, py, rng) {
    const ts = TILE_SIZE;
    const cx = px + ts / 2, cy = py + ts / 2;
    ctx.fillStyle = TILE_DEFS[TILE.ROCK].base;
    ctx.beginPath();
    const points = 7;
    for (let i = 0; i < points; i++) {
      const a = (i / points) * Math.PI * 2;
      const r = ts * 0.34 + rng() * ts * 0.14;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.ellipse(cx - 4, cy - 5, ts * 0.16, ts * 0.1, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---------------------------------------------------------------- runtime

  /** Blit the visible world slice (called inside the camera transform). */
  draw(ctx, camera, canvas) {
    const sx = Math.max(0, camera.viewLeft - 64);
    const sy = Math.max(0, camera.viewTop - 64);
    const sw = Math.min(this.map.worldWidth - sx, camera.viewWidth + 128);
    const sh = Math.min(this.map.worldHeight - sy, camera.viewHeight + 128);
    if (sw <= 0 || sh <= 0) return;
    ctx.drawImage(this.world, sx, sy, sw, sh, sx, sy, sw, sh);
  }

  /** Screen-space vignette + cold color grade (called after the camera pass). */
  drawAtmosphere(ctx, canvas) {
    const key = `${canvas.width}x${canvas.height}`;
    if (this._vignetteKey !== key) {
      const g = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.35,
        canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.72
      );
      g.addColorStop(0, 'rgba(4, 8, 5, 0)');
      g.addColorStop(1, 'rgba(2, 5, 3, 0.55)');
      this._vignette = g;
      this._vignetteKey = key;
    }
    ctx.fillStyle = this._vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}
