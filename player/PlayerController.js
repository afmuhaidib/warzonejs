// player/PlayerController.js — Movement: WASD (or the touch joystick), sprint
// (Shift, stamina-gated), crouch (Ctrl/C), acceleration model, wall sliding
// via CollisionMap, mouse/touch aim, and footstep noise for AI hearing
// (gated by the Dead Silence field upgrade). Slide and mantle take over
// position control while active; prone caps speed.
// Dependencies: core/InputManager, world/CollisionMap, core/Camera,
// player movement systems + equipment + touch (all via game).

import { clamp } from '../utils/MathUtils.js';

const WALK_SPEED = 210;
const SPRINT_SPEED = 315;
const CROUCH_SPEED = 110;
const ACCEL_RATE = 12;       // exponential approach rate toward target velocity
const FOOTSTEP_INTERVAL = 0.34;
const FOOTSTEP_RADIUS = 175;

const TOUCH_SENSITIVITY = 0.006; // radians per pixel of drag

export class PlayerController {
  constructor(game) {
    this.game = game;
    this.stepTimer = 0;
    this._touchAngle = 0; // accumulated aim angle for touch
  }

  update(dt) {
    const { input, player, map, camera, movement, touch } = this.game;
    if (!player.alive) return;

    // --- aim (always, even mid-slide) ---
    if (touch && touch.active) {
      // Accumulate aim angle from right-stick drag delta
      const delta = touch.consumeAimDelta();
      if (delta.x !== 0 || delta.y !== 0) {
        this._touchAngle += delta.x * TOUCH_SENSITIVITY;
      }
      player.angle = this._touchAngle;
      touch.aimAngle = this._touchAngle;
    } else {
      const mouseWorld = camera.screenToWorld(input.mouse.x, input.mouse.y);
      player.angle = Math.atan2(mouseWorld.y - player.pos.y, mouseWorld.x - player.pos.x);
      // Keep touchAngle synced so switching back feels natural
      this._touchAngle = player.angle;
    }

    // Slide and mantle drive position themselves.
    if (player.sliding || player.mantling) {
      player.moving = true;
      return;
    }

    // --- stance ---
    player.crouching = !player.prone && (input.isDown('ControlLeft') || input.isDown('KeyC'));

    // --- movement input (keyboard or touch joystick) ---
    let dx = 0, dy = 0;
    if (touch && touch.active) {
      dx = touch.moveVec.x;
      dy = touch.moveVec.y;
    } else {
      if (input.isDown('KeyW')) dy -= 1;
      if (input.isDown('KeyS')) dy += 1;
      if (input.isDown('KeyA')) dx -= 1;
      if (input.isDown('KeyD')) dx += 1;
    }
    const hasInput = dx !== 0 || dy !== 0;
    if (hasInput) {
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
    }

    const wantSprint = (input.isDown('ShiftLeft') || (touch && touch.sprint))
      && hasInput && !player.crouching && !player.prone;
    const wasSprinting = player.sprinting;
    player.sprinting = wantSprint && (!movement || movement.stamina.canSprint);


    let speed = player.crouching ? CROUCH_SPEED : player.sprinting ? SPRINT_SPEED : WALK_SPEED;
    if (movement) speed = Math.min(speed, movement.prone.speedCap);

    // Exponential acceleration toward the target velocity.
    const t = 1 - Math.exp(-ACCEL_RATE * dt);
    player.vel.x += (dx * speed - player.vel.x) * t;
    player.vel.y += (dy * speed - player.vel.y) * t;

    map.collision.moveCircle(player.pos, player.vel.x * dt, player.vel.y * dt, player.radius);
    player.pos.x = clamp(player.pos.x, player.radius, map.worldWidth - player.radius);
    player.pos.y = clamp(player.pos.y, player.radius, map.worldHeight - player.radius);
    player.moving = player.vel.lengthSq() > 400;

    // --- sprint noise (AI hearing; silenced by Dead Silence) ---
    const silent = this.game.equipment && this.game.equipment.deadSilenceActive;
    if (player.sprinting && !silent) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = FOOTSTEP_INTERVAL;
        this.game.events.emit('sound', {
          pos: player.pos.clone(),
          radius: FOOTSTEP_RADIUS,
          team: 'player',
        });
      }
    } else {
      this.stepTimer = 0;
    }
  }
}
