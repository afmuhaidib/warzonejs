// animations/WalkBobAnimation.js — Subtle figure-8 weapon bob while moving.
// Phase advances with actual player speed (no bob when wall-blocked is wrong
// but cheap; we use velocity, so being stopped by a wall stops the bob).
// Damped to near-zero while aiming down sights.
// Dependencies: reads player velocity; rig applies the pose.

export class WalkBobAnimation {
  constructor(game) {
    this.game = game;
    this.phase = 0;
    this.amp = 0;
  }

  update(dt) {
    const p = this.game.player;
    const speed = p.vel.length();
    const moving = speed > 30;
    const targetAmp = moving ? Math.min(1, speed / 300) : 0;
    this.amp += (targetAmp - this.amp) * Math.min(1, 8 * dt);
    this.phase += dt * (4 + speed * 0.022);
  }

  get pose() {
    const steady = this.game.viewmodel ? this.game.viewmodel.ads.eased : 0;
    const a = this.amp * (1 - steady * 0.85);
    return {
      bobX: Math.cos(this.phase) * 3.2 * a,
      bobY: Math.abs(Math.sin(this.phase)) * 4.5 * a,
      bobRot: Math.cos(this.phase) * 0.02 * a,
    };
  }
}
