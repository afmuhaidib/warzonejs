// audio/ReloadSounds.js — Reload foley scheduled against the reload timeline:
// mag-eject click early, mag-seat snap at the insert keyframe, and (full
// reloads only) a chamber/bolt rack near the end. Times are fractions of the
// weapon's currentReloadTime so audio stays in sync with ReloadAnimation.
// Dependencies: AudioEngine, 'weapon:reload' events.

export class ReloadSounds {
  constructor(engine, game) {
    this.engine = engine;

    game.events.on('weapon:reload', ({ weapon, full }) => {
      if (!engine.ensure()) return;
      const t0 = engine.now;
      const D = weapon.currentReloadTime;

      // Mag release click.
      this.click(t0 + D * 0.2, 1300, 0.12);
      // Mag hits the dirt (soft thud).
      engine.noise({ when: t0 + D * (full ? 0.4 : 0.46), dur: 0.05, gain: 0.07, filterType: 'lowpass', freq: 500 });
      // New mag seats: snap.
      this.click(t0 + D * (full ? 0.66 : 0.78), 900, 0.16);
      // Bolt rack on a full reload.
      if (full) {
        this.click(t0 + D * 0.76, 700, 0.12);
        this.click(t0 + D * 0.85, 1100, 0.14);
      }
    });
  }

  click(when, freq, gain) {
    this.engine.noise({ when, dur: 0.03, gain, filterType: 'bandpass', freq, q: 3 });
    this.engine.osc({ when, type: 'square', freq: freq * 0.5, freqEnd: freq * 0.3, dur: 0.025, gain: gain * 0.5 });
  }
}
