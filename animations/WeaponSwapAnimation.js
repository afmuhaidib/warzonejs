// animations/WeaponSwapAnimation.js — Weapon switch: the old gun drops out of
// frame (inQuad — it's being let go), then the new gun rises with an outBack
// raise-and-settle. Mirrors WeaponManager.swapTimer (which is what actually
// blocks firing); we render the OLD weapon during the drop half and the new
// one on the way up.
// Dependencies: AnimationEngine; reads WeaponManager swap state.

import { Keyframes, AnimTrack, Easing } from './AnimationEngine.js';

const DROP = new Keyframes([
  { t: 0, v: { y: 0, rot: 0 } },
  { t: 1, v: { y: 110, rot: 0.5 }, ease: Easing.inQuad },
]);
const RAISE = new Keyframes([
  { t: 0, v: { y: 110, rot: 0.5 } },
  { t: 1, v: { y: 0, rot: 0 }, ease: Easing.outBack },
]);

export class WeaponSwapAnimation {
  constructor(game) {
    this.game = game;
    this.track = new AnimTrack();
    this.phase = null;       // 'drop' | 'raise'
    this.oldWeapon = null;

    game.events.on('weapon:swap', ({ from }) => {
      this.oldWeapon = from;
      this.phase = 'drop';
      const half = game.weapons.SWAP_TIME / 2;
      this.track.play(DROP, half, () => {
        this.phase = 'raise';
        this.track.play(RAISE, half, () => { this.phase = null; });
      });
    });
  }

  update(dt) {
    this.track.update(dt);
  }

  get pose() {
    return this.phase ? this.track.value : {};
  }

  /** Weapon to render right now (the outgoing gun during the drop half). */
  weaponToShow(current) {
    return this.phase === 'drop' && this.oldWeapon ? this.oldWeapon : current;
  }

  get active() {
    return this.phase !== null;
  }
}
