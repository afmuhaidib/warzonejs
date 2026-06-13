// killstreaks/UAVSystem.js — 3-kill streak: a UAV sweep reveals every enemy on
// the minimap for 10s. The minimap normally only shows enemies that are
// alerted or close (see Minimap edit); while UAV is up, everything paints
// bright with facing ticks. Also draws a sweeping radar line over the minimap.
// Dependencies: read by world/Minimap via game.killstreaks.uav.active.

const DURATION = 10;

export class UAVSystem {
  constructor(game) {
    this.game = game;
    this.timer = 0;
  }

  get active() {
    return this.timer > 0;
  }

  activate() {
    this.timer = DURATION;
    this.game.events.emit('sound', { pos: this.game.player.pos.clone(), radius: 0, team: 'player' });
  }

  update(dt) {
    this.timer = Math.max(0, this.timer - dt);
  }

  /** Radar sweep overlay, drawn by the Minimap inside its frame. */
  drawSweep(ctx, x0, y0, w, h) {
    if (!this.active) return;
    const a = (this.game.time * 2.2) % (Math.PI * 2);
    const cx = x0 + w / 2, cy = y0 + h / 2;
    const r = Math.hypot(w, h) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, w, h);
    ctx.clip();
    const g = ctx.createLinearGradient(cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    g.addColorStop(0, 'rgba(120, 220, 120, 0.0)');
    g.addColorStop(1, 'rgba(120, 220, 120, 0.25)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
    ctx.restore();
  }
}
