// weapons/BulletPool.js — Object pool for bullets. Owns the active list,
// spawns via fire(), recycles dead bullets back into the pool each frame.
// Dependencies: Bullet, utils/ObjectPool.

import { Bullet } from './Bullet.js';
import { ObjectPool } from '../utils/ObjectPool.js';

export class BulletPool {
  constructor(game) {
    this.game = game;
    this.pool = new ObjectPool(() => new Bullet(), 96);
    this.active = [];
  }

  fire(x, y, angle, weapon, shooter) {
    const b = this.pool.acquire();
    b.init(x, y, angle, weapon, shooter);
    this.active.push(b);
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const b = this.active[i];
      b.update(dt, this.game);
      if (b.dead) {
        this.active.splice(i, 1);
        this.pool.release(b);
      }
    }
  }

  draw(ctx) {
    for (const b of this.active) b.draw(ctx);
  }
}
