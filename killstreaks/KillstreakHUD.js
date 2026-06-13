// killstreaks/KillstreakHUD.js — Bottom-right HUD strip above the ammo block:
// one chip per killstreak showing progress toward it (kills remaining) or its
// activation key when banked. A brief banner slides in when a streak is earned.
// Dependencies: KillstreakManager (reads streak/earned), 'killstreak:earned'.

import { STREAKS } from './KillstreakManager.js';

const MONO = '"Courier New", monospace';

export class KillstreakHUD {
  constructor(game) {
    this.game = game;
    this.banner = null;       // {text, ttl}
    game.events.on('killstreak:earned', ({ name }) => {
      this.banner = { text: `${name} READY`, ttl: 2.5 };
    });
  }

  update(dt) {
    if (this.banner && (this.banner.ttl -= dt) <= 0) this.banner = null;
  }

  draw(ctx) {
    const game = this.game;
    const ks = game.killstreaks;
    if (!game.player.alive) return;

    const x = game.canvas.width - 18;
    let y = game.canvas.height - 116;

    ctx.save();
    ctx.font = `bold 11px ${MONO}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';

    for (let i = STREAKS.length - 1; i >= 0; i--) {
      const s = STREAKS[i];
      const banked = ks.earned.has(s.id);
      const active = (s.id === 'uav' && ks.uav.active)
        || (s.id === 'airstrike' && ks.airstrike.targeting)
        || (s.id === 'sentry' && ks.sentries.length > 0);

      ctx.fillStyle = 'rgba(8, 12, 8, 0.6)';
      ctx.fillRect(x - 148, y - 15, 148, 17);

      if (banked) {
        ctx.fillStyle = '#e8c878';
        ctx.fillText(`[${s.label}] ${s.name} ★`, x - 6, y);
      } else if (active) {
        ctx.fillStyle = '#9fe09a';
        ctx.fillText(`${s.name} ACTIVE`, x - 6, y);
      } else {
        const left = Math.max(0, s.kills - ks.streak);
        ctx.fillStyle = '#6b7361';
        ctx.fillText(`${s.name} ${left} TO GO`, x - 6, y);
        // Progress sliver.
        ctx.fillStyle = '#d65c32';
        ctx.fillRect(x - 148, y + 1, 148 * Math.min(1, ks.streak / s.kills), 2);
      }
      y -= 22;
    }

    // Earn banner.
    if (this.banner) {
      ctx.textAlign = 'center';
      ctx.font = `bold 22px ${MONO}`;
      ctx.fillStyle = '#e8c878';
      ctx.globalAlpha = Math.min(1, this.banner.ttl);
      ctx.fillText(this.banner.text, game.canvas.width / 2, 120);
    }
    ctx.restore();
  }
}
