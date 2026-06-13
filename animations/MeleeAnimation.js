// animations/MeleeAnimation.js — Knife swing for the viewmodel: gun drops out,
// the hand whips a knife across the frame with an inCubic wind-up → outQuad
// slash, then the gun comes back up. Triggered by KnifeSystem's 'melee' event;
// while active the rig renders the knife instead of the gun.
// Dependencies: AnimationEngine, 'melee' events.

import { Keyframes, AnimTrack, Easing } from './AnimationEngine.js';

const SWING = new Keyframes([
  { t: 0.0, v: { kx: 60, ky: 70, krot: 1.2 } },                          // off-frame low
  { t: 0.25, v: { kx: 30, ky: 10, krot: 0.7 }, ease: Easing.outQuad },   // raised
  { t: 0.55, v: { kx: -70, ky: -8, krot: -0.9 }, ease: Easing.inCubic }, // SLASH
  { t: 1.0, v: { kx: 60, ky: 80, krot: 1.2 }, ease: Easing.inOutQuad },  // tuck away
]);

export class MeleeAnimation {
  constructor(game) {
    this.game = game;
    this.track = new AnimTrack();
    game.events.on('melee', () => this.track.play(SWING, 0.42));
  }

  update(dt) {
    this.track.update(dt);
  }

  get active() {
    return this.track.playing;
  }

  get pose() {
    return this.track.playing ? this.track.value : {};
  }
}
