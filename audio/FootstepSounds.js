// audio/FootstepSounds.js — Footsteps for the player and nearby enemies,
// synthesized as short filtered-noise ticks. Pitch/timbre varies by the
// surface tile (road = hard high tap, floor/dirt = duller thud). Cadence and
// loudness scale with gait (sprint > walk > crouch); prone and Dead Silence
// make the player silent. Enemy steps are spatialized — listen for flankers.
// Dependencies: AudioEngine, SpatialAudio, world/Map tiles, TileTypes.

import { TILE } from '../world/TileTypes.js';

export class FootstepSounds {
  constructor(engine, spatial, game) {
    this.engine = engine;
    this.spatial = spatial;
    this.game = game;
    this.playerAcc = 0;
    // WeakMap: dead enemy objects are GC'd automatically — no manual cleanup needed.
    this.enemyAcc = new WeakMap();
  }

  update(dt) {
    const game = this.game;
    const p = game.player;

    // --- player ---
    if (p.alive && p.moving && !p.prone) {
      const silent = game.equipment && game.equipment.deadSilenceActive;
      this.playerAcc += p.vel.length() * dt;
      const stride = p.sprinting ? 95 : p.crouching ? 130 : 110;
      if (this.playerAcc > stride) {
        this.playerAcc = 0;
        if (!silent) {
          const vol = p.sprinting ? 0.16 : p.crouching ? 0.05 : 0.1;
          this.step(game.map.tileAt(p.pos.x, p.pos.y), vol, null);
        }
      }
    }

    // --- nearby enemies ---
    for (const e of game.ai.enemies) {
      const d = e.pos.distanceTo(p.pos);
      if (d > 480) continue;
      const moved = e.vel ? 0 : 1; // enemies don't track vel; use state instead
      const movingStates = ['patrol', 'investigate', 'flank', 'engage', 'retreat', 'alert'];
      if (!movingStates.includes(e.state)) continue;
      const acc = (this.enemyAcc.get(e) || 0) + dt;
      const period = e.state === 'patrol' ? 0.55 : 0.34;
      if (acc > period) {
        this.enemyAcc.set(e, 0);
        const out = this.spatial.at(e.pos, 0.5);
        if (out) this.step(this.game.map.tileAt(e.pos.x, e.pos.y), 0.12, out);
      } else {
        this.enemyAcc.set(e, acc);
      }
    }
  }

  step(tile, gain, out) {
    const e = this.engine;
    if (!e.ensure()) return;
    const o = out || undefined;
    if (tile === TILE.ROAD) {
      // Hard surface: sharp high tap.
      e.noise({ dur: 0.045, gain, filterType: 'bandpass', freq: 1500 + Math.random() * 400, q: 1.5, out: o });
    } else {
      // Dirt/floor: dull low thud.
      e.noise({ dur: 0.07, gain: gain * 1.1, filterType: 'lowpass', freq: 420 + Math.random() * 120, out: o });
    }
  }
}
