// ui/DamageNumbers.js — Floating damage numbers on every player-dealt hit:
// spawn at the impact point, arc upward with a little horizontal drift, fade
// out. Headshots are bigger and orange; kills pop. World-space — the numbers
// ride the effects list so they render inside the camera transform.
// Dependencies: 'hit' events, EffectsManager.spawn.

export class DamageNumbers {
  constructor(game) {
    this.game = game;
    game.events.on('hit', ({ amount, headshot, killed, pos, byPlayer }) => {
      if (!byPlayer || !pos) return;
      game.effects.spawn(new FloatingNumber(pos.x, pos.y, Math.round(amount), headshot, killed));
    });
  }
}

class FloatingNumber {
  constructor(x, y, amount, headshot, killed) {
    this.x = x + (Math.random() - 0.5) * 10;
    this.y = y - 8;
    this.vx = (Math.random() - 0.5) * 30;
    this.vy = -65;
    this.text = killed ? `${amount} ☠` : `${amount}`;
    this.color = headshot ? '#ffb066' : killed ? '#e04f33' : '#e8e2cf';
    this.size = headshot || killed ? 15 : 12;
    this.life = 0.8;
    this.maxLife = this.life;
  }

  update(dt) {
    this.life -= dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 60 * dt; // arc: decelerating rise
    return this.life > 0;
  }

  draw(ctx) {
    const t = this.life / this.maxLife;
    ctx.save();
    ctx.globalAlpha = Math.min(1, t * 2);
    ctx.font = `bold ${this.size}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0a0c0a';
    ctx.fillText(this.text, this.x + 1, this.y + 1);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}
