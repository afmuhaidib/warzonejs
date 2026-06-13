// modes/ObjectiveHUD.js — Mode-specific overlay strip at the top-center of the
// screen. Reads the active mode's declarative `hud` object: left/right scores,
// a center line (objective text / bomb countdown), optional progress bars
// (plant/defuse/capture/team score), and a round banner. One renderer for all
// four modes so layouts stay consistent.
// Dependencies: reads GameModeManager's active mode.

const MONO = '"Courier New", monospace';

export class ObjectiveHUD {
  constructor(game) {
    this.game = game;
  }

  draw(ctx) {
    const mode = this.game.modes.mode;
    if (!mode || !mode.hud) return;
    const h = mode.hud;
    const cx = this.game.canvas.width / 2;
    const y = 18;

    ctx.save();
    ctx.textBaseline = 'top';

    // Backplate.
    ctx.fillStyle = 'rgba(8, 12, 8, 0.55)';
    ctx.fillRect(cx - 190, y - 6, 380, h.bars ? 58 : 42);
    ctx.strokeStyle = 'rgba(214, 92, 50, 0.4)';
    ctx.strokeRect(cx - 190, y - 6, 380, h.bars ? 58 : 42);

    ctx.font = `bold 15px ${MONO}`;
    if (h.left) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#9fe09a';
      ctx.fillText(h.left, cx - 178, y);
    }
    if (h.right) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#e04f33';
      ctx.fillText(h.right, cx + 178, y);
    }
    if (h.center) {
      ctx.textAlign = 'center';
      ctx.font = `bold 12px ${MONO}`;
      ctx.fillStyle = '#e8e2cf';
      ctx.fillText(h.center, cx, y + 18);
    }

    // Progress bars.
    if (h.bars) {
      let by = y + 36;
      for (const bar of h.bars) {
        ctx.fillStyle = 'rgba(30, 36, 28, 1)';
        ctx.fillRect(cx - 120, by, 240, 6);
        ctx.fillStyle = bar.color;
        ctx.fillRect(cx - 120, by, 240 * Math.min(1, bar.value), 6);
        ctx.font = `9px ${MONO}`;
        ctx.textAlign = 'left';
        ctx.fillStyle = bar.color;
        ctx.fillText(bar.label, cx + 126, by - 1);
        by += 9;
      }
    }

    // Round banner (S&D round results etc.) front and center.
    if (h.banner) {
      ctx.textAlign = 'center';
      ctx.font = `bold 30px ${MONO}`;
      ctx.fillStyle = '#e8c878';
      ctx.fillText(h.banner, cx, this.game.canvas.height * 0.3);
    }

    ctx.restore();
  }
}
