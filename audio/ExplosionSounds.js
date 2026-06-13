// audio/ExplosionSounds.js — Layered explosion synthesis on 'explosion' events:
// sub-bass sine boom + mid "body" noise + a debris-crackle tail of randomly
// scheduled tiny noise ticks. Spatialized; blast size scales gain and tail.
// Dependencies: AudioEngine, SpatialAudio, EventBus.

export class ExplosionSounds {
  constructor(engine, spatial, game) {
    this.engine = engine;
    this.spatial = spatial;

    game.events.on('explosion', ({ pos, radius }) => {
      const e = this.engine;
      if (!e.ensure()) return;
      const big = Math.min(1.5, radius / 120);
      const out = this.spatial.at(pos, 1.2) || undefined;
      const t0 = e.now;

      // Sub boom.
      e.osc({ when: t0, type: 'sine', freq: 90, freqEnd: 24, dur: 0.6 * big, gain: 0.7, out });
      // Body.
      e.noise({ when: t0, dur: 0.4 * big, gain: 0.5, filterType: 'lowpass', freq: 1800, freqEnd: 120, out });
      // Initial crack.
      e.noise({ when: t0, dur: 0.06, gain: 0.4, filterType: 'highpass', freq: 1200, out });
      // Debris tail: scattered crackles.
      for (let i = 0; i < 8; i++) {
        e.noise({
          when: t0 + 0.12 + Math.random() * 0.5 * big,
          dur: 0.03,
          gain: 0.06,
          filterType: 'bandpass',
          freq: 700 + Math.random() * 2200,
          q: 2,
          out,
        });
      }
    });
  }
}
