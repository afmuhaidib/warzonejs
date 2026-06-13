// modes/Domination.js — Three capture points A/B/C spread across the map.
// Stand inside a ring (no hostiles contesting) for 3s to capture; enemies
// standing in a point you're not defending flip it back the same way. Every
// 5s, each owned point pays its owner 1 score. First to 50. Enemies are
// periodically tasked to contest your points so the map keeps churning.
// Dependencies: map patrol points, AI investigate hooks.

const CAP_TIME = 3;
const CAP_RADIUS = 75;
const TICK_INTERVAL = 5;
const SCORE_LIMIT = 50;
const CONTEST_INTERVAL = 9;   // how often an enemy gets pointed at our flags

export class Domination {
  constructor(game) {
    this.game = game;
    this.us = 0;
    this.them = 0;
    this.result = null;
    this.tick = 0;
    this.contestTimer = 0;
    this._friendlyTimer = 0; // separate timer for friendly dispatch
  }

  init() {
    // Divide the map into three horizontal thirds and pick the patrol point
    // closest to the centre of each third, guaranteeing real spread.
    const map = this.game.map;
    const W = map.worldWidth;
    const thirds = [W / 6, W / 2, (W * 5) / 6]; // centre-x of left/mid/right thirds
    const pts = map.patrolPoints;
    const fallback = map.playerSpawn;

    const picks = thirds.map((cx) => {
      let best = null, bestD = Infinity;
      for (const p of pts) {
        const d = Math.abs(p.x - cx);
        if (d < bestD) { bestD = d; best = p; }
      }
      return best || fallback;
    });

    this.points = picks.map((p, i) => ({
      name: 'ABC'[i],
      pos: p.clone(),
      owner: 'neutral',
      progress: 0,
      contestedBy: null,
    }));
  }

  update(dt) {
    const game = this.game;

    for (const pt of this.points) {
      const playerIn = game.player.alive && game.player.pos.distanceTo(pt.pos) < CAP_RADIUS;
      let enemyIn = false;
      for (const e of game.ai.enemies) {
        if (e.pos.distanceTo(pt.pos) < CAP_RADIUS) { enemyIn = true; break; }
      }

      if (playerIn && !enemyIn && pt.owner !== 'player') {
        pt.contestedBy = 'player';
        pt.progress += dt;
        if (pt.progress >= CAP_TIME) {
          pt.owner = 'player';
          pt.progress = 0;
          pt.contestedBy = null;
          game.events.emit('mode:objective', { type: 'capture', xp: 120 });
        }
      } else if (enemyIn && !playerIn && pt.owner !== 'enemy') {
        pt.contestedBy = 'enemy';
        pt.progress += dt;
        if (pt.progress >= CAP_TIME) {
          pt.owner = 'enemy';
          pt.progress = 0;
          pt.contestedBy = null;
        }
      } else {
        pt.progress = Math.max(0, pt.progress - dt);
        if (pt.progress === 0) pt.contestedBy = null;
      }
    }

    // Score ticks.
    this.tick += dt;
    if (this.tick >= TICK_INTERVAL) {
      this.tick = 0;
      for (const pt of this.points) {
        if (pt.owner === 'player') this.us++;
        if (pt.owner === 'enemy') this.them++;
      }
    }

    // Send enemies to contest player-owned points.
    this.contestTimer -= dt;
    if (this.contestTimer <= 0) {
      this.contestTimer = CONTEST_INTERVAL;
      // Prefer contesting player-owned points; fall back to uncaptured ones.
      const playerPts = this.points.filter((p) => p.owner === 'player');
      const neutralPts = this.points.filter((p) => p.owner === 'neutral');
      const enemyTargets = playerPts.length ? playerPts : neutralPts;
      if (enemyTargets.length) {
        // Direct up to 2 enemies toward objectives.
        const candidates = game.ai.enemies.filter((e) => e.health > 0 && !e.bb.investigatePos);
        for (let i = 0; i < Math.min(2, candidates.length); i++) {
          const pt = enemyTargets[i % enemyTargets.length];
          candidates[i].bb.investigatePos = pt.pos.clone();
        }
      }

    }

    // Friendly dispatch: every 3s, spread friendlies across all three flags.
    // Priority per slot: contested enemy > neutral > already-owned (hold it).
    // Each friendly gets a DIFFERENT point so coverage is always spread.
    this._friendlyTimer -= dt;
    if (this._friendlyTimer <= 0) {
      this._friendlyTimer = 3;
      const friendlies = (game.friendlies || []).filter((f) => f.alive);
      if (friendlies.length && this.points.length) {
        // Build priority-sorted version of points for each slot.
        const ranked = [...this.points].sort((a, b) => {
          const pri = (p) =>
            p.contestedBy === 'enemy' ? 0 : p.owner === 'neutral' ? 1 : 2;
          return pri(a) - pri(b);
        });
        for (let i = 0; i < friendlies.length; i++) {
          // Wrap so we cover all three flags when there are 3+ friendlies.
          friendlies[i]._objectivePos = ranked[i % ranked.length].pos.clone();
        }
      }
    }

    if (this.us >= SCORE_LIMIT) this.result = { won: true, headline: 'MAP DOMINATED' };
    else if (this.them >= SCORE_LIMIT) this.result = { won: false, headline: 'THEY HELD THE MAP' };
  }

  drawWorld(ctx, game) {
    for (const pt of this.points) {
      const color = pt.owner === 'player' ? '#9fe09a' : pt.owner === 'enemy' ? '#e04f33' : '#aab39a';
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(pt.pos.x, pt.pos.y, CAP_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // Capture sweep.
      if (pt.progress > 0) {
        ctx.strokeStyle = pt.contestedBy === 'player' ? '#9fe09a' : '#e04f33';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(pt.pos.x, pt.pos.y, CAP_RADIUS - 8, -Math.PI / 2, -Math.PI / 2 + (pt.progress / CAP_TIME) * Math.PI * 2);
        ctx.stroke();
      }
      ctx.font = 'bold 22px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = color;
      ctx.fillText(pt.name, pt.pos.x, pt.pos.y + 8);
      ctx.restore();
    }
  }

  get hud() {
    return {
      left: `US ${this.us}`,
      right: `THEM ${this.them}`,
      center: this.points.map((p) =>
        `${p.name}:${p.owner === 'player' ? '■' : p.owner === 'enemy' ? '□' : '·'}`).join('  '),
      bars: [
        { label: 'US', value: this.us / SCORE_LIMIT, color: '#9fe09a' },
        { label: 'THEM', value: this.them / SCORE_LIMIT, color: '#e04f33' },
      ],
    };
  }

  summary() {
    return { us: this.us, them: this.them };
  }
}
