// modes/TeamDeathmatch.js — Two-team scoreboard: your kills score for GREEN;
// every death hands RED a 3-point bounty plus a slow pressure drip while
// you're not fragging (the OpFor "team" earning elsewhere on the map). First
// team to the score limit.
// Dependencies: kill/death events via GameModeManager.

const SCORE_LIMIT = 30;
const DEATH_VALUE = 3;
const DRIP_INTERVAL = 20;   // red earns 1 every N seconds of match time

export class TeamDeathmatch {
  constructor(game) {
    this.game = game;
    this.teamA = 0;          // green — you
    this.teamB = 0;          // red — them
    this.drip = 0;
    this.result = null;
  }

  onEnemyKilled({ by }) {
    if (by && by.team === 'player') this.teamA++;
  }

  onPlayerDied() {
    this.teamB += DEATH_VALUE;
  }

  update(dt) {
    this.drip += dt;
    if (this.drip >= DRIP_INTERVAL) {
      this.drip = 0;
      this.teamB++;
    }
    if (this.teamA >= SCORE_LIMIT) this.result = { won: true, headline: 'GREEN TEAM WINS' };
    else if (this.teamB >= SCORE_LIMIT) this.result = { won: false, headline: 'RED TEAM WINS' };
  }

  get hud() {
    return {
      left: `GREEN ${this.teamA}`,
      right: `RED ${this.teamB}`,
      center: `FIRST TO ${SCORE_LIMIT}`,
      bars: [
        { label: 'GRN', value: this.teamA / SCORE_LIMIT, color: '#9fe09a' },
        { label: 'RED', value: this.teamB / SCORE_LIMIT, color: '#e04f33' },
      ],
    };
  }

  summary() {
    return { teamA: this.teamA, teamB: this.teamB };
  }
}
