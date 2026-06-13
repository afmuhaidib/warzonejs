// animations/FireAnimation.js — Recoil: every player shot kicks the viewmodel
// back-and-up via a spring impulse; the spring gives the smooth overshoot-free
// recovery lerp. Kick magnitude comes from the weapon's shake stat (so the
// sniper slams and the AR taps); a grip attachment reduces it at the weapon level.
// Dependencies: AnimationEngine (Spring), 'weapon:fired' events.

import { Spring } from './AnimationEngine.js';

export class FireAnimation {
  constructor(game) {
    this.game = game;
    this.kickBack = new Spring(160, 16); // px toward the player
    this.kickUp = new Spring(140, 13);   // rotation kick

    game.events.on('weapon:fired', ({ weapon, team }) => {
      if (team !== 'player') return;
      const k = weapon.shake * (weapon.recoilMult || 1);
      this.kickBack.kick(-k * 900);
      this.kickUp.kick(-k * 26);
    });
  }

  update(dt) {
    this.kickBack.update(dt);
    this.kickUp.update(dt);
  }

  get pose() {
    return { fireX: this.kickBack.value, fireRot: this.kickUp.value * 0.05 };
  }
}
