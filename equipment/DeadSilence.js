// equipment/DeadSilence.js — Field upgrade on N: for 10 seconds your footsteps
// make no noise — neither the audible step sound (FootstepSounds checks the
// flag) nor the 'sound' events AI hearing feeds on (PlayerController gates its
// sprint-noise emission). 45s cooldown between uses.
// Dependencies: flag read by FootstepSounds + PlayerController.

const DURATION = 10;
const COOLDOWN = 45;

export class DeadSilence {
  constructor(game) {
    this.game = game;
    this.timer = 0;
    this.cooldown = 0;
  }

  get active() {
    return this.timer > 0;
  }

  get ready() {
    return this.cooldown <= 0 && !this.active;
  }

  update(dt) {
    this.timer = Math.max(0, this.timer - dt);
    if (!this.active) this.cooldown = Math.max(0, this.cooldown - dt);

    if (this.ready && this.game.player.alive && this.game.input.wasPressed('KeyN')) {
      this.timer = DURATION;
      this.cooldown = COOLDOWN;
    }
  }
}
