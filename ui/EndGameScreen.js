// ui/EndGameScreen.js — Match-over overlay (game.state === 'gameover'):
// VICTORY/DEFEAT headline, MVP-style stat highlight, full match stats, the
// per-reason XP breakdown from XPSystem's match log, prestige button at max
// rank, and a return-to-menu button. Populated by the 'match:end' event.
// Dependencies: 'match:end' payload, XPSystem.matchLog, MainMenu.button.

import { MainMenu } from './MainMenu.js';

const MONO = '"Courier New", monospace';

export class EndGameScreen {
  constructor(game) {
    this.game = game;
    this.data = null;
    this.buttons = [];
    game.events.on('match:end', (payload) => { this.data = payload; });
  }

  draw(ctx) {
    if (!this.data) return;
    const game = this.game;
    const W = game.canvas.width, H = game.canvas.height;
    const cx = W / 2;
    const d = this.data;
    this.buttons = [];

    ctx.fillStyle = 'rgba(5, 8, 5, 0.9)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 54px ${MONO}`;
    ctx.fillStyle = d.won ? '#9fe09a' : '#d65c32';
    ctx.fillText(d.won ? 'VICTORY' : 'DEFEAT', cx, H * 0.14);
    ctx.font = `bold 15px ${MONO}`;
    ctx.fillStyle = '#e8e2cf';
    ctx.fillText(d.headline, cx, H * 0.14 + 42);

    // MVP highlight: best stat of the match.
    const s = d.summary;
    const acc = game.player.shotsFired > 0
      ? Math.round((game.player.shotsHit / game.player.shotsFired) * 100) : 0;
    const mvp = s.kills >= 15 ? 'SLAYER' : acc >= 40 ? 'MARKSMAN' : s.deaths <= 2 ? 'SURVIVOR' : 'OPERATOR';
    ctx.font = `bold 13px ${MONO}`;
    ctx.fillStyle = '#e8c878';
    ctx.fillText(`— MATCH MVP RATING: ${mvp} —`, cx, H * 0.14 + 68);

    // Stats block.
    let y = H * 0.32;
    ctx.font = `13px ${MONO}`;
    ctx.fillStyle = '#cfd8c2';
    const mins = Math.floor(s.time / 60), secs = Math.floor(s.time % 60);
    const lines = [
      `MODE ${s.mode.toUpperCase()}   TIME ${mins}:${String(secs).padStart(2, '0')}`,
      `KILLS ${s.kills}   DEATHS ${s.deaths}   ACCURACY ${acc}%   SCORE ${s.score}`,
    ];
    if (s.roundsWon !== undefined) lines.push(`ROUNDS ${s.roundsWon}–${s.roundsLost}`);
    if (s.teamA !== undefined) lines.push(`GREEN ${s.teamA} — RED ${s.teamB}`);
    if (s.us !== undefined) lines.push(`POINTS US ${s.us} — THEM ${s.them}`);
    for (const line of lines) { ctx.fillText(line, cx, y); y += 22; }

    // XP breakdown.
    y += 14;
    ctx.font = `bold 13px ${MONO}`;
    ctx.fillStyle = '#e8c878';
    ctx.fillText(`XP EARNED — ${game.progression.xp.matchTotal}`, cx, y);
    y += 20;
    ctx.font = `11px ${MONO}`;
    for (const entry of game.progression.xp.matchLog.slice(0, 8)) {
      ctx.fillStyle = '#8d957f';
      ctx.fillText(`${entry.reason} ×${entry.count}`, cx - 80, y);
      ctx.fillStyle = '#e8c878';
      ctx.fillText(`+${entry.amount}`, cx + 110, y);
      y += 16;
    }

    // Buttons.
    const rank = game.progression.rank;
    if (rank.canPrestige) {
      if (MainMenu.button(ctx, game, this.buttons, 'prestige', cx - 230, H - 80, 220, 44, '★ ENTER PRESTIGE', true)) {
        rank.doPrestige();
      }
      if (MainMenu.button(ctx, game, this.buttons, 'menu', cx + 10, H - 80, 220, 44, 'MAIN MENU')) {
        game.state = 'menu';
      }
    } else if (MainMenu.button(ctx, game, this.buttons, 'menu', cx - 110, H - 80, 220, 44, 'MAIN MENU', true)) {
      game.state = 'menu';
    }
  }
}
