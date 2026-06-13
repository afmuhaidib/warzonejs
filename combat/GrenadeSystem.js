// combat/GrenadeSystem.js — Frag grenades on G: hold to cook (4s fuse runs
// while held — cook too long and it kills you in hand), release to throw
// toward the mouse. While held, a dotted arc trajectory preview is drawn in
// world space, simulated with the same physics the live grenade uses (friction
// + wall bounces), so the preview is honest. Grenades bounce off solids by
// axis reflection and explode on fuse end.
// Dependencies: ExplosionSystem, CollisionMap, utils/Vector2, EventBus.

import { Vector2 } from '../utils/Vector2.js';

const FUSE = 4;
const THROW_SPEED = 540;
const FRICTION = 1.6;
const RADIUS = 120;
const DAMAGE = 130;
const MAX_CARRIED = 2;

export class GrenadeSystem {
  constructor(game) {
    this.game = game;
    this.live = [];
    this.cooking = false;
    this.cookTime = 0;
    this.carried = MAX_CARRIED;
    game.events.on('player:respawned', () => { this.carried = MAX_CARRIED; this.cooking = false; });
  }

  /** Touch shortcut: instantly throw (no cook time). */
  tryThrow(game) {
    const { player } = game;
    if (!player.alive || this.carried <= 0 || this.cooking) return;
    this.cookTime = 0;
    this.throw();
  }

  update(dt) {
    const { input, player } = this.game;

    // --- cook & throw ---
    if (player.alive && this.carried > 0) {
      if (input.wasPressed('KeyG') && !this.cooking) {
        this.cooking = true;
        this.cookTime = 0;
      }
      if (this.cooking) {
        this.cookTime += dt;
        if (this.cookTime >= FUSE) {
          // Held too long: it goes off in your hand.
          this.cooking = false;
          this.carried--;
          this.game.combat.explosions.explode(player.pos.clone(), RADIUS, DAMAGE, player);
        } else if (!input.isDown('KeyG')) {
          this.throw();
        }
      }
    } else {
      this.cooking = false;
    }

    // --- live grenades ---
    for (let i = this.live.length - 1; i >= 0; i--) {
      const g = this.live[i];
      this.step(g, dt);
      g.fuse -= dt;
      if (g.fuse <= 0) {
        this.live.splice(i, 1);
        this.game.combat.explosions.explode(g.pos, RADIUS, DAMAGE, g.thrower);
      }
    }
  }

  throw() {
    const { player, camera, input, touch } = this.game;
    this.cooking = false;
    this.carried--;
    let a, speed;
    if (touch && touch.active) {
      // On touch devices input.mouse isn't updated; throw in the player's aim direction.
      a = player.angle;
      speed = THROW_SPEED;
    } else {
      const m = camera.screenToWorld(input.mouse.x, input.mouse.y);
      const dist = Math.min(420, player.pos.distanceTo(m));
      a = Math.atan2(m.y - player.pos.y, m.x - player.pos.x);
      speed = THROW_SPEED * (dist / 420);
    }
    this.live.push({
      pos: player.pos.clone(),
      vel: Vector2.fromAngle(a, speed),
      fuse: Math.max(0.05, FUSE - this.cookTime),
      thrower: player,
    });
    this.game.events.emit('sound', { pos: player.pos.clone(), radius: 90, team: 'player' });
  }

  /** One physics step: friction + wall bounce (shared by sim + preview). */
  step(g, dt) {
    const col = this.game.map.collision;
    const damp = Math.exp(-FRICTION * dt);
    g.vel.scale(damp);
    const nx = g.pos.x + g.vel.x * dt;
    const ny = g.pos.y + g.vel.y * dt;
    // Axis-separated bounce.
    if (col.circleHits(nx, g.pos.y, 5)) g.vel.x *= -0.45; else g.pos.x = nx;
    if (col.circleHits(g.pos.x, ny, 5)) g.vel.y *= -0.45; else g.pos.y = ny;
  }

  drawWorld(ctx) {
    // Live grenades.
    for (const g of this.live) {
      ctx.fillStyle = '#2c3526';
      ctx.beginPath();
      ctx.arc(g.pos.x, g.pos.y, 5, 0, Math.PI * 2);
      ctx.fill();
      // Fuse blink, faster near detonation.
      if (Math.sin(g.fuse * (14 - g.fuse * 2)) > 0) {
        ctx.fillStyle = '#e04f33';
        ctx.fillRect(g.pos.x - 1.5, g.pos.y - 7, 3, 3);
      }
    }

    // Trajectory preview while cooking: simulate the real physics forward.
    if (this.cooking) {
      const { player, camera, input, touch } = this.game;
      let a, speed;
      if (touch && touch.active) {
        a = player.angle;
        speed = THROW_SPEED;
      } else {
        const m = camera.screenToWorld(input.mouse.x, input.mouse.y);
        const dist = Math.min(420, player.pos.distanceTo(m));
        a = Math.atan2(m.y - player.pos.y, m.x - player.pos.x);
        speed = THROW_SPEED * (dist / 420);
      }
      const ghost = { pos: player.pos.clone(), vel: Vector2.fromAngle(a, speed) };
      ctx.save();
      ctx.fillStyle = 'rgba(232, 226, 207, 0.7)';
      for (let i = 0; i < 40; i++) {
        this.step(ghost, 1 / 30);
        if (i % 2 === 0) ctx.fillRect(ghost.pos.x - 1, ghost.pos.y - 1, 2, 2);
      }
      // Landing marker + cook warning.
      ctx.strokeStyle = this.cookTime > FUSE * 0.6 ? '#e04f33' : 'rgba(232, 226, 207, 0.8)';
      ctx.beginPath();
      ctx.arc(ghost.pos.x, ghost.pos.y, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}
