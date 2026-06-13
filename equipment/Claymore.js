// equipment/Claymore.js — Placeable directional trip-mine. Faces the player's
// aim at placement; arms after 1s; any enemy entering the 70px / ±60° trigger
// cone in front detonates it through ExplosionSystem (directional damage —
// targets behind the mine take nothing extra; the blast handles falloff).
// Dependencies: ExplosionSystem (via game.combat), utils/MathUtils.

import { angleDiff } from '../utils/MathUtils.js';

const TRIGGER_RANGE = 70;
const TRIGGER_HALF_ANGLE = 1.05;  // ~60°
const ARM_TIME = 1;
const RADIUS = 110;
const DAMAGE = 140;

export class Claymore {
  constructor(game, pos, angle) {
    this.game = game;
    this.pos = pos.clone();
    this.angle = angle;
    this.armTimer = ARM_TIME;
    this.dead = false;
  }

  update(dt) {
    if (this.armTimer > 0) { this.armTimer -= dt; return; }

    for (const e of this.game.ai.enemies) {
      const d = e.pos.distanceTo(this.pos);
      if (d > TRIGGER_RANGE) continue;
      const toEnemy = Math.atan2(e.pos.y - this.pos.y, e.pos.x - this.pos.x);
      if (Math.abs(angleDiff(this.angle, toEnemy)) > TRIGGER_HALF_ANGLE) continue;
      this.dead = true;
      this.game.combat.explosions.explode(this.pos, RADIUS, DAMAGE, this.game.player);
      return;
    }
  }

  draw(ctx, game) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.angle);

    // Trigger cone hint (faint; brighter while arming).
    const arming = this.armTimer > 0;
    ctx.fillStyle = arming ? 'rgba(214, 161, 60, 0.12)' : 'rgba(224, 79, 51, 0.06)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, TRIGGER_RANGE, -TRIGGER_HALF_ANGLE, TRIGGER_HALF_ANGLE);
    ctx.closePath();
    ctx.fill();

    // Body.
    ctx.fillStyle = '#2c3526';
    ctx.fillRect(-3, -7, 6, 14);
    ctx.fillStyle = '#1b1d16';
    ctx.fillRect(-5, -8, 2, 16);
    // Laser blink once armed.
    if (!arming && Math.sin(game.time * 6) > 0) {
      ctx.strokeStyle = 'rgba(224, 79, 51, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(3, 0);
      ctx.lineTo(TRIGGER_RANGE, 0);
      ctx.stroke();
    }
    ctx.restore();
  }
}
