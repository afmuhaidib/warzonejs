// ai/DifficultyScaler.js — Maps player score to a 0..1 threat level and derives
// every AI tuning knob from it: reaction time, aim error, aggression, enemy
// population, and respawn rate. All curves are simple lerps so tuning is two
// numbers per knob (see DEVELOPER_NOTES.md).
// Dependencies: utils/MathUtils.

import { clamp, lerp } from '../utils/MathUtils.js';

const SCORE_FOR_MAX = 2500; // score at which the AI is at full strength

export class DifficultyScaler {
  constructor(game) {
    this.game = game;
    this.level = 0;
    this.params = {
      reactionTime: 0.55,
      aimError: 0.085,
      aggression: 0.35,
      maxEnemies: 4,
      respawnDelay: 6,
    };
    this.update(0);
  }

  update(dt) {
    const L = clamp(this.game.player.score / SCORE_FOR_MAX, 0, 1);
    this.level = L;
    const p = this.params;
    p.reactionTime = lerp(0.55, 0.18, L); // seconds of full visibility before they "see" you
    p.aimError = lerp(0.085, 0.024, L);   // radians of gaussian aim noise
    p.aggression = lerp(0.35, 1.0, L);    // willingness to push instead of hold cover
    p.maxEnemies = Math.round(lerp(4, 8, L));
    p.respawnDelay = lerp(6, 2.2, L);     // seconds between reinforcements
  }
}
