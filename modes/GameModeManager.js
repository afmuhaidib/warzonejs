// modes/GameModeManager.js — Mode switcher and win-condition checker. Owns the
// active mode instance, forwards kill/death events into it, ticks it, asks it
// about respawn rules, and ends the match (emits 'match:end', flips game state
// to 'gameover') when the mode reports a result. Modes are selected from the
// MainMenu before a match starts.
// Dependencies: the four mode classes, EventBus.

import { MODES } from './ModeDefinitions.js';

export class GameModeManager {
  constructor(game) {
    this.game = game;
    this.mode = null;
    this.modeId = 'ffa';
    this.matchTime = 0;
    this.ended = false;

    game.events.on('enemy:killed', (e) => { if (this.mode && !this.ended) this.mode.onEnemyKilled?.(e); });
    game.events.on('player:died', (e) => { if (this.mode && !this.ended) this.mode.onPlayerDied?.(e); });
    game.events.on('player:respawned', () => { if (this.mode && !this.ended) this.mode.onRespawn?.(); });
  }

  /** Start a fresh match in the given mode. Called by MainMenu. */
  start(modeId) {
    const def = MODES.find((m) => m.id === modeId) || MODES[0];
    this.modeId = def.id;
    this.matchTime = 0;
    this.ended = false;
    const cfg = game.multiplayerConfig;
    this.timeLimit = (cfg?.duration != null) ? cfg.duration * 60 : null; // seconds, null = no limit

    // Reset match-scoped state.
    const game = this.game;
    game.ffaMode = false; // cleared here; FFA constructor sets it true if needed
    game.player.score = 0;
    game.player.kills = 0;
    game.player.deaths = 0;
    game.player.respawn(game.map.playerSpawn);
    game.weapons.refill();
    game.camera.snapTo(game.player.pos);
    // Release cover spots before clearing so CoverSystem spots aren't permanently locked.
    for (const e of game.ai.enemies) game.map.cover.release(e);
    game.ai.enemies.length = 0;
    game.ai.spawnCount = 0;
    game.killstreaks.streak = 0;
    game.killstreaks.earned.clear();
    // Rebuild friendly squad for each new match (FFA will clear it in its constructor).
    game.ai._spawnFriendlies();
    game.ai.spawnInitial();
    game.progression.xp.beginMatch();

    this.mode = def.make(game);
    this.mode.init?.();
    game.state = 'playing';

    // Stagger friendly insertion timers so they drop in sequence
    game.friendlies.forEach((f, i) => { f._insertTimer = 1.2 + i * 0.25; });
    game.spawnIntro.play(() => {});
  }

  canRespawn() {
    return this.mode && this.mode.canRespawn ? this.mode.canRespawn() : true;
  }

  update(dt) {
    if (!this.mode || this.ended) return;
    this.matchTime += dt;
    this.mode.update(dt);
    const result = this.mode.result; // null | {won, headline}
    if (result) { this.end(result); return; }
    if (this.timeLimit !== null && this.matchTime >= this.timeLimit) {
      this.end({ won: true, headline: 'TIME UP' });
    }
  }

  end(result) {
    this.ended = true;
    const game = this.game;
    game.events.emit('match:end', {
      won: result.won,
      headline: result.headline,
      summary: {
        mode: this.modeId,
        time: this.matchTime,
        kills: game.player.kills,
        deaths: game.player.deaths,
        score: game.player.score,
        ...this.mode.summary?.(),
      },
    });
    game.state = 'gameover';
  }

  drawWorld(ctx) {
    this.mode?.drawWorld?.(ctx, this.game);
  }
}
