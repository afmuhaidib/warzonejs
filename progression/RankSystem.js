// progression/RankSystem.js — 55 ranks with prestige. XP-to-rank is a gentle
// quadratic (each rank needs 220 more XP than the last, starting at 800).
// Hitting rank 55 enables prestige: rank resets to 1, prestige counter
// increments, unlocks re-lock (the classic trade). Persists xp + prestige to
// localStorage; emits 'rank:up' so UnlockTree and the HUD react.
// Dependencies: localStorage, EventBus.

export const MAX_RANK = 55;
const SAVE_KEY = 'warzonejs-progress';

export class RankSystem {
  constructor(game) {
    this.game = game;
    const saved = this.load();
    this.xp = saved.xp || 0;
    this.prestige = saved.prestige || 0;
    this.rank = this.rankForXP(this.xp);
  }

  /** Cumulative XP required to REACH rank r (rank 1 = 0). */
  xpForRank(r) {
    const n = r - 1;
    return 800 * n + 110 * n * (n - 1);
  }

  rankForXP(xp) {
    let r = 1;
    while (r < MAX_RANK && xp >= this.xpForRank(r + 1)) r++;
    return r;
  }

  /** Progress through the current rank, 0..1 (1 forever at max rank). */
  get progress() {
    if (this.rank >= MAX_RANK) return 1;
    const lo = this.xpForRank(this.rank);
    const hi = this.xpForRank(this.rank + 1);
    return (this.xp - lo) / (hi - lo);
  }

  addXP(amount) {
    this.xp += amount;
    const newRank = this.rankForXP(this.xp);
    while (this.rank < newRank) {
      this.rank++;
      this.game.events.emit('rank:up', { rank: this.rank });
    }
    this.save();
  }

  get canPrestige() {
    return this.rank >= MAX_RANK;
  }

  doPrestige() {
    if (!this.canPrestige) return;
    this.prestige++;
    this.xp = 0;
    this.rank = 1;
    this.save();
    this.game.events.emit('rank:up', { rank: 1, prestige: this.prestige });
  }

  // ----------------------------------------------------------- persistence

  load() {
    try {
      return JSON.parse(localStorage.getItem(SAVE_KEY)) || {};
    } catch {
      return {};
    }
  }

  save(extra = {}) {
    try {
      const cur = this.load();
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        ...cur, xp: this.xp, prestige: this.prestige, ...extra,
      }));
    } catch { /* private browsing etc. — progression just won't persist */ }
  }
}
