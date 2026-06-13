// effects/BulletTracer.js — Fading light streak left at the muzzle when a gun
// fires (the in-flight streak is drawn by Bullet itself). Length scales with
// the weapon's tracerLen so the sniper reads as a beam. Leaf module.

export class BulletTracer {
  constructor(x, y, angle, len = 46) {
    this.x = x; this.y = y;
    this.dx = Math.cos(angle);
    this.dy = Math.sin(angle);
    this.len = len;
    this.life = 0.1;
    this.maxLife = this.life;
  }

  update(dt) {
    this.life -= dt;
    return this.life > 0;
  }

  draw(ctx) {
    const t = this.life / this.maxLife;
    ctx.strokeStyle = `rgba(255, 215, 140, ${0.55 * t})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + this.dx * this.len * t, this.y + this.dy * this.len * t);
    ctx.stroke();
  }
}
