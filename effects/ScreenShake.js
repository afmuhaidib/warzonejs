// effects/ScreenShake.js — Trauma-based screen shake. Shake amount accumulates
// as "trauma" and decays linearly; offset magnitude is trauma², so small hits
// barely register while big ones slam. Camera reads offsetX/offsetY each frame.
// Leaf module: no dependencies.

const MAX_OFFSET = 14;
const DECAY = 1.6;

export class ScreenShake {
  constructor() {
    this.trauma = 0;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  add(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt) {
    this.trauma = Math.max(0, this.trauma - DECAY * dt);
    const mag = this.trauma * this.trauma * MAX_OFFSET;
    this.offsetX = (Math.random() * 2 - 1) * mag;
    this.offsetY = (Math.random() * 2 - 1) * mag;
  }
}
