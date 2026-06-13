// modes/CaptureTheFlag.js — Classic CTF: two flags, one at each team's base.
// Carry the enemy flag to your base to score. Your flag must be home to capture.
// First team to 3 captures wins. Flag carriers are visible on minimap.
// Dependencies: GameModeManager tick, game.player, game.ai.enemies, game.friendlies.

import { Vector2 } from '../utils/Vector2.js';

const CAP_SCORE_LIMIT = 3;
const FLAG_RADIUS = 28;        // pick-up / return interaction radius
const FLAG_RETURN_TIME = 30;   // auto-return dropped flag after N seconds

export class CaptureTheFlag {
  constructor(game) {
    this.game = game;
    this.result = null;

    this.scoreA = 0; // player team (green)
    this.scoreB = 0; // enemy team (red)

    // Flag state: 'home' | 'carried' | 'dropped'
    this.flagA = this._makeFlag('A', game.map.playerSpawn.clone(), '#4caf50');
    // Place enemy flag at the patrol point farthest from the player spawn
    // so it's in deep enemy territory rather than a random spawn corner.
    let enemyBase = game.map.enemySpawns[0].clone();
    let bestD = -1;
    for (const p of game.map.patrolPoints) {
      const d = p.distanceTo(game.map.playerSpawn);
      if (d > bestD) { bestD = d; enemyBase = p.clone(); }
    }
    this.flagB = this._makeFlag('B', enemyBase, '#e53935');
  }

  _makeFlag(id, homePos, color) {
    return {
      id,
      color,
      homePos: homePos.clone(),
      pos: homePos.clone(),
      status: 'home',   // 'home' | 'carried' | 'dropped'
      carrier: null,
      dropTimer: 0,
    };
  }

  init() {
    this.game.events.emit('ctf:init', {});
  }

  update(dt) {
    const game = this.game;

    this._tickFlag(this.flagA, dt);
    this._tickFlag(this.flagB, dt);

    // Player interactions
    if (game.player.alive) {
      this._checkPickup(game.player, game);
      this._checkCapture(game.player, game);
      this._checkReturn(game.player, game);
    }

    // Friendly AI interactions
    for (const f of (game.friendlies || [])) {
      if (f.alive) {
        this._checkPickup(f, game);
        this._checkCapture(f, game);
        this._checkReturn(f, game);
      }
    }

    // Enemy AI interactions (enemy team picks up flagA = player flag)
    for (const e of game.ai.enemies) {
      if (e.health > 0) {
        this._checkEnemyPickup(e, game);
        this._checkEnemyCapture(e, game);
        this._checkEnemyReturn(e, game);
      }
    }

    // Direct enemies toward the player flag or their base depending on carry status.
    this._tickEnemyFlagAI(game, dt);

    if (this.scoreA >= CAP_SCORE_LIMIT)
      this.result = { won: true, headline: 'GREEN TEAM — FLAG CAPTURED ×3' };
    else if (this.scoreB >= CAP_SCORE_LIMIT)
      this.result = { won: false, headline: 'RED TEAM — FLAG CAPTURED ×3' };
  }

  _tickFlag(flag, dt) {
    if (flag.status === 'carried' && flag.carrier) {
      // Carrier died or became invalid — drop the flag
      const alive = flag.carrier.alive !== false && (flag.carrier.health === undefined || flag.carrier.health > 0);
      if (!alive) {
        flag.dropTimer = FLAG_RETURN_TIME;
        flag.status = 'dropped';
        flag.carrier = null;
      } else {
        flag.pos.copy(flag.carrier.pos);
      }
    }
    if (flag.status === 'dropped') {
      flag.dropTimer -= dt;
      if (flag.dropTimer <= 0) this._returnFlag(flag);
    }
  }

  _returnFlag(flag) {
    flag.status = 'home';
    flag.carrier = null;
    flag.pos.copy(flag.homePos);
    flag.dropTimer = 0;
    this.game.events.emit('ctf:returned', { flag: flag.id });
  }

  // --- Player-team logic (picks up enemy flag B, captures at home base A) ---
  _checkPickup(entity, game) {
    const flag = this.flagB; // player team wants enemy flag
    if (flag.status !== 'home' && flag.status !== 'dropped') return;
    if (flag.carrier === entity) return;
    if (entity.pos.distanceTo(flag.pos) < FLAG_RADIUS) {
      flag.status = 'carried';
      flag.carrier = entity;
      game.events.emit('ctf:pickup', { flag: flag.id, by: entity.name || 'You' });
    }
  }

  _checkCapture(entity, game) {
    if (this.flagB.carrier !== entity) return;
    if (this.flagA.status !== 'home') return; // your flag must be home
    if (entity.pos.distanceTo(this.flagA.homePos) < FLAG_RADIUS) {
      this.scoreA++;
      this._returnFlag(this.flagB);
      game.player.score += 500;
      game.events.emit('ctf:captured', { flag: 'B', by: entity.name || 'You', score: this.scoreA });
    }
  }

  _checkReturn(entity, game) {
    // Return your own dropped flag by touching it
    const flag = this.flagA;
    if (flag.status !== 'dropped') return;
    if (entity.pos.distanceTo(flag.pos) < FLAG_RADIUS) {
      this._returnFlag(flag);
      game.events.emit('ctf:returned', { flag: flag.id });
    }
  }

