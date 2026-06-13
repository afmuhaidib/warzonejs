// player/ProneSystem.js — Z toggles prone: slowest movement, smallest profile.
// Effects elsewhere: AI view distance ×0.4 against a prone player (Perception),
// bullets get a 30% chance to whiff overhead unless the shooter is close
// (checked in Bullet via player.proneDodge), no sprint/slide while down,
// 0.6s transition during which you can't fire.
// Dependencies: InputManager (via game).

const PRONE_SPEED = 55;
export const TRANSITION = 0.6;

export class ProneSystem {
  constructor(game) {
    this.game = game;
    this.transition = 0;
  }

  get transitioning() {
    return this.transition > 0;
  }

  update(dt) {
    const { input, player } = this.game;
    if (!player.alive) { player.prone = false; this.transition = 0; return; }

    this.transition = Math.max(0, this.transition - dt);

    if (input.wasPressed('KeyZ') && !player.sliding && this.transition <= 0) {
      player.prone = !player.prone;
      this.transition = TRANSITION;
      if (player.prone) {
        player.sprinting = false;
        player.crouching = false;
      }
    }

    // Sprinting (Shift + move) pops you up.
    if (player.prone && input.isDown('ShiftLeft') && player.moving) {
      player.prone = false;
      this.transition = TRANSITION;
    }
  }

  get speedCap() {
    return this.game.player.prone ? PRONE_SPEED : Infinity;
  }
}
