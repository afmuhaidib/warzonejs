// killstreaks/AirstrikeCaller.js — 5-kill streak: activating enters targeting
// mode (crosshair becomes a strike marker, firing suppressed); the next left
// click marks the strike line. After a 1.6s inbound delay, five bombs walk
// across the marked point perpendicular-ish to a random heading, staggered
// 0.12s apart, each a full ExplosionSystem blast. Friendly fire applies — your
// own airstrike will absolutely kill you.
// Dependencies: ExplosionSystem, Camera (click → world), EventBus.

import { Vector2 } from '../utils/Vector2.js';

const BOMBS = 5;
const SPACING = 90;
const INBOUND_DELAY = 1.6;
const STAGGER = 0.12;
const RADIUS = 130;
const DAMAGE = 160;

export class AirstrikeCaller {
  constructor(game) {
    this.game = game;
    this.targeting = false;
    this.pending = [];   // {pos, t} bombs waiting to land
  }

  activate() {
    this.targeting = true;
  }

  update(dt) {
    const game = this.game;

    // --- targeting mode: next click marks the strike ---
    if (this.targeting && game.player.alive) {
      if (game.input.mouse.leftPressed) {
        game.input.mouse.leftPressed = false; // consume so the gun doesn't fire
        const center = game.camera.screenToWorld(game.input.mouse.x, game.input.mouse.y);
        const heading = Math.random() * Math.PI * 2;
        for (let i = 0; i < BOMBS; i++) {
          const off = (i - (BOMBS - 1) / 2) * SPACING;
          this.pending.push({
            pos: new Vector2(center.x + Math.cos(heading) * off, center.y + Math.sin(heading) * off),
            t: INBOUND_DELAY + i * STAGGER,
          });
        }
        this.targeting = false;
        game.events.emit('sound', { pos: center.clone(), radius: 500, team: 'player' });
      }
    }

    // --- inbound bombs ---
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const b = this.pending[i];
      b.t -= dt;
      if (b.t <= 0) {
        this.pending.splice(i, 1);
        game.combat.explosions.explode(b.pos, RADIUS, DAMAGE, game.player);
      }
    }
  }

  drawWorld(ctx) {
    // Impact markers while bombs are inbound.
    for (const b of this.pending) {
      const blink = Math.sin(b.t * 18) > 0;
      ctx.strokeStyle = blink ? 'rgba(224, 79, 51, 0.9)' : 'rgba(224, 79, 51, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(b.pos.x, b.pos.y, 16, 0, Math.PI * 2);
      ctx.moveTo(b.pos.x - 22, b.pos.y); ctx.lineTo(b.pos.x + 22, b.pos.y);
      ctx.moveTo(b.pos.x, b.pos.y - 22); ctx.lineTo(b.pos.x, b.pos.y + 22);
      ctx.stroke();
    }
  }

  drawScreen(ctx, game) {
    if (!this.targeting) return;
    const { x, y } = game.input.mouse;
    ctx.save();
    ctx.strokeStyle = '#e04f33';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.moveTo(x - 36, y); ctx.lineTo(x + 36, y);
    ctx.moveTo(x, y - 36); ctx.lineTo(x, y + 36);
    ctx.stroke();
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillStyle = '#e04f33';
    ctx.textAlign = 'center';
    ctx.fillText('CLICK TO MARK STRIKE', x, y - 44);
    ctx.restore();
  }
}
