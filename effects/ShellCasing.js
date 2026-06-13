// effects/ShellCasing.js — Purely visual brass ejection: a tiny spinning rect
// kicked out perpendicular to the shot, decelerates, lands, lingers, fades.
// Dependencies: utils/MathUtils.

import { randRange } from '../utils/MathUtils.js';

export class ShellCasing {
  constructor(x, y, shotAngle) {
    const eject = shotAngle + Math.PI / 2 + randRange(-0.4, 0.4); // out the right side
    const speed = randRange(90, 170);
    this.x = x; this.y = y;
    this.vx = Math.cos(eject) * speed;
    this.vy = Math.sin(eject) * speed;
    this.rot = randRange(0, Math.PI * 2);
    this.spin = randRange(-14, 14);
    this.life = randRange(1.6, 2.4);
    this.maxLife = this.life;
  }

  update(dt) {
    this.life -= dt;
    const drag = Math.exp(-5 * dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= drag;
    this.vy *= drag;
    this.rot += this.spin * dt;
    this.spin *= drag;
    return this.life > 0;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.globalAlpha = Math.min(1, this.life / 0.5);
    ctx.fillStyle = '#b89a4a';
    ctx.fillRect(-2.5, -1, 5, 2);
    ctx.restore();
  }
}
