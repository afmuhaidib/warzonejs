// player/SlideSystem.js — Sprint + crouch = slide: a momentum burst along the
// current move direction with an exponential decay curve, low profile (counts
// as crouching for AI vision), steering locked. Costs a stamina chunk; ends
// when speed decays out, time expires, or the player releases crouch.
// Dependencies: StaminaSystem, CollisionMap (via game), utils/Vector2.

import { Vector2 } from '../utils/Vector2.js';
import { SLIDE_COST } from './StaminaSystem.js';

const SLIDE_SPEED = 430;
const DECAY = 3.2;            // exponential speed decay rate
const MAX_TIME = 0.85;
const MIN_SPEED = 90;         // slide ends below this

export class SlideSystem {
  constructor(game) {
    this.game = game;
    this.dir = new Vector2();
    this.speed = 0;
    this.time = 0;
  }

  update(dt) {
    const { input, player, map, movement } = this.game;
    if (!player.alive) { player.sliding = false; return; }

    // Trigger: crouch pressed while sprinting with stamina available.
    if (!player.sliding && player.sprinting
      && (input.wasPressed('ControlLeft') || input.wasPressed('KeyC'))
      && movement.stamina.canSprint) {
      const v = player.vel;
      if (v.lengthSq() > 100) {
        player.sliding = true;
        this.dir.copy(v).normalize();
        this.speed = SLIDE_SPEED;
        this.time = 0;
        movement.stamina.spend(SLIDE_COST);
      }
    }

    if (!player.sliding) return;

    this.time += dt;
    this.speed *= Math.exp(-DECAY * dt);
    const stillHeld = input.isDown('ControlLeft') || input.isDown('KeyC');
    if (this.time > MAX_TIME || this.speed < MIN_SPEED || !stillHeld || player.prone) {
      player.sliding = false;
      return;
    }

    map.collision.moveCircle(player.pos, this.dir.x * this.speed * dt, this.dir.y * this.speed * dt, player.radius);
    player.vel.copy(this.dir).scale(this.speed); // keep vel honest for bob/AI
  }
}
