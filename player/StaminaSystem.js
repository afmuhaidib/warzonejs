// player/StaminaSystem.js — Sprint stamina: drains while sprinting (and on a
// slide burst), recovers when not sprinting (faster while idle/crouched).
// Hitting empty locks sprint out until a recovery threshold so you can't
// feather it. PlayerController consults canSprint; PlayerHUD draws the bar.
// Dependencies: reads player state only.

const DRAIN_RATE = 0.22;       // per second while sprinting
const RECOVER_MOVING = 0.14;
const RECOVER_IDLE = 0.3;
const RELOCK_THRESHOLD = 0.3;  // must recover to here after hitting 0
export const SLIDE_COST = 0.18;

export class StaminaSystem {
  constructor(game) {
    this.game = game;
    this.stamina = 1;
    this.exhausted = false;
  }

  get canSprint() {
    return !this.exhausted && this.stamina > 0.02;
  }

  spend(amount) {
    this.stamina = Math.max(0, this.stamina - amount);
    if (this.stamina <= 0) this.exhausted = true;
  }

  update(dt) {
    const p = this.game.player;
    if (p.sprinting || p.sliding) {
      this.spend(DRAIN_RATE * dt * (p.sliding ? 0 : 1)); // slide cost is one-shot
    } else {
      this.stamina = Math.min(1, this.stamina + (p.moving ? RECOVER_MOVING : RECOVER_IDLE) * dt);
      if (this.exhausted && this.stamina >= RELOCK_THRESHOLD) this.exhausted = false;
    }
  }
}
