// utils/DebugOverlay.js — Toggle-able debug view (F1).
// Draws the screen-space stats panel; world-space debug (vision cones, paths,
// cover links) is drawn by ai/EnemyRenderer + world/CoverSystem when
// `game.debug.enabled` is true.
// Dependencies: reads game state only.

export class DebugOverlay {
  constructor() {
    this.enabled = false;
    this.fps = 0;
    this._frames = 0;
    this._accum = 0;
  }

  update(dt, game) {
    if (game.input.wasPressed('F1')) this.enabled = !this.enabled;
    this._frames++;
    this._accum += dt;
    if (this._accum >= 0.5) {
      this.fps = this._frames / this._accum;
      this._frames = 0;
      this._accum = 0;
    }
  }

  draw(ctx, game) {
    if (!this.enabled) return;

    const lines = [];
    lines.push(`FPS ${this.fps.toFixed(0)}`);
    lines.push(`STATE ${game.state}`);
    lines.push(`ENEMIES ${game.ai.enemies.length}  BULLETS ${game.bullets.active.length}`);
    lines.push(`EFFECTS ${game.effects.list.length}  PICKUPS ${game.pickups.length}`);

    const p = game.difficulty.params;
    lines.push(`THREAT ${(game.difficulty.level * 100).toFixed(0)}%`);
    lines.push(`  react ${p.reactionTime.toFixed(2)}s  aimErr ${p.aimError.toFixed(3)}`);
    lines.push(`  aggro ${p.aggression.toFixed(2)}  pop ${p.maxEnemies}  spawn ${p.respawnDelay.toFixed(1)}s`);

    const states = {};
    for (const e of game.ai.enemies) states[e.state] = (states[e.state] || 0) + 1;
    lines.push('AI: ' + Object.entries(states).map(([k, v]) => `${k}:${v}`).join(' '));

    const x = 14;
    let y = game.canvas.height - 14 - lines.length * 15;
    ctx.save();
    ctx.fillStyle = 'rgba(8, 12, 8, 0.78)';
    ctx.fillRect(x - 8, y - 16, 330, lines.length * 15 + 14);
    ctx.strokeStyle = 'rgba(214, 92, 50, 0.6)';
    ctx.strokeRect(x - 8, y - 16, 330, lines.length * 15 + 14);
    ctx.font = '12px "Courier New", monospace';
    ctx.fillStyle = '#9fe09a';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (const line of lines) {
      ctx.fillText(line, x, y - 10);
      y += 15;
    }
    ctx.restore();
  }
}
