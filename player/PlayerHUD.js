// player/PlayerHUD.js — Health, ammo, score, threat meter, crosshair, weapon
// slots, pickup prompt, and the damage vignette flash. Pure screen-space draw;
// per-frame timers (flash decay, crosshair recoil bloom) are the only state.
// Orchestrated by ui/UIManager. Dependencies: reads game state; utils/MathUtils.

import { clamp, lerp } from '../utils/MathUtils.js';

const MONO = '"Courier New", monospace';

export class PlayerHUD {
  constructor(game) {
    this.game = game;
    this.recoilBloom = 0;
    game.events.on('sound', (s) => {
      // Crosshair kick on the player's own shots.
      if (s.team === 'player' && s.radius > 200) this.recoilBloom = Math.min(this.recoilBloom + 3, 12);
    });
  }

  update(dt) {
    this.recoilBloom = Math.max(0, this.recoilBloom - dt * 24);
  }

  draw(ctx) {
    const game = this.game;
    if (!game.player.alive) return;
    this.drawDamageFlash(ctx);
    this.drawHealth(ctx);
    this.drawAmmo(ctx);
    this.drawScore(ctx);
    this.drawPickupPrompt(ctx);
    this.drawCrosshair(ctx);
  }

  drawDamageFlash(ctx) {
    const game = this.game;
    const since = game.time - game.player.lastDamageTime;
    const lowHealth = game.player.health / game.player.maxHealth < 0.3;
    let alpha = 0;
    if (since < 0.5) alpha = (1 - since / 0.5) * 0.4;
    if (lowHealth) alpha = Math.max(alpha, 0.18 + Math.sin(game.time * 5) * 0.07);
    if (alpha <= 0) return;
    const g = ctx.createRadialGradient(
      game.canvas.width / 2, game.canvas.height / 2, Math.min(game.canvas.width, game.canvas.height) * 0.3,
      game.canvas.width / 2, game.canvas.height / 2, Math.max(game.canvas.width, game.canvas.height) * 0.7
    );
    g.addColorStop(0, 'rgba(140, 20, 10, 0)');
    g.addColorStop(1, `rgba(140, 20, 10, ${alpha})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, game.canvas.width, game.canvas.height);
  }

  drawHealth(ctx) {
    const game = this.game;
    const x = 18, w = 230, h = 16;
    const y = game.canvas.height - 38;
    const pct = clamp(game.player.health / game.player.maxHealth, 0, 1);

    ctx.fillStyle = 'rgba(8, 12, 8, 0.7)';
    ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
    ctx.fillStyle = 'rgba(30, 36, 28, 1)';
    ctx.fillRect(x, y, w, h);
    const r = Math.round(lerp(200, 90, pct));
    const gCol = Math.round(lerp(50, 190, pct));
    ctx.fillStyle = `rgb(${r}, ${gCol}, 50)`;
    ctx.fillRect(x, y, w * pct, h);
    // Segment ticks.
    ctx.fillStyle = 'rgba(8, 12, 8, 0.6)';
    for (let i = 1; i < 10; i++) ctx.fillRect(x + (w / 10) * i, y, 1, h);
    ctx.strokeStyle = 'rgba(214, 92, 50, 0.5)';
    ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);

    ctx.font = `bold 12px ${MONO}`;
    ctx.fillStyle = '#cfd8c2';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`HP ${Math.max(0, Math.ceil(game.player.health))}`, x, y - 8);
  }

  drawAmmo(ctx) {
    const game = this.game;
    const weapon = game.weapons.current;
    if (!weapon) return;
    const x = game.canvas.width - 18;
    const y = game.canvas.height - 26;

    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.font = `bold 34px ${MONO}`;
    ctx.fillStyle = weapon.ammo === 0 ? '#d65c32' : '#e8e2cf';
    const reserve = weapon.reserve === Infinity ? '∞' : weapon.reserve;
    ctx.fillText(`${weapon.ammo}`, x - 58, y);
    ctx.font = `bold 16px ${MONO}`;
    ctx.fillStyle = '#8d957f';
    ctx.fillText(`/ ${reserve}`, x, y - 2);
    ctx.font = `bold 13px ${MONO}`;
    ctx.fillStyle = '#aab39a';
    ctx.fillText(weapon.reloading ? 'RELOADING…' : weapon.name.toUpperCase(), x, y - 36);

    // Weapon slots.
    const slots = game.weapons.slots;
    ctx.font = `11px ${MONO}`;
    for (let i = 0; i < slots.length; i++) {
      const sel = i === game.weapons.index;
      ctx.fillStyle = sel ? '#d65c32' : '#6b7361';
      ctx.fillText(`[${i + 1}] ${slots[i].shortName}`, x, y - 56 - (slots.length - 1 - i) * 15);
    }
  }

  drawScore(ctx) {
    const game = this.game;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `bold 20px ${MONO}`;
    ctx.fillStyle = '#e8e2cf';
    ctx.fillText(`SCORE ${game.player.score}`, 18, 16);
    ctx.font = `13px ${MONO}`;
    ctx.fillStyle = '#8d957f';
    ctx.fillText(`KILLS ${game.player.kills}   DEATHS ${game.player.deaths}`, 18, 42);

    // Threat meter (difficulty level).
    const w = 140, h = 6;
    ctx.fillStyle = 'rgba(30, 36, 28, 1)';
    ctx.fillRect(18, 64, w, h);
    ctx.fillStyle = '#d65c32';
    ctx.fillRect(18, 64, w * game.difficulty.level, h);
    ctx.fillStyle = '#6b7361';
    ctx.font = `10px ${MONO}`;
    ctx.fillText('THREAT', 18 + w + 8, 62);
  }

  drawPickupPrompt(ctx) {
    const pickup = this.game.weapons.nearbyPickup;
    if (!pickup) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = `bold 14px ${MONO}`;
    ctx.fillStyle = '#e8c878';
    ctx.fillText(
      `[E] TAKE ${pickup.weapon.name.toUpperCase()}`,
      this.game.canvas.width / 2,
      this.game.canvas.height - 70
    );
  }

  drawCrosshair(ctx) {
    const game = this.game;
    // On touch devices the mouse position is never updated during gameplay —
    // draw the crosshair at screen center instead.
    const touch = game.touch;
    const isTouchActive = touch && touch.active;
    const x = isTouchActive ? game.canvas.width / 2  : game.input.mouse.x;
    const y = isTouchActive ? game.canvas.height / 2 : game.input.mouse.y;
    const weapon = game.weapons.current;
    const spread = weapon ? weapon.spread : 0.03;
    const gap = 5 + spread * 110 + this.recoilBloom + (game.player.moving ? 3 : 0)
      - (game.player.crouching ? 2 : 0);
    const len = 7;

    ctx.save();
    ctx.strokeStyle = 'rgba(232, 226, 207, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - gap - len, y); ctx.lineTo(x - gap, y);
    ctx.moveTo(x + gap, y); ctx.lineTo(x + gap + len, y);
    ctx.moveTo(x, y - gap - len); ctx.lineTo(x, y - gap);
    ctx.moveTo(x, y + gap); ctx.lineTo(x, y + gap + len);
    ctx.stroke();
    ctx.fillStyle = 'rgba(214, 92, 50, 0.9)';
    ctx.fillRect(x - 1, y - 1, 2, 2);

    // Reload progress ring.
    if (weapon && weapon.reloading) {
      ctx.strokeStyle = '#d65c32';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, gap + len + 6, -Math.PI / 2, -Math.PI / 2 + weapon.reloadProgress * Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}
