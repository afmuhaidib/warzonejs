// world/Minimap.js — Corner minimap with live positions.
// Terrain is pre-rendered once at minimap scale; per-frame work is just blips
// (player, enemies, pickups) and the camera viewport rectangle.
// Dependencies: TileTypes.

import { TILE, TILE_DEFS } from './TileTypes.js';

const MINI_W = 200;
const MARGIN = 14;

export class Minimap {
  constructor(map) {
    this.map = map;
    this.scale = MINI_W / map.worldWidth;
    this.w = MINI_W;
    this.h = Math.round(map.worldHeight * this.scale);

    this.terrain = document.createElement('canvas');
    this.terrain.width = this.w;
    this.terrain.height = this.h;
    const ctx = this.terrain.getContext('2d');
    ctx.fillStyle = 'rgba(14, 20, 14, 1)';
    ctx.fillRect(0, 0, this.w, this.h);
    const px = map.tileSize * this.scale;
    map.grid.forEach((x, y, v) => {
      if (v === TILE.WALL) ctx.fillStyle = 'rgba(150, 160, 145, 0.85)';
      else if (TILE_DEFS[v].cover) ctx.fillStyle = 'rgba(95, 100, 80, 0.6)';
      else if (v === TILE.ROAD) ctx.fillStyle = 'rgba(40, 46, 50, 1)';
      else return;
      ctx.fillRect(x * px, y * px, Math.ceil(px), Math.ceil(px));
    });
  }

  draw(ctx, game) {
    const x0 = game.canvas.width - this.w - MARGIN;
    const y0 = MARGIN;
    const s = this.scale;

    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.drawImage(this.terrain, x0, y0);
    ctx.globalAlpha = 1;

    // Camera viewport rectangle.
    ctx.strokeStyle = 'rgba(220, 220, 200, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      x0 + game.camera.viewLeft * s,
      y0 + game.camera.viewTop * s,
      game.camera.viewWidth * s,
      game.camera.viewHeight * s
    );

    // Pickups.
    ctx.fillStyle = '#d6a13c';
    for (const pickup of game.pickups) {
      ctx.fillRect(x0 + pickup.pos.x * s - 1.5, y0 + pickup.pos.y * s - 1.5, 3, 3);
    }

    // Enemies (live positions).
    const uav = game.killstreaks.uav.active;
    for (const enemy of game.ai.enemies) {
      const alerted = enemy.bb.awareness >= 1 || enemy.bb.alertPos || enemy.bb.investigatePos;
      const near = enemy.pos.distanceTo(game.player.pos) < 220;
      if (!uav && !alerted && !near) continue;

      ctx.fillStyle = enemy.bb.awareness >= 1 ? '#e04f33' : '#8a4a3a';
      ctx.beginPath();
      ctx.arc(x0 + enemy.pos.x * s, y0 + enemy.pos.y * s, 2.2, 0, Math.PI * 2);
      ctx.fill();

      if (uav || alerted) {
        ctx.strokeStyle = ctx.fillStyle;
        ctx.beginPath();
        ctx.moveTo(x0 + enemy.pos.x * s, y0 + enemy.pos.y * s);
        ctx.lineTo(
          x0 + enemy.pos.x * s + Math.cos(enemy.angle) * 4,
          y0 + enemy.pos.y * s + Math.sin(enemy.angle) * 4
        );
        ctx.stroke();
      }
    }

    // CTF flags.
    const ctf = game.modes?.mode;
    if (ctf?.flagA && ctf?.flagB) {
      for (const flag of [ctf.flagA, ctf.flagB]) {
        ctx.fillStyle = flag.color;
        ctx.globalAlpha = flag.status === 'dropped' ? 0.5 : 1;
        ctx.beginPath();
        ctx.arc(x0 + flag.pos.x * s, y0 + flag.pos.y * s, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.font = 'bold 7px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = flag.color;
        ctx.fillText(flag.id, x0 + flag.pos.x * s, y0 + flag.pos.y * s - 4);
      }
    }

    // Player.
    if (game.player.alive) {
      ctx.fillStyle = '#9fe09a';
      ctx.beginPath();
      ctx.arc(x0 + game.player.pos.x * s, y0 + game.player.pos.y * s, 2.8, 0, Math.PI * 2);
      ctx.fill();
      // Facing tick.
      ctx.strokeStyle = '#9fe09a';
      ctx.beginPath();
      ctx.moveTo(x0 + game.player.pos.x * s, y0 + game.player.pos.y * s);
      ctx.lineTo(
        x0 + game.player.pos.x * s + Math.cos(game.player.angle) * 6,
        y0 + game.player.pos.y * s + Math.sin(game.player.angle) * 6
      );
      ctx.stroke();
    }

    // Frame.
    ctx.strokeStyle = 'rgba(214, 92, 50, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0 - 1, y0 - 1, this.w + 2, this.h + 2);

    game.killstreaks.uav.drawSweep(ctx, x0, y0, this.w, this.h);
    ctx.restore();
  }
}
