// weapons/WeaponPickup.js — A dropped weapon lying in the world: bobbing icon,
// despawn timer, picked up via WeaponManager ([E] prompt). Spawned when enemies
// die or when the player swaps guns.
// Dependencies: utils/Vector2 (positions passed in).

const LIFETIME = 30; // seconds before a dropped gun despawns

export class WeaponPickup {
  constructor(pos, weapon) {
    this.pos = pos.clone();
    this.weapon = weapon;
    this.age = 0;
    this.dead = false;
  }

  update(dt) {
    this.age += dt;
    if (this.age > LIFETIME) this.dead = true;
  }

  draw(ctx, game) {
    const bob = Math.sin(game.time * 3 + this.pos.x) * 2;
    const fading = this.age > LIFETIME - 4 && Math.floor(this.age * 4) % 2 === 0;
    if (fading) return;

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y + bob);

    // Glow ring so drops read at a glance.
    ctx.strokeStyle = 'rgba(214, 161, 60, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -bob, 16 + Math.sin(game.time * 4) * 2, 0, Math.PI * 2);
    ctx.stroke();

    // Gun silhouette.
    ctx.rotate(-0.5);
    ctx.fillStyle = '#15170f';
    ctx.fillRect(-12, -2, 24, 4);
    ctx.fillRect(2, 2, 4, 6);
    ctx.fillStyle = '#d6a13c';
    ctx.fillRect(-12, -2, 5, 4);

    ctx.restore();
  }
}
