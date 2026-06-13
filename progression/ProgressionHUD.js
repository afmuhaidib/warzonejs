// progression/ProgressionHUD.js — Rank badge + animated XP bar (the fill lerps
// toward the real value, never jumps) bottom-center, plus a popup queue for XP
// gains, unlocks, challenge completions, and rank-ups. Popups stack and float
// up as they fade.
// Dependencies: RankSystem, 'xp'/'unlock'/'rank:up' events.

import { MAX_RANK } from './RankSystem.js';

const MONO = '"Courier New", monospace';

export class ProgressionHUD {
  constructor(game) {
    this.game = game;
    this.shownProgress = game.progression.rank.progress;
    this.popups = [];   // {text, color, ttl, big}

    game.events.on('xp', ({ amount, reason }) => {
      this.push(`+${amount} XP  ${reason}`, '#e8c878');
    });
    game.events.on('unlock', ({ item }) => {
      this.push(`UNLOCKED: ${item.name}`, '#9fe09a', true);
    });
    game.events.on('rank:up', ({ rank, prestige }) => {
      this.push(prestige ? `PRESTIGE ${prestige}` : `RANK UP — LEVEL ${rank}`, '#d65c32', true);
    });
  }

  push(text, color, big = false) {
    this.popups.unshift({ text, color, ttl: big ? 3 : 1.8, max: big ? 3 : 1.8, big });
    if (this.popups.length > 5) this.popups.pop();
  }

  update(dt) {
    // Smooth XP bar fill. Rank-up wraps: snap low, then fill.
    const real = this.game.progression.rank.progress;
    if (real < this.shownProgress - 0.5) this.shownProgress = 0;
    this.shownProgress += (real - this.shownProgress) * Math.min(1, 4 * dt);

    for (const p of this.popups) p.ttl -= dt;
    this.popups = this.popups.filter((p) => p.ttl > 0);
  }

  draw(ctx) {
    const game = this.game;
    const rank = game.progression.rank;
    const cx = game.canvas.width / 2;
    const y = game.canvas.height - 26;

    ctx.save();

    // XP bar.
    const w = 220;
    ctx.fillStyle = 'rgba(8, 12, 8, 0.7)';
    ctx.fillRect(cx - w / 2 - 4, y - 4, w + 8, 14);
    ctx.fillStyle = 'rgba(30, 36, 28, 1)';
    ctx.fillRect(cx - w / 2, y, w, 6);
    ctx.fillStyle = '#e8c878';
    ctx.fillRect(cx - w / 2, y, w * this.shownProgress, 6);

    // Rank badge.
    ctx.font = `bold 13px ${MONO}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = rank.prestige > 0 ? '#d65c32' : '#cfd8c2';
    const star = '★'.repeat(Math.min(rank.prestige, 5));
    ctx.fillText(`${star} LVL ${rank.rank}${rank.rank >= MAX_RANK ? ' MAX' : ''}`, cx - w / 2 - 12, y + 3);

    // Popups float up-right of the crosshair zone.
    let py = game.canvas.height / 2 + 70;
    ctx.textAlign = 'center';
    for (const p of this.popups) {
      const a = Math.min(1, p.ttl / 0.5);
      const rise = (1 - p.ttl / p.max) * 18;
      ctx.globalAlpha = a;
      ctx.font = `bold ${p.big ? 18 : 13}px ${MONO}`;
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, cx, py - rise);
      py += p.big ? 26 : 18;
    }

    ctx.restore();
  }
}
