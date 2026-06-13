// equipment/AmmoCrate.js — Placeable resupply crate: standing within reach
// drip-feeds reserve ammo for every carried weapon (and tops grenades back
// up) until the crate's stock runs dry. Lasts 60s or until empty.
// Dependencies: WeaponManager slots, GrenadeSystem (via game.combat).

const RANGE = 55;
const LIFETIME = 60;
const STOCK = 300;            // total rounds the crate can dispense
const RATE = 40;              // rounds per second while resupplying

export class AmmoCrate {
  constructor(game, pos) {
    this.game = game;
    this.pos = pos.clone();
    this.life = LIFETIME;
    this.stock = STOCK;
    this.dead = false;
    this.dispensing = false;
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0 || this.stock <= 0) { this.dead = true; return; }

    const game = this.game;
    const p = game.player;
    this.dispensing = false;
    if (!p.alive || p.pos.distanceTo(this.pos) > RANGE) return;

    for (const w of game.weapons.slots) {
      if (w.reserve === Infinity || w.reserve >= w.defaultReserve * 2) continue;
      const grant = Math.min(RATE * dt, this.stock, w.defaultReserve * 2 - w.reserve);
      if (grant > 0) {
        w.reserve += grant;
        this.stock -= grant;
        this.dispensing = true;
      }
    }
    // Top up grenades too (1 stock point each, slowly).
    const g = game.combat.grenades;
    if (g.carried < 2 && this.stock >= 25 && Math.random() < dt * 0.5) {
      g.carried++;
      this.stock -= 25;
      this.dispensing = true;
    }
  }

  draw(ctx, game) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(2, 3, 14, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3d4a2c';
    ctx.fillRect(-12, -9, 24, 18);
    ctx.strokeStyle = '#15170f';
    ctx.lineWidth = 2;
    ctx.strokeRect(-12, -9, 24, 18);
    ctx.fillStyle = '#d6a13c';
    ctx.fillRect(-8, -2, 16, 4);
    // Resupply glow.
    if (this.dispensing) {
      ctx.strokeStyle = `rgba(214, 161, 60, ${0.4 + Math.sin(game.time * 8) * 0.2})`;
      ctx.beginPath();
      ctx.arc(0, 0, RANGE * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Stock bar.
    ctx.fillStyle = 'rgba(30,36,28,0.9)';
    ctx.fillRect(-12, -16, 24, 3);
    ctx.fillStyle = '#d6a13c';
    ctx.fillRect(-12, -16, 24 * (this.stock / 300), 3);
    ctx.restore();
  }
}
