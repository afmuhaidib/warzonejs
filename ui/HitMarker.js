// ui/HitMarker.js — Classic CoD cross hitmarker at the crosshair on every
// successful player hit: white X for damage, red sustained X for kills,
// rotated-and-larger for headshots. Brief TTL with scale-out.
// Dependencies: 'hit' events, draws at the mouse position.

export class HitMarker {
  constructor(game) {
    this.game = game;
    this.ttl = 0;
    this.max = 0;
    this.kill = false;
    this.headshot = false;

    game.events.on('hit', ({ byTeam, killed, headshot }) => {
      if (byTeam !== 'player') return;
      this.kill = killed;
      this.headshot = headshot;
      this.max = killed ? 0.32 : 0.16;
      this.ttl = this.max;
    });
  }

  update(dt) {
    this.ttl = Math.max(0, this.ttl - dt);
  }

  draw(ctx) {
    if (this.ttl <= 0) return;
    const { x, y } = this.game.input.mouse;
    const t = this.ttl / this.max;
    const gap = 5 + (1 - t) * 4;
    const len = (this.headshot ? 10 : 7) * (0.8 + t * 0.4);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4 + (this.headshot ? Math.PI / 8 : 0));
    ctx.globalAlpha = Math.min(1, t * 1.6);
    ctx.strokeStyle = this.kill ? '#e04f33' : '#ffffff';
    ctx.lineWidth = this.kill ? 2.5 : 2;
    ctx.beginPath();
    for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.moveTo(sx * gap, sy * gap);
      ctx.lineTo(sx * (gap + len), sy * (gap + len));
    }
    ctx.stroke();
    ctx.restore();
  }
}
