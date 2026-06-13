// animations/ReloadAnimation.js — The reload timeline, built properly:
//   1. inspect: gun rotates ~45° toward the camera
//   2. eject: mag detaches and falls with a gravity arc (drawn detached)
//   3. insert: lead hand brings the new mag up, outBack "click" snap + tiny shake
//   4. (full reload only) chamber pull phase, bolt visibly open
// Tactical (rounds left) and full (empty) reloads are distinct keyframe sets
// with different durations — Weapon.startReload picks the duration, we mirror
// its timeline exactly so the animation always lands on the mechanical finish.
// CANCELLABLE: if weapon.reloading flips false mid-anim (sprint/damage cancel),
// the track aborts and the gun snaps back via a short recovery blend.
// Dependencies: AnimationEngine; driven by 'weapon:reload' events + weapon state.

import { Keyframes, AnimTrack, Easing } from './AnimationEngine.js';

// Poses are viewmodel-local: rot in radians, x/y px, mag* mag-relative.
const TACTICAL = new Keyframes([
  { t: 0.0, v: { rot: 0, y: 0, magDetached: 0 } },
  { t: 0.18, v: { rot: 0.5, y: 6, magDetached: 0 }, ease: Easing.outQuad },          // tilt in
  { t: 0.22, v: { rot: 0.5, y: 6, magDetached: 1, magY: 0, leadHidden: 1 } },        // grip mag
  { t: 0.45, v: { rot: 0.55, y: 8, magDetached: 1, magY: 80, magRot: 0.9, leadHidden: 1 }, ease: Easing.inQuad }, // drop arc
  { t: 0.55, v: { rot: 0.55, y: 8, magHidden: 1, leadY: 40, leadHidden: 0 } },       // hand below w/ fresh mag
  { t: 0.78, v: { rot: 0.5, y: 6, magHidden: 0, leadY: 0, shake: 1 }, ease: Easing.outBack }, // CLICK
  { t: 1.0, v: { rot: 0, y: 0 }, ease: Easing.outCubic },                            // settle
]);

const FULL = new Keyframes([
  { t: 0.0, v: { rot: 0, y: 0, magDetached: 0 } },
  { t: 0.14, v: { rot: 0.55, y: 7, magDetached: 0 }, ease: Easing.outQuad },
  { t: 0.18, v: { rot: 0.55, y: 7, magDetached: 1, magY: 0, leadHidden: 1 } },
  { t: 0.38, v: { rot: 0.6, y: 9, magDetached: 1, magY: 90, magRot: 1.2, leadHidden: 1 }, ease: Easing.inQuad },
  { t: 0.48, v: { rot: 0.6, y: 9, magHidden: 1, leadY: 45, leadHidden: 0 } },
  { t: 0.66, v: { rot: 0.5, y: 6, magHidden: 0, leadY: 0, shake: 1 }, ease: Easing.outBack },
  { t: 0.74, v: { rot: 0.45, y: 5, boltOpen: 1, leadX: -18, leadY: -10 } },          // rack the bolt
  { t: 0.86, v: { rot: 0.45, y: 5, boltOpen: 0, leadX: -18, leadY: -6 }, ease: Easing.outQuad },
  { t: 1.0, v: { rot: 0, y: 0, leadX: 0, leadY: 0 }, ease: Easing.outCubic },
]);

export class ReloadAnimation {
  constructor(game) {
    this.game = game;
    this.track = new AnimTrack();
    this.weapon = null;
    this.shaken = false;

    game.events.on('weapon:reload', ({ weapon, full }) => {
      if (weapon !== game.weapons.current) return; // only the player's gun animates
      this.weapon = weapon;
      this.shaken = false;
      this.track.play(full ? FULL : TACTICAL, weapon.currentReloadTime);
    });
  }

  update(dt) {
    // Cancel support: the mechanical reload was interrupted -> abort the visual.
    if (this.track.playing && this.weapon && !this.weapon.reloading) {
      this.track.cancel();
    }
    this.track.update(dt);

    // The mag-seat "click" gets a one-shot micro screen shake.
    const v = this.track.value;
    if (this.track.playing && v.shake && !this.shaken) {
      this.shaken = true;
      this.game.effects.addShake(0.05);
    }
  }

  /** Pose contribution for the rig (empty object when idle). */
  get pose() {
    return this.track.playing ? this.track.value : {};
  }

  get active() {
    return this.track.playing;
  }
}
