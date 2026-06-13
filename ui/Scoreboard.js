// ui/Scoreboard.js — Hold Tab for the live scoreboard: your row (kills,
// deaths, K/D, accuracy, score, streak) plus the current enemy roster with
// squad/state columns. Pure overlay; accuracy comes from the shot/hit
// counters Weapon and Bullet maintain on the player.
// Dependencies: reads game state only.

const MONO = '"Courier New", monospace';

export class Scoreboard {
  constructor(game) {
    this.game = game;
  }

  get visible() {
    return this.game.input.isDown('Tab');
  }

  draw(ctx) {
    if (!this.visible) return;
    const game = this.game;
    const W = game.canvas.width;
    const cx = W / 2;
    const p = game.player;
    const boxW = Math.min(620, W - 40);
    const rows = Math.min(10, game.ai.enemies.length) + 6;
    const boxH = 90 + rows * 18;
    const y0 = 80;

    ctx.save();
    ctx.fillStyle = 'rgba(5, 8, 5, 0.88)';
    ctx.fillRect(cx - boxW / 2, y0, boxW, boxH);
    ctx.strokeStyle = 'rgba(214, 92, 50, 0.6)';
    ctx.strokeRect(cx - boxW / 2, y0, boxW, boxH);

    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.font = `bold 18px ${MONO}`;
    ctx.fillStyle = '#e8e2cf';
    ctx.fillText('SCOREBOARD', cx, y0 + 14);

    const acc = p.shotsFired > 0 ? Math.round((p.shotsHit / p.shotsFired) * 100) : 0;
    const kd = p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : p.kills.toFixed(2);

    // Your row.
    let y = y0 + 48;
    ctx.font = `bold 12px ${MONO}`;
    ctx.fillStyle = '#9fe09a';
    ctx.textAlign = 'left';
    ctx.fillText('YOU', cx - boxW / 2 + 20, y);
    ctx.textAlign = 'right';
    ctx.fillText(
      `K ${p.kills}   D ${p.deaths}   K/D ${kd}   ACC ${acc}%   STREAK ${game.killstreaks.streak}   SCORE ${p.score}`,
      cx + boxW / 2 - 20, y);

    y += 26;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#d65c32';
    ctx.fillText(`HOSTILES IN PLAY — ${game.ai.enemies.length}`, cx - boxW / 2 + 20, y);
    y += 20;

    ctx.font = `11px ${MONO}`;
    for (const e of game.ai.enemies.slice(0, 10)) {
      ctx.fillStyle = '#aab39a';
      ctx.fillText(e.name, cx - boxW / 2 + 20, y);
      ctx.fillStyle = '#6b7361';
      ctx.fillText(`sq${e.squad}`, cx - boxW / 2 + 150, y);
      ctx.fillText(e.state.toUpperCase(), cx - boxW / 2 + 210, y);
      ctx.fillStyle = e.health > 50 ? '#7ab648' : '#d6a13c';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.ceil(e.health)} HP`, cx + boxW / 2 - 20, y);
      ctx.textAlign = 'left';
      y += 18;
    }
    ctx.restore();
  }
}
