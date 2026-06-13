// player/LeanSystem.js — Q/E lean: shifts the player's effective muzzle/eye
// position perpendicular to the aim direction so you can fire around a corner
// while keeping the body in cover. The offset lerps in/out (never snaps) and
// is consumed by Weapon.tryFire (muzzle origin) and PlayerRenderer-adjacent
// draws via player.leanOffset.
// Dependencies: InputManager (via game), utils/Vector2.

import { Vector2 } from '../utils/Vector2.js';

const LEAN_DIST = 16;
const LEAN_RATE = 8;

export class LeanSystem {
  constructor(game) {
    this.game = game;
    this.t = 0; // -1 (left) .. 1 (right)
  }

  update(dt) {
    const { input, player } = this.game;
    let want = 0;
    // Suppress lean when E is being used for interact (pickup / S&D plant)
    const eBlocked = !!this.game.weapons.nearbyPickup || this.game.modes?.mode?.constructor?.name === 'SearchAndDestroy';
    if (player.alive && !player.sprinting && !player.sliding) {
      if (input.isDown('KeyQ')) want -= 1;
      if (input.isDown('KeyE') && !eBlocked) want += 1;
    }
    this.t += (want - this.t) * Math.min(1, LEAN_RATE * dt);

    // Perpendicular to aim: lean right = +90° from facing.
    const perp = player.angle + Math.PI / 2;
    if (!player.leanOffset) player.leanOffset = new Vector2();
    player.leanOffset.set(
      Math.cos(perp) * LEAN_DIST * this.t,
      Math.sin(perp) * LEAN_DIST * this.t
    );
  }
}
