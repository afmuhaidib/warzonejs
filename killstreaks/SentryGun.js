// killstreaks/SentryGun.js — 7-kill streak: places an auto-targeting turret at
// the player's position facing their aim. The turret scans, locks the nearest
// enemy with line of sight inside range, traverses (limited turn rate), and
// fires AR-class bullets through the shared BulletPool (team 'player', so
// kills credit the streak owner via the turret entity). Despawns after 45s.
// Dependencies: BulletPool, CollisionMap (LOS), AssaultRifle config, utils.

import { Vector2 } from '../utils/Vector2.js';
import { angleDiff, normalizeAngle, clamp, gaussian } from '../utils/MathUtils.js';
import { AssaultRifle } from '../weapons/AssaultRifle.js';

const LIFETIME = 45;
const RANGE = 430;
const TURN_RATE = 3.2;
const FIRE_ANGLE = 0.1;
const AIM_ERROR = 0.05;

export class SentryGun {
  constructor(game, pos, angle) {
    this.game = game;
    this.pos = pos.clone();
    this.angle = angle;
    this.team = 'player';
    this.name = 'Sentry';
    this.radius = 12;
    this.life = LIFETIME;
    this.weapon = new AssaultRifle({ damage: 9, defaultReserve: Infinity, fireRate: 7, soundRadius: 500 });
    this.target = null;
    this.dead = false;
  }

  update(dt) {
    const game = this.game;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.weapon.update(dt);

    // Acquire: nearest visible enemy in range.
    this.target = null;
    let best = RANGE;
    for (const e of game.ai.enemies) {
      const d = e.pos.distanceTo(this.pos);
      if (d < best && game.map.collision.lineOfSight(this.pos, e.pos)) {
        best = d;
        this.target = e;
      }
    }

    if (this.target) {
      const want = Math.atan2(this.target.pos.y - this.pos.y, this.target.pos.x - this.pos.x);
      const d = angleDiff(this.angle, want);
      this.angle = normalizeAngle(this.angle + clamp(d, -TURN_RATE * dt, TURN_RATE * dt));
      if (Math.abs(angleDiff(this.angle, want)) < FIRE_ANGLE) {
        this.weapon.tryFire(game, this, this.angle + gaussian() * AIM_ERROR);
      }
    } else {
      // Idle scan sweep.
      this.angle = normalizeAngle(this.angle + Math.sin(game.time * 0.8) * 0.6 * dt);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);

    // Base.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(2, 3, 14, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b2e24';
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0d110b';
    ctx.stroke();

    // Tripod legs.
    ctx.strokeStyle = '#1b1d16';
    ctx.lineWidth = 3;
    for (const a of [0.6, 2.7, 4.7]) {
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
      ctx.lineTo(Math.cos(a) * 17, Math.sin(a) * 17);
      ctx.stroke();
    }

    // Gun head.
    ctx.rotate(this.angle);
    ctx.fillStyle = '#3a3d35';
    ctx.fillRect(-4, -5, 14, 10);
    ctx.fillStyle = '#15170f';
    ctx.fillRect(10, -2, 16, 4);
    // Status light: red when locked.
    ctx.fillStyle = this.target ? '#e04f33' : '#7ab648';
    ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();

    // Lifetime pip.
    ctx.fillStyle = 'rgba(30,36,28,0.9)';
    ctx.fillRect(this.pos.x - 12, this.pos.y - 22, 24, 3);
    ctx.fillStyle = '#9fe09a';
    ctx.fillRect(this.pos.x - 12, this.pos.y - 22, 24 * (this.life / LIFETIME), 3);
  }
}
