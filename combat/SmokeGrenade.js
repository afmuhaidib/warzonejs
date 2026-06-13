// combat/SmokeGrenade.js — Tactical smoke on T (when the loadout carries
// smoke): a cloud that expands over 1.5s, holds for ~11s, then dissipates.
// The cloud genuinely blocks AI vision: Perception calls blocksLine(a, b) and
// treats an intersected sight line as no-LOS. Drawn as layered drifting blobs.
// Dependencies: GrenadeSystem physics (bounces), Perception hook, utils.

import { Vector2 } from '../utils/Vector2.js';

const FUSE = 1.2;
const THROW_SPEED = 480;
const MAX_R = 130;
const GROW_TIME = 1.5;
const HOLD_TIME = 11;
const FADE_TIME = 2.5;
const MAX_CARRIED = 2;

export class SmokeGrenade {
  constructor(game) {
    this.game = game;
    this.live = [];     // in-flight canisters
    this.clouds = [];   // active smoke volumes {pos, age, blobs[]}
    this.carried = MAX_CARRIED;
    game.events.on('player:respawned', () => { this.carried = MAX_CARRIED; });
  }

  update(dt) {
    const { input, player } = this.game;

    if (player.alive && this.carried > 0 && this.game.loadout.tactical === 'smoke'
      && input.wasPressed('KeyT')) {
      this.carried--;
      const m = this.game.camera.screenToWorld(input.mouse.x, input.mouse.y);
      const a = Math.atan2(m.y - player.pos.y, m.x - player.pos.x);
      this.live.push({ pos: player.pos.clone(), vel: Vector2.fromAngle(a, THROW_SPEED), fuse: FUSE });
    }

    for (let i = this.live.length - 1; i >= 0; i--) {
      const c = this.live[i];
      this.game.combat.grenades.step(c, dt);
      c.fuse -= dt;
      if (c.fuse <= 0) {
        this.live.splice(i, 1);
        this.clouds.push(makeCloud(c.pos));
        this.game.events.emit('sound', { pos: c.pos.clone(), radius: 300, team: 'player' });
      }
    }

    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const cl = this.clouds[i];
      cl.age += dt;
      if (cl.age > GROW_TIME + HOLD_TIME + FADE_TIME) this.clouds.splice(i, 1);
    }
  }

  /** Cloud radius at its current life stage. */
  radiusOf(cl) {
    if (cl.age < GROW_TIME) return MAX_R * (cl.age / GROW_TIME);
    const fadeStart = GROW_TIME + HOLD_TIME;
    if (cl.age > fadeStart) return MAX_R * Math.max(0, 1 - (cl.age - fadeStart) / FADE_TIME);
    return MAX_R;
  }

  /** True if segment a→b passes through any active cloud (used by Perception). */
  blocksLine(a, b) {
    for (const cl of this.clouds) {
      const r = this.radiusOf(cl) * 0.85; // a thin edge is still see-through-ish
      if (r < 20) continue;
      if (segDistSq(a, b, cl.pos) < r * r) return true;
    }
    return false;
  }

  drawWorld(ctx, game) {
    for (const c of this.live) {
      ctx.fillStyle = '#7a8378';
      ctx.beginPath();
      ctx.arc(c.pos.x, c.pos.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const cl of this.clouds) {
      const r = this.radiusOf(cl);
      if (r < 4) continue;
      const alpha = Math.min(0.85, r / MAX_R);
      for (const b of cl.blobs) {
        const drift = Math.sin(game.time * b.spin + b.seed) * 6;
        ctx.fillStyle = `rgba(${b.shade}, ${b.shade}, ${b.shade - 4}, ${alpha * b.a})`;
        ctx.beginPath();
        ctx.arc(cl.pos.x + b.ox * (r / MAX_R) + drift, cl.pos.y + b.oy * (r / MAX_R), b.r * (r / MAX_R), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function makeCloud(pos) {
  const blobs = [];
  for (let i = 0; i < 9; i++) {
    blobs.push({
      ox: (Math.random() - 0.5) * 130,
      oy: (Math.random() - 0.5) * 130,
      r: 40 + Math.random() * 45,
      a: 0.5 + Math.random() * 0.4,
      shade: 95 + Math.floor(Math.random() * 35),
      spin: 0.4 + Math.random() * 0.8,
      seed: Math.random() * 10,
    });
  }
  return { pos: pos.clone(), age: 0, blobs };
}

/** Squared distance from point c to segment ab. */
function segDistSq(a, b, c) {
  const abx = b.x - a.x, aby = b.y - a.y;
  const l2 = abx * abx + aby * aby;
  let t = l2 > 0 ? ((c.x - a.x) * abx + (c.y - a.y) * aby) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const dx = a.x + abx * t - c.x;
  const dy = a.y + aby * t - c.y;
  return dx * dx + dy * dy;
}
