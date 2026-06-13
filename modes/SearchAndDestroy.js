// modes/SearchAndDestroy.js — Plant and defend, one life per round. The bomb
// site sits in enemy territory; hold E inside the site ring for 4s to plant,
// then survive the 35s bomb timer. The whole enemy team is alerted to the site
// on plant — and any enemy who reaches the bomb and works it for 5s DEFUSES
// it. Die at any point and the round is lost. First to 3 round wins takes the
// match.
// Dependencies: map points, AI alert hooks (bb.alertPos), InteractPrompt via HUD.

const PLANT_TIME = 4;
const BOMB_TIMER = 35;
const DEFUSE_TIME = 5;
const SITE_RADIUS = 70;
const ROUNDS_TO_WIN = 3;

export class SearchAndDestroy {
  constructor(game) {
    this.game = game;
    this.roundsWon = 0;
    this.roundsLost = 0;
    this.result = null;
    this.roundBanner = null; // {text, ttl}
  }

  init() {
    this.newRound();
  }

  newRound() {
    const game = this.game;
    // Site: the patrol point farthest from the player spawn = deep in their turf.
    let best = null, bestD = -1;
    for (const p of game.map.patrolPoints) {
      const d = p.distanceTo(game.map.playerSpawn);
      if (d > bestD) { bestD = d; best = p; }
    }
    if (!best) best = game.map.enemySpawns?.[0] || game.map.playerSpawn;
    this.site = best.clone();
    this.phase = 'search';     // 'search' -> 'planted' -> round end
    this.plantProgress = 0;
    this.bombTimer = BOMB_TIMER;
    this.defuseProgress = 0;
  }

  canRespawn() {
    return false; // one life per round; respawn happens via round reset
  }

  onPlayerDied() {
    if (this.phase === 'roundEnd') return;
    this.endRound(false, 'YOU DIED — ROUND LOST');
  }

  endRound(won, text) {
    if (won) this.roundsWon++; else this.roundsLost++;
    this.phase = 'roundEnd';
    this.roundBanner = { text, ttl: 2.5 };
    if (won) this.game.events.emit('mode:objective', { type: 'round-win', xp: 200 });
  }

  update(dt) {
    const game = this.game;

    if (this.roundBanner && (this.roundBanner.ttl -= dt) <= 0) this.roundBanner = null;

    if (this.phase === 'roundEnd') {
      if (!this.roundBanner) {
        // Match over?
        if (this.roundsWon >= ROUNDS_TO_WIN) { this.result = { won: true, headline: 'TARGET DESTROYED' }; return; }
        if (this.roundsLost >= ROUNDS_TO_WIN) { this.result = { won: false, headline: 'MISSION FAILED' }; return; }
        // Reset the field for the next round.
        game.player.respawn(game.map.playerSpawn);
        game.weapons.refill();
        game.camera.snapTo(game.player.pos);
        game.ai.enemies.length = 0;
        game.ai.spawnInitial();
        game.events.emit('player:respawned', {});
        game.state = 'playing';
        this.newRound();
      }
      return;
    }

    const p = game.player;

    if (this.phase === 'search') {
      // Plant: hold E inside the ring.
      const inSite = p.alive && p.pos.distanceTo(this.site) < SITE_RADIUS;
      if (inSite && game.input.isDown('KeyE')) {
        this.plantProgress += dt;
        if (this.plantProgress >= PLANT_TIME) {
          this.phase = 'planted';
          this.bombTimer = BOMB_TIMER;
          game.events.emit('mode:objective', { type: 'plant', xp: 150 });
          game.events.emit('sound', { pos: this.site.clone(), radius: 2000, team: 'player' });
          // Everyone converges.
          for (const e of game.ai.enemies) {
            e.bb.alertPos = this.site.clone();
            e.bb.alertTimer = 0;
            e.bb.awareness = Math.max(e.bb.awareness, 0.8);
          }
        }
      } else {
        this.plantProgress = Math.max(0, this.plantProgress - dt * 2);
      }
    } else if (this.phase === 'planted') {
      this.bombTimer -= dt;
      if (this.bombTimer <= 0) {
        game.combat.explosions.explode(this.site, 220, 250, p);
        this.endRound(true, 'BOMB DETONATED');
        return;
      }
      // Enemy defuse: any hostile working the bomb.
      let defusing = false;
      for (const e of game.ai.enemies) {
        if (e.pos.distanceTo(this.site) < 45) { defusing = true; break; }
      }
      if (defusing) {
        this.defuseProgress += dt;
        if (this.defuseProgress >= DEFUSE_TIME) {
          this.endRound(false, 'BOMB DEFUSED');
        }
      } else {
        this.defuseProgress = Math.max(0, this.defuseProgress - dt);
      }
      // Keep pressure converging on the site.
      for (const e of game.ai.enemies) {
        if (!e.bb.lastKnownPos && !e.bb.investigatePos) e.bb.investigatePos = this.site.clone();
      }
    }
  }

  drawWorld(ctx, game) {
    // Site ring.
    const blink = this.phase === 'planted' && Math.sin(game.time * (8 + (1 - this.bombTimer / BOMB_TIMER) * 14)) > 0;
    ctx.save();
    ctx.strokeStyle = blink ? '#e04f33' : 'rgba(214, 161, 60, 0.8)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.arc(this.site.x, this.site.y, SITE_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = blink ? '#e04f33' : '#d6a13c';
    ctx.fillText(this.phase === 'planted' ? '☢' : 'A', this.site.x, this.site.y + 6);
    ctx.restore();
  }

  get hud() {
    const h = { left: `WON ${this.roundsWon}`, right: `LOST ${this.roundsLost}`, banner: this.roundBanner?.text };
    if (this.phase === 'search') {
      h.center = 'PLANT THE BOMB AT SITE A [HOLD E]';
      if (this.plantProgress > 0) h.bars = [{ label: 'PLANTING', value: this.plantProgress / PLANT_TIME, color: '#d6a13c' }];
    } else if (this.phase === 'planted') {
      h.center = `DETONATION IN ${Math.ceil(this.bombTimer)}`;
      h.bars = [{ label: 'BOMB', value: this.bombTimer / BOMB_TIMER, color: '#e04f33' }];
      if (this.defuseProgress > 0) h.bars.push({ label: 'DEFUSING!', value: this.defuseProgress / DEFUSE_TIME, color: '#78a0e8' });
    }
    return h;
  }

  summary() {
    return { roundsWon: this.roundsWon, roundsLost: this.roundsLost };
  }
}
