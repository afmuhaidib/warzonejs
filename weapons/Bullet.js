// weapons/Bullet.js — One projectile: travel, wall trace (DDA via CollisionMap),
// entity hits (segment-vs-circle so fast bullets can't tunnel), range falloff,
// headshot rolls (combat/HeadshotSystem), thin-wall penetration
// (combat/PenetrationSystem), 'hit' events for UI/XP, and its own tracer draw.
// Pooled by BulletPool; never allocated per shot.
// Dependencies: world/CollisionMap (via game), effects (via game),
// combat/HeadshotSystem, combat/PenetrationSystem.

import { HeadshotSystem } from '../combat/HeadshotSystem.js';
import { PenetrationSystem } from '../combat/PenetrationSystem.js';

const SUPPRESS_RADIUS = 42; // a round passing within this of a soldier rattles them

export class Bullet {
  constructor() {
    this.x = 0; this.y = 0;
    this.dx = 0; this.dy = 0;        // unit direction
    this.speed = 0;
    this.traveled = 0;
    this.range = 0;
    this.damage = 0;
    this.team = '';
    this.shooter = null;
    this.color = '#ffd27a';
    this.dead = true;
  }

  init(x, y, angle, weapon, shooter) {
    this.x = x; this.y = y;
    this.dx = Math.cos(angle);
    this.dy = Math.sin(angle);
    this.speed = weapon.bulletSpeed;
    this.range = weapon.range;
    this.damage = weapon.damage;
    this.color = weapon.color;
    this.team = shooter.team;
    this.shooter = shooter;
    this.traveled = 0;
    this.dead = false;
    this.weaponKind = weapon.shortName;
    // Snipers penetrate natively; FMJ grants it to everything else.
    this.penetrate = !!weapon.penetrate || weapon.shortName === 'SNP';
    this.penetrated = false;
  }

  update(dt, game) {
    const step = Math.min(this.speed * dt, this.range - this.traveled);
    const x1 = this.x + this.dx * step;
    const y1 = this.y + this.dy * step;

    // Earliest hit along this frame's segment: walls vs entities.
    let tHit = 1;
    let hitEntity = null;

    const wall = game.map.collision.bulletTrace(this.x, this.y, x1, y1);
    if (wall) tHit = wall.t;

    // Build all hittable targets: every entity NOT on the shooter's team.
    const targets = [];
    if (game.player.alive && game.player.team !== this.team) targets.push(game.player);
    for (const f of (game.friendlies || [])) {
      if (f.alive && f.team !== this.team) targets.push(f);
    }
    for (const e of game.ai.enemies) {
      if (e.health > 0 && e.team !== this.team) targets.push(e);
    }
    for (const e of targets) {
      const t = segmentCircle(this.x, this.y, x1, y1, e.pos.x, e.pos.y, e.radius + 2);
      if (t !== null && t < tHit) {
        // Prone targets are a smaller profile: long shots sometimes sail over.
        if (e.prone && this.traveled > 200 && Math.random() < 0.3) continue;
        tHit = t;
        hitEntity = e;
      } else if (e.onSuppressed) {
        // Near-miss: a round cracking past pins the soldier even if it didn't
        // connect. This is what lets the player suppress enemies with volume.
        const md = pointSegDist(e.pos.x, e.pos.y, this.x, this.y, x1, y1);
        if (md < SUPPRESS_RADIUS && md > e.radius) {
          e.onSuppressed((1 - md / SUPPRESS_RADIUS) * 0.28, this.shooter);
        }
      }
    }

    const hx = this.x + this.dx * step * tHit;
    const hy = this.y + this.dy * step * tHit;

    if (hitEntity) {
      // Headshot: how close did the path pass to dead center?
      const missDist = pointSegDist(hitEntity.pos.x, hitEntity.pos.y, this.x, this.y, hx, hy);
      const headshot = HeadshotSystem.isHeadshot(missDist, hitEntity);
      const dmg = this.damage * (headshot ? HeadshotSystem.multiplier(this.weaponKind) : 1);

      if (hitEntity.lastHitExplosive !== undefined) hitEntity.lastHitExplosive = false;
      const killed = hitEntity.health - dmg <= 0;
      hitEntity.damage(game, dmg, { x: this.x, y: this.y }, this.shooter);
      if (this.shooter && this.shooter.shotsHit !== undefined) this.shooter.shotsHit++;
      game.events.emit('hit', {
        target: hitEntity, amount: dmg, headshot, killed,
        pos: { x: hx, y: hy }, byTeam: this.team, weapon: this.weaponKind,
      });
      game.effects.hitSpark(hx, hy, headshot ? '#ffb066' : '#c44232', headshot ? 9 : 6);
      this.dead = true;
    } else if (wall && tHit === wall.t) {
      if (PenetrationSystem.canPenetrate(this, game.map.grid.get(wall.tx, wall.ty))) {
        // Punch through: re-emerge past the thin tile at reduced damage.
        PenetrationSystem.applyFalloff(this);
        game.effects.hitSpark(hx, hy, '#d8c98e', 4);
        const ex = hx + this.dx * 44;
        const ey = hy + this.dy * 44;
        if (game.map.collision.bulletBlockAt(
          game.map.collision.worldToTile(ex), game.map.collision.worldToTile(ey))) {
          this.dead = true; // exit point is inside another solid: stop here
        } else {
          game.effects.hitSpark(ex, ey, '#d8c98e', 3);
          this.x = ex;
          this.y = ey;
          this.traveled += step * tHit + 44;
          return;
        }
      } else {
        game.effects.hitSpark(hx, hy, '#d8c98e', 4);
        this.dead = true;
      }
    }

    this.x = hx;
    this.y = hy;
    this.traveled += step * tHit;
    if (this.traveled >= this.range) this.dead = true;
  }

  draw(ctx) {
    const len = Math.min(this.traveled, 22);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(this.x - this.dx * len, this.y - this.dy * len);
    ctx.lineTo(this.x, this.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/** Distance from point (px,py) to segment (x0,y0)-(x1,y1). */
function pointSegDist(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - x0) * dx + (py - y0) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x0 + dx * t - px, y0 + dy * t - py);
}

/** Earliest t in [0,1] where segment (x0,y0)-(x1,y1) enters the circle, or null. */
function segmentCircle(x0, y0, x1, y1, cx, cy, r) {
  const dx = x1 - x0, dy = y1 - y0;
  const fx = x0 - cx, fy = y0 - cy;
  const a = dx * dx + dy * dy;
  if (a < 1e-9) return fx * fx + fy * fy <= r * r ? 0 : null;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  const t1 = (-b - sq) / (2 * a);
  if (t1 >= 0 && t1 <= 1) return t1;
  const t2 = (-b + sq) / (2 * a);
  if (t2 >= 0 && t2 <= 1) return 0; // started inside
  return null;
}
