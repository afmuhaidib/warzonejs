// effects/MuzzleFlash.js — Brief star-burst of light at the barrel tip.
// Lives ~3 frames; size comes from the weapon config. Leaf module.

export class MuzzleFlash {
  constructor(x, y, angle, size = 13) {
    this.x = x; this.y = y;
    this.angle = angle;
    this.size = size;
    this.life = 0.055;
    this.maxLife = this.life;
  }

  update(dt) {
    this.life -= dt;
    return this.life > 0;
  }

  draw(ctx) {
    const t = this.life / this.maxLife;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.globalAlpha = t;

    // Core glow.
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
    g.addColorStop(0, 'rgba(255, 240, 190, 0.95)');
    g.addColorStop(0.4, 'rgba(255, 180, 80, 0.7)');
    g.addColorStop(1, 'rgba(255, 120, 30, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
    ctx.fill();

    // Forward spike.
    ctx.strokeStyle = 'rgba(255, 230, 160, 0.9)';
    ctx.lineWidth = 3 * t;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(this.size * 1.6, 0);
    ctx.stroke();

    ctx.restore();
  }
}
