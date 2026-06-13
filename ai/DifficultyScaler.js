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
      reactionTime: 0.38,
      aimError: 0.06,
      aggression: 0.6,
      maxEnemies: 5,
      respawnDelay: 4.5,
    };
    this.update(0);
  }

  update(dt) {
    const L = clamp(this.game.player.score / SCORE_FOR_MAX, 0, 1);
    this.level = L;
    const p = this.params;
    // High floors: every soldier (enemy AND friendly — they share this scaler)
    // is smart and lethal from score 0. The curve still sharpens with score.
    p.reactionTime = lerp(0.30, 0.12, L); // seconds of full visibility before they "see" you
    p.aimError = lerp(0.05, 0.016, L);    // radians of gaussian aim noise
    p.aggression = lerp(0.75, 1.0, L);    // willingness to push instead of hold cover
    p.maxEnemies = Math.round(lerp(5, 9, L));
    p.respawnDelay = lerp(4.5, 1.8, L);   // seconds between reinforcements
  }
}
