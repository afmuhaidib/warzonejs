// audio/GunSounds.js — Procedural gunshot synthesis per weapon type, driven by
// 'weapon:fired' events. Player shots play centered at full volume; enemy
// shots route through SpatialAudio. Silenced weapons swap the crack for a
// soft "pfft" (and SpatialAudio naturally shortens their audible range via
// lower base gain).
// Dependencies: AudioEngine, SpatialAudio, EventBus.

export class GunSounds {
  constructor(engine, spatial, game) {
    this.engine = engine;
    this.spatial = spatial;

    game.events.on('weapon:fired', ({ weapon, pos, byPlayer, silenced }) => {
      // Only the real player's gun plays centered at full volume; everyone else
      // (enemies AND friendlies, who now share team 'player') is spatialised.
      const out = byPlayer ? null : this.spatial.at(pos, 0.7);
      if (!byPlayer && !out) return; // out of earshot
      this.shot(weapon.shortName, silenced, out);
    });
  }

  shot(kind, silenced, out) {
    const e = this.engine;
    if (!e.ensure()) return;
    const o = out || undefined;

    if (silenced) {
      e.noise({ dur: 0.07, gain: 0.18, filterType: 'bandpass', freq: 900, q: 1.2, out: o });
      e.osc({ type: 'sine', freq: 240, freqEnd: 90, dur: 0.06, gain: 0.12, out: o });
      return;
    }

    if (kind === 'SG') {
      // Big boom: deep thump + wide noise blast.
      e.osc({ type: 'sine', freq: 110, freqEnd: 38, dur: 0.22, gain: 0.5, out: o });
      e.noise({ dur: 0.18, gain: 0.42, filterType: 'lowpass', freq: 2600, freqEnd: 300, out: o });
    } else if (kind === 'SNP') {
      // Sharp crack + long ringing tail.
      e.noise({ dur: 0.05, gain: 0.5, filterType: 'highpass', freq: 1800, out: o });
      e.osc({ type: 'sine', freq: 160, freqEnd: 40, dur: 0.35, gain: 0.45, out: o });
      e.noise({ dur: 0.5, gain: 0.12, filterType: 'lowpass', freq: 900, freqEnd: 120, out: o });
    } else {
      // AR: tight crack + short thump.
      e.noise({ dur: 0.06, gain: 0.3, filterType: 'bandpass', freq: 2200, q: 0.7, out: o });
      e.osc({ type: 'square', freq: 150, freqEnd: 60, dur: 0.08, gain: 0.22, out: o });
    }
  }
}
