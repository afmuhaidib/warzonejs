// net/RemotePlayer.js — A friend on the wire, rendered locally.
//
// Pure presence entity: it holds the last state broadcast by a peer (position,
// aim, health, firing) and interpolates toward it for smooth motion. It is NOT
// part of the local combat simulation in v1 (not a bullet/AI target) — see
// TEMP_ISSUES_AND_MULTIPLAYER_PLAN.md §4 for the authoritative-combat roadmap.

import { Vector2 } from '../utils/Vector2.js';

export class RemotePlayer {
  constructor(id, name, team) {
    this.id = id;
    this.name = name || 'FRIEND';
    this.team = team || 'player';          // 'player' (co-op) or 'enemy' (pvp)
    this.pos = new Vector2();
    this._target = new Vector2();
    this.angle = 0;
    this.radius = 14;
    this.health = 100;
    this.maxHealth = 100;
    this.alive = true;
    this.weaponShort = 'AK';
    this._flash = 0;                        // muzzle-flash timer
    this._seen = false;                     // got a first state yet?
    this.lastUpdate = 0;
  }

  applyState(s, now) {
    this._target.set(s.x, s.y);
    if (!this._seen) { this.pos.copy(this._target); this._seen = true; }
    this.angle = s.a;
    this.health = s.h;
    this.maxHealth = s.mh || 100;
    this.alive = !!s.al;
    this.weaponShort = s.w || 'AK';
    if (s.f) this._flash = 0.05;            // fired since last packet
    this.lastUpdate = now;
  }

  update(dt) {
    // Smooth toward the latest networked position.
    this.pos.x += (this._target.x - this.pos.x) * Math.min(1, dt * 16);
    this.pos.y += (this._target.y - this.pos.y) * Math.min(1, dt * 16);
    if (this._flash > 0) this._flash -= dt;
  }

  draw(ctx) {
    if (!this.alive) return;
    const r = this.radius;
    const ally = this.team === 'player';
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);

    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath();
    ctx.ellipse(3, 5, r + 3, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.rotate(this.angle);
    // Barrel + muzzle flash.
    ctx.strokeStyle = '#15120c';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(r * 0.4, 0);
    ctx.lineTo(r + 22, 0);
    ctx.stroke();
    if (this._flash > 0) {
      ctx.fillStyle = 'rgba(255,210,120,0.9)';
      ctx.beginPath();
      ctx.arc(r + 24, 0, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Body — bright cyan/green for allies, hot magenta for PvP rivals, so a
    // human friend reads instantly apart from the tan AI enemies / green AI allies.
    ctx.fillStyle = ally ? '#2bb6c4' : '#c43a9e';
    ctx.strokeStyle = '#0c1a1c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Helmet.
    ctx.fillStyle = ally ? '#1d8a96' : '#962b78';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Name + HP bar.
    ctx.translate(0, -r - 18);
    const bW = 34, bH = 4;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(-bW / 2, 0, bW, bH);
    const pct = Math.max(0, this.health / this.maxHealth);
    ctx.fillStyle = pct > 0.5 ? '#5db84a' : pct > 0.25 ? '#d6a13c' : '#c83a26';
    ctx.fillRect(-bW / 2, 0, bW * pct, bH);
    ctx.font = '8px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = ally ? '#7fe0ea' : '#e89fd0';
    ctx.fillText(this.name.toUpperCase(), 0, 0);

    ctx.restore();
  }
}
