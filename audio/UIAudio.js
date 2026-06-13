// audio/UIAudio.js — Interface feedback tones: kill-confirm beep (higher ding
// for headshots), hitmarker tick, XP chime, weapon pickup, killstreak-earned
// fanfare, rank-up arpeggio. All driven by EventBus; all centered (no panning).
// Dependencies: AudioEngine, EventBus.

export class UIAudio {
  constructor(engine, game) {
    this.engine = engine;
    const e = engine;

    game.events.on('hit', ({ byPlayer, killed, headshot }) => {
      if (!byPlayer) return;
      if (killed) {
        e.osc({ type: 'square', freq: headshot ? 880 : 660, dur: 0.07, gain: 0.1 });
        e.osc({ type: 'square', freq: headshot ? 1320 : 880, dur: 0.09, gain: 0.08, when: e.now + 0.06 });
      } else {
        e.noise({ dur: 0.02, gain: 0.08, filterType: 'bandpass', freq: headshot ? 2600 : 1900, q: 4 });
      }
    });

    game.events.on('xp', () => {
      e.osc({ type: 'sine', freq: 1180, dur: 0.06, gain: 0.05 });
    });

    game.events.on('pickup', () => {
      e.osc({ type: 'triangle', freq: 520, freqEnd: 780, dur: 0.1, gain: 0.1 });
    });

    game.events.on('killstreak:earned', () => {
      [523, 659, 784].forEach((f, i) =>
        e.osc({ type: 'triangle', freq: f, dur: 0.12, gain: 0.1, when: e.now + i * 0.09 }));
    });

    game.events.on('rank:up', () => {
      [392, 523, 659, 784, 1046].forEach((f, i) =>
        e.osc({ type: 'triangle', freq: f, dur: 0.16, gain: 0.1, when: e.now + i * 0.1 }));
    });

    game.events.on('mode:objective', () => {
      e.osc({ type: 'sine', freq: 700, dur: 0.1, gain: 0.08 });
      e.osc({ type: 'sine', freq: 1050, dur: 0.12, gain: 0.07, when: e.now + 0.08 });
    });
  }

  /** Flashbang tinnitus: a piercing fading whine; duration matches the blind time. */
  tinnitus(dur) {
    const e = this.engine;
    if (!e.ensure()) return;
    e.osc({ type: 'sine', freq: 3400, dur, gain: 0.12, attack: 0.01 });
    e.noise({ dur: 0.25, gain: 0.3, filterType: 'highpass', freq: 2000 });
  }
}
