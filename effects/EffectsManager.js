// effects/EffectsManager.js — Central effects dispatcher. All world-space VFX
// (flash, tracer, sparks, brass) live in one list of {update(dt)->alive, draw}
// objects; screen shake is held separately because the Camera reads it.
// Dependencies: the five effect classes.

import { ScreenShake } from './ScreenShake.js';
import { MuzzleFlash } from './MuzzleFlash.js';
import { BulletTracer } from './BulletTracer.js';
import { HitSpark } from './HitSpark.js';
import { ShellCasing } from './ShellCasing.js';

const MAX_EFFECTS = 400;

export class EffectsManager {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.screenShake = new ScreenShake();
  }

  spawn(fx) {
    if (this.list.length < MAX_EFFECTS) this.list.push(fx);
  }

  addShake(amount) { this.screenShake.add(amount); }
  muzzleFlash(x, y, angle, size) { this.spawn(new MuzzleFlash(x, y, angle, size)); }
  tracer(x, y, angle, len) { this.spawn(new BulletTracer(x, y, angle, len)); }
  hitSpark(x, y, color, count) { this.spawn(new HitSpark(x, y, color, count)); }
  shellCasing(x, y, angle) { this.spawn(new ShellCasing(x, y, angle)); }

  update(dt) {
    this.screenShake.update(dt);
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (!this.list[i].update(dt)) this.list.splice(i, 1);
    }
  }

  draw(ctx) {
    for (const fx of this.list) fx.draw(ctx);
  }
}
