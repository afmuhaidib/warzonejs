// modes/FreeForAll.js — Classic FFA: every enemy for themselves, you against
// the lobby. First to the kill limit wins; hit the death cap and the lobby
// wins. Kill XP only — no objectives.
// Dependencies: reads player stats; GameModeManager drives it.

const KILL_LIMIT = 30;
const DEATH_CAP = 10;

export class FreeForAll {
  constructor(game) {
    this.game = game;
    this.result = null;
    // FFA: no friendly squad and every enemy is their own team.
    game.friendlies = [];
    game.ffaMode = true;
    // Re-tag any already-spawned enemies with unique teams.
    game.ai.enemies.forEach((e, i) => { e.team = `ffa_${i}`; });
  }

  update() {
    const p = this.game.player;
    if (p.kills >= KILL_LIMIT) {
      this.result = { won: true, headline: 'KILL LIMIT REACHED' };
    } else if (p.deaths >= DEATH_CAP) {
      this.result = { won: false, headline: 'OVERRUN' };
    }
  }

  get hud() {
    const p = this.game.player;
    return { left: `KILLS ${p.kills}/${KILL_LIMIT}`, right: `DEATHS ${p.deaths}/${DEATH_CAP}` };
  }

  summary() {
    return { limit: KILL_LIMIT };
  }
}
