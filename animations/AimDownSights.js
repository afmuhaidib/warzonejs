// animations/AimDownSights.js — Hold right mouse to aim: the viewmodel lerps
// toward screen center and steadies (bob is damped by the rig), the camera
// gains a subtle zoom, and weapon spread tightens. Optics change the numbers:
// red dot = small zoom bonus, ACOG = big zoom but slower transition, sniper
// scope = biggest. Exposes adsT (0..1), zoom, spreadMult for other systems.
// Dependencies: AnimationEngine (easing), InputManager (via game).

import { Easing } from './AnimationEngine.js';
import { clamp, lerp } from '../utils/MathUtils.js';

export class AimDownSights {
  constructor(game) {
    this.game = game;
    this.t = 0;          // raw 0..1 transition
  }

  get speed() {
    const w = this.game.weapons.current;
    if (!w) return 7;
    if (w.shortName === 'SNP') return 4;
    if (w.optic === 'acog') return 4.5;
    return 8;
  }

  update(dt) {
    const game = this.game;
    const blocked = !game.player.alive
      || game.player.sprinting
      || game.player.sliding
      || (game.weapons.current && game.weapons.current.reloading)
      || game.weapons.swapping;
    const want = !blocked && game.input.mouse.right;
    const dir = want ? 1 : -1;
    this.t = clamp(this.t + dir * this.speed * dt, 0, 1);

    // Apply spread + camera zoom every frame (smooth, never a jump).
    const e = this.eased;
    game.player.adsSpreadMult = lerp(1, 0.35, e);
    const w = game.weapons.current;
    const zoomMax = w && w.shortName === 'SNP' ? 1.45
      : w && w.optic === 'acog' ? 1.3
      : w && w.optic === 'reddot' ? 1.15 : 1.1;
    game.camera.targetZoom = lerp(1, zoomMax, e);
  }

  get eased() {
    return Easing.inOutQuad(this.t);
  }

  /** Pose contribution: pull the gun toward center-screen and square it up. */
  get pose() {
    const e = this.eased;
    return { adsX: -60 * e, adsY: -26 * e, adsRot: -0.06 * e, steady: e };
  }

  get aiming() {
    return this.t > 0.5;
  }
}
