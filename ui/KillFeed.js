// ui/KillFeed.js — Scrolling feed of kill messages under the minimap.
// Subscribes to 'enemy:killed' and 'player:died'; entries fade after a TTL.
// Dependencies: EventBus (via game).

const TTL = 4.5;
const MAX_LINES = 6;
const MONO = '"Courier New", monospace';

export class KillFeed {
  constructor(game) {
    this.game = game;
    this.lines = [];

    game.events.on('enemy:killed', ({ enemy, by }) => {
      const who = by && by.team === 'player' ? 'YOU' : (by ? by.name : '???');
      this.push(`${who}  ▸  ${enemy.name}`, '#9fe09a');
    });
    game.events.on('player:died', ({ by }) => {
      this.push(`${by}  ▸  YOU`, '#d65c32');
    });
  }

  push(text, color) {
    this.lines.unshift({ text, color, ttl: TTL });
    if (this.lines.length > MAX_LINES) this.lines.pop();
  }

  update(dt) {
    for (const l of this.lines) l.ttl -= dt;
    this.lines = this.lines.filter((l) => l.ttl > 0);
  }

  draw(ctx) {
    const game = this.game;
    const x = game.canvas.width - 18;
    let y = 14 + game.minimap.h + 24;

    ctx.save();
    ctx.font = `bold 12px ${MONO}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    for (const l of this.lines) {
      ctx.globalAlpha = Math.min(1, l.ttl / 0.8);
      ctx.fillStyle = 'rgba(8, 12, 8, 0.6)';
      const w = ctx.measureText(l.text).width;
      ctx.fillRect(x - w - 8, y - 3, w + 12, 18);
      ctx.fillStyle = l.color;
      ctx.fillText(l.text, x, y);
      y += 20;
    }
    ctx.restore();
  }
}
