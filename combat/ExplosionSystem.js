// combat/ExplosionSystem.js — The one place anything detonates (grenades,
// airstrikes, claymores). Damage falls off linearly across the radius, low
// cover between the blast and a target halves it (bullet-block trace), and
// both player and enemies take knockback force. Spawns the visual ring +
// sparks, big screen shake by proximity, an 'explosion' event for audio, and
// a 'sound' event so AI hears it.
// Dependencies: CollisionMap, EffectsManager, EventBus (via game).

export class ExplosionSystem {
  constructor(game) {
    this.game = game;
  }

  /**
   * @param {Vector2} pos  @param {number} radius  @param {number} damage  max at center
   * @param {object} source  attacking entity (team decides who scores)
   */
  // No per-frame state — explosions are immediate; BlastRing lives in effects list.
  update(_dt) {}

  explode(pos, radius, damage, source) {
    const game = this.game;

    // Visuals + audio + AI hearing.
    game.effects.spawn(new BlastRing(pos.x, pos.y, radius));
    game.effects.hitSpark(pos.x, pos.y, '#ffb066', 18);
    game.effects.hitSpark(pos.x, pos.y, '#d8c98e', 12);
    const playerDist = game.player.pos.distanceTo(pos);
    game.effects.addShake(Math.min(0.7, 0.9 * (1 - playerDist / (radius * 4))));
    game.events.emit('explosion', { pos: pos.clone(), radius });
    game.events.emit('sound', { pos: pos.clone(), radius: 900, team: source ? source.team : 'none' });

    // Damage + knockback for every entity in range.
    const targets = [...game.ai.enemies];
    if (game.player.alive) targets.push(game.player);
    for (const t of targets) {
      const d = t.pos.distanceTo(pos);
      if (d > radius) continue;
      // No friendly fire — except your own grenades, which absolutely hurt you.
      if (source && t.team === source.team && t !== source) continue;

      let dmg = damage * (1 - d / radius);
      const wall = game.map.collision.bulletTrace(pos.x, pos.y, t.pos.x, t.pos.y);
      if (wall) dmg *= 0.5; // cover absorbs half the blast

      if (dmg >= 1) {
        if (t.lastHitExplosive !== undefined) t.lastHitExplosive = true;
        t.damage(game, dmg, pos, source);
      }

      // Knockback impulse away from the blast center.
      if (t.vel && d > 1) {
        const f = 420 * (1 - d / radius);
        t.vel.x += ((t.pos.x - pos.x) / d) * f;
        t.vel.y += ((t.pos.y - pos.y) / d) * f;
      }
    }
  }
}

/** Expanding shockwave ring drawn through the effects list. */
class BlastRing {
  constructor(x, y, radius) {
    this.x = x; this.y = y;
    this.radius = radius;
    this.life = 0.35;
    this.maxLife = this.life;
  }

  update(dt) {
    this.life -= dt;
    return this.life > 0;
  }

  draw(ctx) {
    const t = 1 - this.life / this.maxLife;
    ctx.save();
    ctx.globalAlpha = (1 - t) * 0.8;
    ctx.strokeStyle = '#ffd9a0';
    ctx.lineWidth = 4 * (1 - t) + 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * (0.3 + 0.7 * t), 0, Math.PI * 2);
    ctx.stroke();
    // Hot core flash early on.
    if (t < 0.4) {
      ctx.globalAlpha = (0.4 - t) * 2;
      ctx.fillStyle = '#fff3d0';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 0.35 * (1 - t), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
