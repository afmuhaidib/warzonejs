// effects/HitSpark.js — Particle burst at impact points: wall hits spark
// sand-yellow, flesh hits spark red. Simple velocity + drag + fade particles.
// Dependencies: utils/MathUtils.

import { randRange } from '../utils/MathUtils.js';

export class HitSpark {
  constructor(x, y, color = '#d8c98e', count = 6) {
    this.color = color;
    this.life = 0.35;
    this.maxLife = this.life;
    this.parts = [];
    for (let i = 0; i < count; i++) {
      const a = randRange(0, Math.PI * 2);
      const s = randRange(60, 220);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s });
    }
  }

  update(dt) {
    this.life -= dt;
    const drag = Math.exp(-7 * dt);
    for (const p of this.parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= drag;
      p.vy *= drag;
    }
    return this.life > 0;
  }

  draw(ctx) {
    const t = this.life / this.maxLife;
    ctx.fillStyle = this.color;
    ctx.globalAlpha = t;
    for (const p of this.parts) {
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
  }
}
