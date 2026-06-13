// audio/SpatialAudio.js — Positions world sounds in the stereo field: pan from
// the horizontal offset between the sound and the player, gain from distance
// (inverse falloff, cull beyond earshot). Sound modules ask for a positioned
// output node and pipe their synth into it.
// Dependencies: AudioEngine.

const MAX_DIST = 1100;

export class SpatialAudio {
  constructor(engine, game) {
    this.engine = engine;
    this.game = game;
  }

  /**
   * Output node positioned at `pos` relative to the player, or null when
   * inaudible. Caller passes it as `out` to engine.osc/noise.
   */
  at(pos, baseGain = 1) {
    if (!this.engine.ensure()) return null;
    const ctx = this.engine.ctx;
    const me = this.game.player.pos;
    const dx = pos.x - me.x;
    const dy = pos.y - me.y;
    const dist = Math.hypot(dx, dy);
    if (dist > MAX_DIST) return null;

    const gain = ctx.createGain();
    gain.gain.value = baseGain * (1 - dist / MAX_DIST) ** 1.4;

    let node = gain;
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = Math.max(-1, Math.min(1, dx / 600));
      gain.connect(pan);
      pan.connect(this.engine.master);
    } else {
      gain.connect(this.engine.master);
    }
    return gain;
  }
}
