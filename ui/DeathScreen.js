// ui/DeathScreen.js — Full-screen overlay while game.state === 'dead':
// red wash, "K.I.A.", killer name, stats, respawn countdown from game.deathTimer.
// Pure draw; no state. Dependencies: reads game state.

const MONO = '"Courier New", monospace';

export class DeathScreen {
  constructor(game) {
    this.game = game;
  }

  draw(ctx) {
    const game = this.game;
    const cx = game.canvas.width / 2;
    const cy = game.canvas.height / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(20, 4, 2, 0.62)';
    ctx.fillRect(0, 0, game.canvas.width, game.canvas.height);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = `bold 64px ${MONO}`;
    ctx.fillStyle = '#d65c32';
    ctx.fillText('K . I . A .', cx, cy - 60);

    ctx.font = `16px ${MONO}`;
    ctx.fillStyle = '#cfd8c2';
    ctx.fillText(
      `SCORE ${game.player.score}   KILLS ${game.player.kills}   DEATHS ${game.player.deaths}`,
      cx, cy + 4
    );

    const t = Math.max(0, game.deathTimer);
    ctx.font = `bold 22px ${MONO}`;
    ctx.fillStyle = '#e8e2cf';
    ctx.fillText(`REDEPLOYING IN ${t.toFixed(1)}`, cx, cy + 56);

    ctx.restore();
  }
}
