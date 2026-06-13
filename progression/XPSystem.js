// progression/XPSystem.js — Central XP ledger. Awards XP for kills (with
// headshot / melee / sentry bonuses), assists (anyone the player damaged who
// then died to something else still pays out), and mode objectives. Keeps a
// per-match breakdown for the EndGameScreen and persists total XP via
// RankSystem's save. Every award emits 'xp' for the HUD + audio chime.
// Dependencies: EventBus; RankSystem consumes the totals.

const KILL_XP = 100;
const HEADSHOT_BONUS = 25;
const MELEE_BONUS = 35;
const SENTRY_KILL_XP = 75;
const ASSIST_XP = 50;

export class XPSystem {
  constructor(game) {
    this.game = game;
    this.matchLog = [];     // [{reason, amount, count}] aggregated
    this.matchTotal = 0;

    game.events.on('hit', ({ killed, headshot, byTeam, melee }) => {
      if (byTeam !== 'player' || !killed) return;
      if (headshot) this.award(HEADSHOT_BONUS, 'HEADSHOT');
      if (melee) this.award(MELEE_BONUS, 'MELEE KILL');
    });

    game.events.on('enemy:killed', ({ enemy, by }) => {
      if (!by || by.team !== 'player') return;
      this.award(by.name === 'Sentry' ? SENTRY_KILL_XP : KILL_XP,
        by.name === 'Sentry' ? 'SENTRY KILL' : 'KILL');
      // Assist: player damaged this enemy but the sentry (or blast) finished it.
      if (by !== game.player && enemy.hitByPlayer) this.award(ASSIST_XP, 'ASSIST');
    });

    game.events.on('mode:objective', ({ type, xp }) => {
      this.award(xp || 100, type.toUpperCase());
    });
  }

  beginMatch() {
    this.matchLog = [];
    this.matchTotal = 0;
  }

  award(amount, reason) {
    this.matchTotal += amount;
    const entry = this.matchLog.find((e) => e.reason === reason);
    if (entry) { entry.amount += amount; entry.count++; }
    else this.matchLog.push({ reason, amount, count: 1 });

    this.game.progression.rank.addXP(amount);
    this.game.events.emit('xp', { amount, reason });
  }
}