  // --- Enemy-team logic (picks up flag A = player flag, captures at base B) ---
  _checkEnemyPickup(entity, game) {
    const flag = this.flagA;
    if (flag.status !== 'home' && flag.status !== 'dropped') return;
    if (flag.carrier === entity) return;
    if (entity.pos.distanceTo(flag.pos) < FLAG_RADIUS) {
      flag.status = 'carried';
      flag.carrier = entity;
      game.events.emit('ctf:pickup', { flag: flag.id, by: entity.name });
    }
  }

  _checkEnemyCapture(entity, game) {
    if (this.flagA.carrier !== entity) return;
    if (this.flagB.status !== 'home') return;
    if (entity.pos.distanceTo(this.flagB.homePos) < FLAG_RADIUS) {
      this.scoreB++;
      this._returnFlag(this.flagA);
      game.events.emit('ctf:captured', { flag: 'A', by: entity.name, score: this.scoreB });
    }
  }

  _checkEnemyReturn(entity, game) {
    const flag = this.flagB;
    if (flag.status !== 'dropped') return;
    if (entity.pos.distanceTo(flag.pos) < FLAG_RADIUS) {
      this._returnFlag(flag);
    }
  }

  // Every few seconds, direct idle enemies toward flag A (steal) or their base (capture).
  _tickEnemyFlagAI(game, dt) {
    if (!this._flagAITimer) this._flagAITimer = 0;
    this._flagAITimer -= dt;
    if (this._flagAITimer > 0) return;
    this._flagAITimer = 3;

    // --- Enemy team: grab flagA (player flag), bring to flagB.homePos ---
    for (const e of game.ai.enemies) {
      if (e.health <= 0) continue;
      if (e === this.flagA.carrier) {
        e.bb.investigatePos = this.flagB.homePos.clone();
      } else if (this.flagA.status !== 'carried') {
        e.bb.investigatePos = this.flagA.pos.clone();
      }
    }

    // --- Friendly team: grab flagB (enemy flag), bring to flagA.homePos ---
    for (const f of (game.friendlies || [])) {
      if (!f.alive) continue;
      if (f === this.flagB.carrier) {
        // Carrier: run home
        f._coverSpot = this.flagA.homePos.clone();
      } else if (this.flagB.status !== 'carried') {
        // Others: go get the enemy flag
        f._coverSpot = this.flagB.pos.clone();
      }
    }
  }

  get hud() {
    const aStatus = this.flagA.status === 'carried'
      ? `⚑ CARRIED by ${this.flagA.carrier?.name || '?'}`
      : this.flagA.status === 'dropped' ? `⚑ DROPPED (${Math.ceil(this.flagA.dropTimer)}s)`
      : '⚑ HOME';
    const bStatus = this.flagB.status === 'carried'
      ? `⚑ CARRIED by ${this.flagB.carrier?.name || '?'}`
      : this.flagB.status === 'dropped' ? `⚑ DROPPED (${Math.ceil(this.flagB.dropTimer)}s)`
      : '⚑ HOME';
    return {
      left:   `GREEN ${this.scoreA} — ${bStatus}`,
      right:  `${aStatus} — RED ${this.scoreB}`,
      center: `FIRST TO ${CAP_SCORE_LIMIT} CAPS`,
      bars: [
        { label: 'GRN', value: this.scoreA / CAP_SCORE_LIMIT, color: '#4caf50' },
        { label: 'RED', value: this.scoreB / CAP_SCORE_LIMIT, color: '#e53935' },
      ],
    };
  }

  drawWorld(ctx, game) {
    this._drawFlag(ctx, this.flagA, game);
    this._drawFlag(ctx, this.flagB, game);
  }

  _drawFlag(ctx, flag, game) {
    const t = game.time;
    ctx.save();
    ctx.translate(flag.pos.x, flag.pos.y);

    if (flag.status !== 'carried') {
      const pulse = (Math.sin(t * 3) * 0.5 + 0.5); // 0..1
      const alpha = flag.status === 'dropped' ? 0.45 : 1;

      // Outer glow ring
      ctx.globalAlpha = alpha * (0.18 + pulse * 0.12);
      ctx.strokeStyle = flag.color;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(0, 0, FLAG_RADIUS + 4, 0, Math.PI * 2);
      ctx.stroke();

      // Solid capture circle
      ctx.globalAlpha = alpha * 0.22;
      ctx.fillStyle = flag.color;
      ctx.beginPath();
      ctx.arc(0, 0, FLAG_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Ring border
      ctx.globalAlpha = alpha * (0.6 + pulse * 0.35);
      ctx.strokeStyle = flag.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, FLAG_RADIUS, 0, Math.PI * 2);
      ctx.stroke();

      // Inner diamond marker
      ctx.globalAlpha = alpha;
      ctx.fillStyle = flag.color;
      ctx.save();
      ctx.rotate(Math.PI / 4 + t * 0.8);
      ctx.fillRect(-6, -6, 12, 12);
      ctx.restore();

      // Team letter
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#0d110b';
      ctx.fillText(flag.id, 0, 0);

      // DROPPED label
      if (flag.status === 'dropped') {
        ctx.globalAlpha = 0.9;
        ctx.font = '9px "Courier New", monospace';
        ctx.fillStyle = '#e8e2cf';
        ctx.textBaseline = 'bottom';
        ctx.fillText('DROPPED', 0, -FLAG_RADIUS - 6);
      }
    } else {
      // Carried — draw small beacon on carrier (carrier pos == flag pos)
      const blink = Math.floor(t * 4) % 2 === 0;
      if (blink) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = flag.color;
        ctx.beginPath();
        ctx.arc(0, -18, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  summary() {
    return { scoreA: this.scoreA, scoreB: this.scoreB };
  }
}
