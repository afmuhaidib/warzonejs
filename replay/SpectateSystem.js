// replay/SpectateSystem.js — After the killcam ends (or when there was no
// usable footage), the camera spectates the LIVE killer until the respawn
// timer expires — smooth follow, "SPECTATING <name>" tag, respawn countdown.
// If the killer has since died, falls back to any living enemy, else the
// death position. Active whenever state === 'dead' and the killcam isn't.
// Dependencies: Camera (via game), reads AI state.

export class SpectateSystem {
  constructor(game) {
    this.game = game;
    this.killer = null;
    game.events.on('player:died', ({ killerRef }) => { this.killer = killerRef || null; });
    game.events.on('player:respawned', () => { this.killer = null; });
  }

  get target() {
    const game = this.game;
    if (this.killer && this.killer.health > 0 && game.ai.enemies.includes(this.killer)) {
      return this.killer;
    }
    return game.ai.enemies[0] || null;
  }

  update(dt) {
    if (this.game.state !== 'dead') return;
    const t = this.target;
    if (t) this.game.camera.follow(t.pos, dt);
  }

  drawOverlay(ctx) {
    const game = this.game;
    const t = this.target;
    ctx.save();
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#aab39a';
    ctx.fillText(t ? `SPECTATING — ${t.name}` : 'SPECTATING', game.canvas.width / 2, 56);
    ctx.restore();
  }
}
